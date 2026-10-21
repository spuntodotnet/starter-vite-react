/**
 * Everything that makes the game feel the way it does. Change a number, save,
 * and the page reloads the game with it — no restart, no rebuild.
 */
export const config = {
  /** How fast a block slides, in units per second. */
  speed: 5,
  /** How much faster it gets with each block placed. */
  speedRamp: 0.12,
  /** How far a block travels from the tower before coming back. */
  range: 4.5,
  /** Width and depth of the first block. */
  baseSize: 3,
  /** Height of every block. */
  blockHeight: 0.42,
  /** How close to the block below counts as "perfect" (no cut, combo +1). */
  perfect: 0.12,
  /** From this many perfects in a row, each one grows the block back a little. */
  comboToGrow: 3,
  grow: 0.12,
  /** Colour of the first block (a hue, 0–360), and how it shifts block after block. */
  hueStart: 150,
  hueStep: 6,
  saturation: 72,
  lightness: 52,
}

// A change here restarts the game with the new numbers: the page reloads rather than swapping
// modules under a game that is already running with the old ones.
if (import.meta.hot) import.meta.hot.accept(() => window.location.reload())
