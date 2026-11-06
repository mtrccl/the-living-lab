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

## Extended research: density, energy, and long-horizon tests (2026-11-06)

**Earlier rejection of pure hunting buffs remains valid.** A structural
change to predator reproduction — permitting births only when at least a
specified number of grazers exist per predator — led to the first genuine
coexistence. Reducing predator basal metabolism further improved it.
No predator is ever respawned, and extinction remains possible.

### Reproduction density screen (10 seeds × 3,000 ticks)

- Minimum prey-to-predator ratio 3: **0/10** coexist.
- Ratio 5: **2/10**; ratio 8: **2/10**; ratio 12: **1/10**.
- With weaker prey alert, adjusted hunting and ratio 5: **8/10**.
- Ratio 10 with the same weaker prey alert: **5/10**.
- CI: https://github.com/mtrccl/the-living-lab/actions/runs/42251062810

### Metabolism and birth threshold screen (10 seeds × 3,000 ticks)

With predator birth constrained by prey density, basal metabolism set to
30–50% of the former value yielded **10/10** coexistence in several
configurations. These were *screening runs only*, not yet sufficient for
a production decision.

- CI: https://github.com/mtrccl/the-living-lab/actions/runs/42251873624

### Strict out-of-sample validation

Every listed cohort used distinct seeds that were not used to tune the
earlier configurations. *Coexistence means both grazers AND predators
were still alive at the endpoint.*

| Test cohort | Configuration | Coexistent worlds | Endpoint |
|---|---|---:|---:|
| 20 previously unseen seeds | metabolism .30, birth threshold 105, prey ratio 5 | 19/20 | 10,000 ticks |
| Same 20 seeds | metabolism .30, birth threshold 120, prey ratio 5 | 19/20 | 10,000 ticks |
| 10 further seeds | metabolism .30, birth threshold 105, prey ratio 5 | 7/10 | 20,000 ticks |
| Same 10 seeds | metabolism .30, birth threshold 120, prey ratio 5 | 8/10 | 20,000 ticks |
| Same 10 seeds, higher prey protection | metabolism .30, birth threshold 120, prey ratio 7 | **10/10** | 20,000 ticks |
| Same 10 seeds, higher prey protection | metabolism .30, birth threshold 105, prey ratio 7 | **10/10** | 20,000 ticks |
| **20 new, held-out seeds** | metabolism .30, birth threshold 120, prey ratio 7 | **20/20** | 20,000 ticks |
| Same 20 held-out seeds | metabolism .30, birth threshold 105, prey ratio 7 | 18/20 | 20,000 ticks |

Runs:
- https://github.com/mtrccl/the-living-lab/actions/runs/42252183437
- https://github.com/mtrccl/the-living-lab/actions/runs/42252552678
- https://github.com/mtrccl/the-living-lab/actions/runs/42252917031
- https://github.com/mtrccl/the-living-lab/actions/runs/42253283932

An intermediate 10,000-tick batch returned useful individual logs but
finished with a Vitest worker RPC timeout on the CI runner:
https://github.com/mtrccl/the-living-lab/actions/runs/42251372464.
Later runs yielded periodically to the event loop and passed CI;
none of the final recommendation depends on interpreting that failed
workflow as a successful check.

### 30,000-tick soak and food sensitivity

10 completely new seeds per configuration:

| Food-generation rate | Change vs. default | Both species alive at 30,000 | Mean living grazers | Mean living predators |
|---|---:|---:|---:|---:|
| **2.5** | baseline | **8/10** | 53.6 | 12.7 |
| 2.0 | −20% | **4/10** | 39.3 | 4.6 |
| 3.0 | +20% | **8/10** | 67.8 | 12.2 |

CI: https://github.com/mtrccl/the-living-lab/actions/runs/42253676945

Food scarcity can still result in ecosystem collapse. This is not
concealed: the tuned model is **not** guaranteed to sustain both species
indefinitely or under every resource condition.

### Selected candidate for Experiment 003

The **tested** configuration is:

```json
{
  "foodRate": 2.5,
  "mutation": 0.12,
  "temperature": 0.5,
  "maxPopulation": 350,
  "predatorExtraCost": 0.03,
  "predatorCatchRadius": 14,
  "predatorSpeedMultiplier": 1.5,
  "predatorInitialEnergy": 115,
  "predatorKillGain": 80,
  "grazerAlertMultiplier": 0.3,
  "predatorMinPreyRatio": 7,
  "predatorMetabolismFactor": 0.3,
  "predatorBirthEnergy": 120
}
```

**Reason for selection:** outperforming the original model in both
short- and long-horizon tests, reproducing coexistence across *all* 20
held-out 20k-tick runs. Setting birth threshold to 120 yielded 20/20 vs
18/20 for 105 in the same held-out sample. The default resource
supply was retained. All parameters remain heuristic artificial-life
rules; there are no universal biologically correct values.

### Regression and safety

The regression suite verifies that:

- Existing production defaults remain unchanged when no experiment
  parameters are supplied.
- Old checkpoints without new parameter keys still restore correctly.
- Extinct species never spontaneously return.
- Predators cannot reproduce when there are too few live prey.
- Birth/death accounting and population cap remain valid.
- A selected seeded world replays deterministically after checkpoint
  save and restoration.

No experiment has been reset and no code has been deployed to VM 220.
The results propose **an Experiment 003 candidate**, not a modification
to any earlier experiment. A new experiment must be initialized with
these parameters explicitly, after archiving the preceding world.

### Statistical limitations

A 20/20 result is not evidence of certain survival. Even under the
default food rate, 2/10 completely new 30k-tick worlds eventually
lost coexistence. Deterministic seeds permit repeatability but do not
create independent biological observations or validate real-world
ecology. Larger seed sets, longer horizons and further food sensitivity
analysis remain useful if stronger guarantees are desired.
