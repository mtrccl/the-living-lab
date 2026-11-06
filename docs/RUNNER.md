# Genesis Persistent World — initial local runner

Status: **implementation in repository only**. No LXC, VM, public endpoint or deployment.

## Run locally

```sh
npm ci
npm run build
npm run start:runner
```

The runner listens only on `127.0.0.1:8095` and exposes read-only `GET /health` and `GET /state`. Set `GENESIS_PORT`, `GENESIS_TICK_MS`, `GENESIS_SAVE_MS`, `GENESIS_CHECKPOINT`, or `GENESIS_SEED` through environment variables. The world advances only while the process is running; downtime is not replayed.

The runner saves a versioned JSON checkpoint at `./data/world.json` by default. It writes and syncs a temporary file, backs up the previous checkpoint to `.bak`, then atomically renames the temporary file. It saves periodically and on SIGTERM/SIGINT. Existing corrupt or incompatible checkpoints **block startup** instead of silently resetting the ecosystem.

## Limitations before deployment

- This is a first local prototype, **not** a verified 24/7 deployment.
- Runner integration, crash/restart, disk-full and backup recovery tests remain necessary.
- The current `/state` response includes the full world; before any public exposure, add a bounded viewer-specific API, access controls, and retention limits.
- Long-running genealogy and snapshots grow with births; add archival or compaction policy.
- The browser currently runs its own world and is not yet a live remote viewer.
- Production updates need explicit migrations and tested rollback procedures.

No Proxmox configuration changes are included.
