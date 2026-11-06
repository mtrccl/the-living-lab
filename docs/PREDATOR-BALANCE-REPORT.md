# Predator viability — offline benchmark (2026-11-06)

## Decision: no parameter set is ready for Experiment 003

This research used the **actual deterministic Genesis engine** in GitHub
Actions, without modifying VM 220, checkpoints or the live simulation.

All trials started with 32 organisms (5 predators, 27 grazers) and ran for
3,000 simulation ticks. Each configuration used the same 10 seeds:
`11, 23, 37, 42, 83, 101, 211, 307, 409, 503`.

**Result: 0/170 worlds retained any living predator at tick 3000.**
The population usually died out much earlier; stronger hunting sometimes
caused temporary predator booms, not sustained coexistence.

The numbers below are simulation parameters, **not empirically validated
biological constants**.

| Group | Parameter variations | Predator persistence at tick 3000 |
|---|---|---|
| 1 (50 trials) | Original cost 0.16, capture radius 8; cost 0.05; capture radius 12; both changes; cost 0 + radius 14 | 0/50 |
| 2 (60 trials) | Radius 20/30/40 with 0.05 cost; speed multiplier 1.5 and radius 15/25; speed 2 and radius 20 | 0/60 |
| 3 (60 trials) | Startup energy 120–140, reduced prey detection 0.3–0.6, kill rewards 65–100, radius 12–20, speed up to 1.5 | 0/60 |

Temporary predator peaks reached **117** in the strongest combination,
but that world also lost all predators before 3,000 ticks. More hunting
power is not necessarily the same as a stable food web.

### Auditable runs

- Group 1 (CI): https://github.com/mtrccl/the-living-lab/actions/runs/42249589137
- Group 2 (CI): https://github.com/mtrccl/the-living-lab/actions/runs/42249819387
- Group 3 (CI): https://github.com/mtrccl/the-living-lab/actions/runs/42250174247
- PR: https://github.com/mtrccl/the-living-lab/pull/14

The benchmark's `ECOLOGY_BENCHMARK` and `ECOLOGY_SEEDS` lines in each
run record aggregate and per-seed outcomes. Earlier batches are retained
in GitHub commit history; the current benchmark test contains group 3.

### Source of the parameters

These parameters originated in the project's own implementation
(`src/engine.ts`, `src/behavior.ts`). They were heuristic modeling
choices, not calibrated against field observations or literature.
The new optional fields in this research branch preserve the existing
defaults unchanged and are **not deployed**.

### Interpretation and limitations

These outcomes establish failure across the **tested seeds, rules,
ranges and horizon**. They do not prove coexistence is mathematically
impossible for every configuration, or identify the exact causal mechanism.
Several processes might contribute: low predator founder population,
prey fleeing before predator interception, predator energetics, rapid
predator reproduction and subsequent shortage of reachable prey.

The largest predator populations are not a useful optimization target:
they may precede boom–bust extinction. Merely increasing capture radius,
speed, energy reward or starting reserves did not produce sustained
survival in these trials.

### Recommended next model iteration

Before launching a replacement Experiment 003:

1. Add predator-specific telemetry to the engine: successful hunts per
   predator, hunter energy before/after encounters, predator births,
   predator deaths by starvation and age, and prey density by habitat.
2. Test structural ecological changes **individually**, for example
   spatial refuge, prey recruitment, predator pursuit/escape dynamics
   and density-sensitive reproduction; do not secretly respawn predators.
3. Test a broader seed set and multiple horizons (including >=10,000
   ticks), and preserve a meaningful nonzero chance of extinction.
4. Establish an explicit acceptance criterion before selecting parameters:
   a substantial fraction of seeds maintain both species while grazers
   and predators remain bounded and do not trend to extinction.
5. Only then archive Experiment 002 and run Experiment 003. Keep
   public dashboard read-only and label the experiment revision.

**Do not merge the research changes into production unreviewed.**
