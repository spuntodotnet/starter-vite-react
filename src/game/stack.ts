import * as THREE from "three"
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js"
import { config } from "../config"

type Axis = "x" | "z"
type Block = { mesh: THREE.Mesh; x: number; z: number; w: number; d: number }
type Debris = { mesh: THREE.Mesh; vy: number; vx: number; vz: number; spin: THREE.Vector3 }
type Ripple = { line: THREE.LineSegments; age: number }

export type GameState = "ready" | "playing" | "over"
export type GameEvents = {
  onScore: (score: number, perfect: boolean) => void
  onState: (state: GameState) => void
  onHue: (hue: number) => void
}

const H = () => config.blockHeight
const hueAt = (i: number) => (config.hueStart + i * config.hueStep) % 360
const colorAt = (i: number) => new THREE.Color().setHSL(hueAt(i) / 360, config.saturation / 100, config.lightness / 100)

/** Stack: blocks slide over the tower, a click drops them, what overhangs falls off. */
export class StackGame {
  private renderer: THREE.WebGLRenderer
  private scene = new THREE.Scene()
  private camera: THREE.OrthographicCamera
  private sun: THREE.DirectionalLight
  private stack: Block[] = []
  private moving: (Block & { axis: Axis; dir: number }) | null = null
  private debris: Debris[] = []
  private ripples: Ripple[] = []
  private state: GameState = "ready"
  private combo = 0
  /** Before the first tap the tower builds itself, behind the title — the game shows what it is. */
  private demo = true
  /** Where the demo's last frame left the block, relative to its aim: it drops on crossing it. */
  private demoWas: number | null = null
  private camY = 0
  private zoom = 1
  private targetZoom = 1
  private frame = 0
  private last = performance.now()
  private resize: ResizeObserver
  private host: HTMLElement
  private events: GameEvents

