# The Living Lab — GENESIS v1.0

An interactive, deterministic artificial-life experiment. Organisms seek food, consume energy, reproduce with inherited mutations and compete for limited resources.

## Quick start

Requires Node.js 20.19+ or 22.12+.

```sh
npm install
npm run dev
npm test
npm run build
```

## Features
- Seeded deterministic engine with food, movement, energy, mutation, reproduction and death.
- Four scenario presets, live environmental sliders, pause, step, speed and reset.
- Telemetry and population chart.
- Local JSON export/import of complete world state.
- Responsive dark interface, unit tests and no API keys or external services.

## Architecture
React + TypeScript + Vite; pure simulation in `src/engine.ts`, interface in `src/main.tsx`, model tests in `src/engine.test.ts`. See `docs/GENESIS.md` for the research protocol and limitations.

## License
MIT (see LICENSE).
