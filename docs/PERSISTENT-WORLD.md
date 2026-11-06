# Genesis Persistent World — architecture proposal

Status: design only. **No daemon, server, hosting, deployment, or paid service has been enabled.**

## Goal

Keep one evolving ecosystem alive on an owner-controlled mini PC even when no browser is open. Clients are viewers and operators, not owners of simulation state.

## Boundaries

- **Engine**: deterministic `World` simulation, independently testable, with explicit schema version and migration functions.
- **Runner**: single Node.js process owning the current world, stepping it on a monotonic clock. A restart does not advance missed time by default; downtime is recorded separately.
- **Persistence**: checkpoint on configurable cadence (suggested 60 seconds) and before controlled shutdown/deploy. Write to a temporary file, flush, then atomically rename; retain multiple generations and verify checksums.
- **Read-only API**: exposes a bounded world view, stats and history. Browser cannot overwrite simulation state. Remote access and authentication must be designed before any public exposure.
- **Viewer**: existing React UI subscribes to snapshots rather than running its own world when connected. Local sandbox mode remains available.
- **Gallery**: browser-local discoveries initially; shared gallery requires explicit design and consent for server-side storage.

## Update contract

1. Stop accepting new simulation commands and pause the runner.
2. Write and validate a versioned checkpoint, plus an immutable backup.
3. Deploy updated engine/runner binaries.
4. Migrate checkpoint to the new schema **without modifying the backup**.
5. Validate invariants (IDs, counts, finite coordinates, genome bounds, RNG state).
6. Resume from exactly the saved tick. If migration or startup fails, roll back binaries and checkpoint.

Never silently start a new world when an existing checkpoint is corrupt or incompatible. Fail closed and require explicit recovery or reset.

## Testing before 24/7 operation

- Deterministic replay from identical seeds and checkpoints.
- Interrupted checkpoint writes and corrupted/oversized files.
- Process crash, restart and idempotent recovery.
- Migration from each supported snapshot schema.
- Deploy rollback without losing organism ancestry.
- Performance at population caps and multi-day accelerated simulations.
- Graceful shutdown, disk-full behavior and retention limits.

## Operational guardrails

Deployment requires separate owner approval. No cloud hosting, GitHub Pages, paid infrastructure, public endpoint, or mini-PC configuration changes are included in this proposal. An unattended service must not be claimed as working until it has passed real restart and recovery tests.
