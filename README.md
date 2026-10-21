# Stack — a Vite + React + three.js starter

A small 3D game: blocks slide over the tower, you drop them, whatever overhangs falls off. Line
one up perfectly and it stays whole. Before the first click, the tower builds itself.

It is the starter [Spunto](https://spunto.net)'s welcome screen clones into a fresh sandbox — by
its public URL, no git account needed — and serves while you watch.

```bash
npm install
npm run dev     # http://localhost:5173 — in a Spunto sandbox, its port 5173 URL
```

## Make it yours

Everything that makes it feel the way it does is in [`src/config.ts`](src/config.ts): speed, how
much faster it gets, block size, what counts as perfect, the colours. Change a number, save, and
the page reloads the game with it.

- `src/game/stack.ts` — the game: three.js scene, rules, falling pieces, camera.
- `src/App.tsx` — the score and the words around it (React).

`vite.config.ts` opens the dev server to the sandbox's public port URL (`host`, `allowedHosts`);
nothing else here knows about Spunto.
