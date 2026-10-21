import { useEffect, useRef, useState } from "react"
import { StackGame, type GameState } from "./game/stack"

const BEST = "stack-best"

export default function App() {
  const host = useRef<HTMLDivElement>(null)
  const game = useRef<StackGame | null>(null)
  const [score, setScore] = useState(0)
  const [state, setState] = useState<GameState>("ready")
  const [perfect, setPerfect] = useState(0)
  const [best, setBest] = useState(() => Number(localStorage.getItem(BEST)) || 0)

  useEffect(() => {
    const g = new StackGame(host.current!, {
      onScore: (s, p) => {
        setScore(s)
        if (p) setPerfect((n) => n + 1)
        setBest((b) => {
          const next = Math.max(b, s)
          localStorage.setItem(BEST, String(next))
          return next
        })
      },
      onState: setState,
      // The sky follows the tower's colour.
      onHue: (h) => document.documentElement.style.setProperty("--hue", String(h)),
    })
    game.current = g
    const key = (e: KeyboardEvent) => {
      if (e.code === "Space" || e.code === "Enter") {
        e.preventDefault()
        g.tap()
      }
    }
    window.addEventListener("keydown", key)
    return () => {
      window.removeEventListener("keydown", key)
      g.dispose()
    }
  }, [])

  return (
    <main className="stage" onPointerDown={() => game.current?.tap()}>
      <div ref={host} className="canvas" />
      <header className="hud">
        {state === "ready" ? (
          <>
            <h1 className="title">Stack</h1>
            <p className="hint">Click, tap or press space to drop each block. Line them up perfectly to keep them whole.</p>
          </>
        ) : (
          <>
            <div key={perfect} className={`score ${perfect ? "pop" : ""}`}>{score}</div>
            <div className="best">{state === "over" ? `best ${best} · click to build another` : `best ${best}`}</div>
          </>
        )}
      </header>
      <footer className="foot">
        running in a sandbox — edit <code>src/config.ts</code> and save
      </footer>
    </main>
  )
}