  constructor(host: HTMLElement, events: GameEvents) {
    this.host = host
    this.events = events
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    this.renderer.shadowMap.enabled = true
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap
    host.appendChild(this.renderer.domElement)

    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 200)
    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x1b2b3a, 1.1))
    this.sun = new THREE.DirectionalLight(0xffffff, 1.9)
    this.sun.castShadow = true
    this.sun.shadow.mapSize.set(2048, 2048)
    Object.assign(this.sun.shadow.camera, { left: -8, right: 8, top: 8, bottom: -8, near: 0.5, far: 60 })
    this.sun.shadow.bias = -0.0004
    this.scene.add(this.sun, this.sun.target)

    // A soft floor that only catches the tower's shadow.
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), new THREE.ShadowMaterial({ opacity: 0.18 }))
    floor.rotation.x = -Math.PI / 2
    floor.position.y = -H() / 2 - 6
    floor.receiveShadow = true
    this.scene.add(floor)

    this.reset()
    this.resize = new ResizeObserver(() => this.fit())
    this.resize.observe(host)
    this.fit()
    this.loop()
  }

  /** The player's one move: start, drop the block, or start again. */
  tap() {
    if (this.state !== "playing") {
      this.reset(false)
      return this.begin()
    }
    this.place()
  }

  dispose() {
    cancelAnimationFrame(this.frame)
    this.resize.disconnect()
    this.renderer.dispose()
    this.renderer.domElement.remove()
  }

  // ── The rules ────────────────────────────────────────────────────────────

  private reset(demo = this.demo) {
    this.demo = demo
    for (const b of this.stack) this.scene.remove(b.mesh)
    for (const d of this.debris) this.scene.remove(d.mesh)
    for (const r of this.ripples) this.scene.remove(r.line)
    if (this.moving) this.scene.remove(this.moving.mesh)
    this.stack = []
    this.debris = []
    this.ripples = []
    this.moving = null
    this.combo = 0
    this.targetZoom = 1
    // A pedestal below the first block, so the tower stands on something.
    const s = config.baseSize
    this.stack.push(this.block(0, 0, s, s, 0, 0))
    const plinth = this.stack[0]!.mesh
    plinth.scale.y = 14
    plinth.position.y = -H() * 6.5
    this.setState("ready")
    this.events.onScore(0, false)
    this.events.onHue(hueAt(0))
    if (demo) this.spawn()
  }

  private begin() {
    this.setState("playing")
    this.spawn()
  }

  /** The demo's hand: drops a block when it is nearly over the one below, now and then a little off. */
  private autoplay() {
    const m = this.moving
    if (!m) return
    const top = this.stack[this.stack.length - 1]!
    // Perfect most of the time; every fourth block a little off, so something falls.
    const aim = this.stack.length % 4 === 0 ? -0.35 * m.dir : 0
    const off = m[m.axis] - top[m.axis] - aim
    const crossed = this.demoWas !== null && Math.sign(off) !== Math.sign(this.demoWas)
    this.demoWas = off
    if (!crossed) return
    m[m.axis] = top[m.axis] + aim
    this.demoWas = null
    this.place()
    if (this.stack.length > 16) this.reset(true)
  }

  private spawn() {
    const top = this.stack[this.stack.length - 1]!
    const level = this.stack.length
    const axis: Axis = level % 2 ? "x" : "z"
    const b = this.block(axis === "x" ? -config.range : top.x, axis === "z" ? -config.range : top.z, top.w, top.d, level, level)
    this.moving = { ...b, axis, dir: 1 }
  }

  private place() {
    const cur = this.moving
    if (!cur) return
    const top = this.stack[this.stack.length - 1]!
    const along = cur.axis
    const size = along === "x" ? top.w : top.d
    let delta = cur[along] - top[along]
    const overlap = size - Math.abs(delta)

    if (overlap <= 0 && !this.demo) {
      // Missed entirely: the whole block falls, and the game is over.
      this.drop(cur.mesh, cur.axis, Math.sign(delta) || 1)
      this.moving = null
      this.targetZoom = Math.min(1, 7 / (this.stack.length * H() + 4))
      return this.setState("over")
    }

    const perfect = Math.abs(delta) < config.perfect
    if (perfect) {
      delta = 0
      this.combo++
      cur[along] = top[along]
      if (this.combo >= config.comboToGrow) {
        // Rewarded: grow back a little, never beyond the first block.
        if (along === "x") cur.w = Math.min(config.baseSize, cur.w + config.grow)
        else cur.d = Math.min(config.baseSize, cur.d + config.grow)
      }
      this.ripple(cur)
    } else {
      this.combo = 0
      // Keep what overlaps, let the rest fall.
      const kept = overlap
      const cut = Math.abs(delta)
      const keptCenter = top[along] + delta / 2
      const cutCenter = keptCenter + (Math.sign(delta) * (kept + cut)) / 2
      if (along === "x") cur.w = kept
      else cur.d = kept
      cur[along] = keptCenter
      const piece = this.block(
        along === "x" ? cutCenter : cur.x,
        along === "z" ? cutCenter : cur.z,
        along === "x" ? cut : cur.w,
        along === "z" ? cut : cur.d,
        this.stack.length,
        this.stack.length,
      )
      this.drop(piece.mesh, along, Math.sign(delta))
    }

    // The placed block, at its final size and place.
    this.scene.remove(cur.mesh)
    const placed = this.block(cur.x, cur.z, cur.w, cur.d, this.stack.length, this.stack.length)
    this.stack.push(placed)
    this.moving = null
    if (!this.demo) this.events.onScore(this.stack.length - 1, perfect)
    this.events.onHue(hueAt(this.stack.length))
    this.spawn()
  }

  // ── Pieces ───────────────────────────────────────────────────────────────

  private block(x: number, z: number, w: number, d: number, level: number, colorIndex: number): Block {
    const geometry = new RoundedBoxGeometry(w, H(), d, 2, 0.035)
    const material = new THREE.MeshStandardMaterial({ color: colorAt(colorIndex), roughness: 0.5, metalness: 0 })
    const mesh = new THREE.Mesh(geometry, material)
    mesh.position.set(x, level * H(), z)
    mesh.castShadow = mesh.receiveShadow = true
    this.scene.add(mesh)
    return { mesh, x, z, w, d }
  }

  private drop(mesh: THREE.Mesh, axis: Axis, side: number) {
    const push = 1.6 * side
    this.debris.push({
      mesh,
      vy: 1.5,
      vx: axis === "x" ? push : 0,
      vz: axis === "z" ? push : 0,
      spin: new THREE.Vector3(axis === "z" ? side * 2.4 : 0.3, 0, axis === "x" ? -side * 2.4 : 0.3),
    })
  }

  private ripple(b: Block) {
    const outline = new THREE.EdgesGeometry(new THREE.BoxGeometry(b.w, 0.001, b.d))
    const line = new THREE.LineSegments(outline, new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true }))
    line.position.set(b.x, this.stack.length * H() + H() / 2, b.z)
    this.scene.add(line)
    this.ripples.push({ line, age: 0 })
  }

  // ── Every frame ──────────────────────────────────────────────────────────

  private loop = () => {
    this.frame = requestAnimationFrame(this.loop)
    const now = performance.now()
    const dt = Math.min(0.1, (now - this.last) / 1000)
    this.last = now

    const m = this.moving
    if (m && (this.state === "playing" || this.demo)) {
      const speed = config.speed * (1 + (this.stack.length - 1) * config.speedRamp)
      m[m.axis] += m.dir * speed * dt
      if (Math.abs(m[m.axis]) > config.range) {
        m[m.axis] = Math.sign(m[m.axis]) * config.range
        m.dir *= -1
      }
      m.mesh.position.x = m.x
      m.mesh.position.z = m.z
      if (this.demo) this.autoplay()
    }

    for (const d of this.debris) {
      d.vy -= 22 * dt
      d.mesh.position.x += d.vx * dt
      d.mesh.position.y += d.vy * dt
      d.mesh.position.z += d.vz * dt
      d.mesh.rotation.x += d.spin.x * dt
      d.mesh.rotation.z += d.spin.z * dt
    }
    this.debris = this.debris.filter((d) => (d.mesh.position.y > this.camY - 30 ? true : (this.scene.remove(d.mesh), false)))

    for (const r of this.ripples) {
      r.age += dt
      const s = 1 + r.age * 0.9
      r.line.scale.set(s, 1, s)
      ;(r.line.material as THREE.LineBasicMaterial).opacity = Math.max(0, 1 - r.age * 1.6)
    }
    this.ripples = this.ripples.filter((r) => (r.age < 0.7 ? true : (this.scene.remove(r.line), false)))

    // The camera rises with the tower, and backs off to show it all when it is over.
    const height = (this.stack.length - 1) * H()
    this.camY += (height - this.camY) * Math.min(1, dt * 4)
    this.zoom += (this.targetZoom - this.zoom) * Math.min(1, dt * 2.5)
    const lookY = this.state === "over" ? height / 2 : this.camY
    this.camera.position.set(9, lookY + 9, 9)
    this.camera.lookAt(0, lookY, 0)
    this.camera.zoom = this.zoom
    this.camera.updateProjectionMatrix()
    this.sun.position.set(6, this.camY + 14, 4)
    this.sun.target.position.set(0, this.camY, 0)

    this.renderer.render(this.scene, this.camera)
  }

  private fit() {
    const { clientWidth: w, clientHeight: h } = this.host
    if (!w || !h) return
    this.renderer.setSize(w, h)
    // Enough of the tower to read it as one, its top a little below the middle — the score above.
    const view = Math.max(12, 12 * (h / w) * 1.2)
    const aspect = w / h
    Object.assign(this.camera, { left: (-view * aspect) / 2, right: (view * aspect) / 2, top: view * 0.6, bottom: -view * 0.4 })
    this.camera.updateProjectionMatrix()
  }

  private setState(s: GameState) {
    this.state = s
    this.events.onState(s)
  }
}
