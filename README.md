# Vite + React starter

A minimal [Vite](https://vite.dev) + React + TypeScript app — the "Vite + React" starter of
[Spunto](https://spunto.net)'s welcome screen, which clones it into a fresh sandbox and runs it.

```bash
npm install
npm run dev     # http://localhost:5173 — in a Spunto sandbox, its port 5173 URL
```

Edit `src/App.tsx`, save, and the page updates. Nothing here is specific to Spunto beyond
`server.host` / `allowedHosts` in `vite.config.ts`, which let the dev server answer on the
sandbox's public port URL.
