# Experiment 004 — initial diagnosis and research decision

## Experiment 003 reproduced exactly

GitHub Actions run: https://github.com/mtrccl/the-living-lab/actions/runs/42475830658

The existing Genesis engine on `main` was run with **exact production seed 303** and its exact Experiment 003 configuration, without accessing or changing the live VM. The test continued until extinction. Its endpoint matched the screenshot and sample-log totals:

- Final tick **30,317**
- Births **11,239**, deaths **11,271**
- Last grazer died at tick **29,619**
- Last predator died at tick **30,317**
- Food reached its cap of **750**
- At tick 29,000: **17 grazers**, **8 predators**, **366 food**
- At tick 30,000: **0 grazers**, **13 predators**, **750 food**

This is deterministic reproduction of the observed event, not an unrelated parameter experiment. The runner previously captured the world at tick 24,448 with 69 grazers / 11 predators and at tick 33,423 with zero population; the reproduced run identifies the exact extinction ticks between those 15-minute observations.

## What the evidence does and does not show

**Established:** Grazers disappeared first. Predator extinction followed 698 ticks later. Grazers declined sharply even as food availability increased. This rules out a simplistic explanation that no food existed globally.

**Not established yet:** Whether prey died predominantly from predation, high basal/biome metabolic cost, failure to reach geographically available food, changes in inherited traits, or the interplay of those factors.

The current engine only records birth/death lineage and does not tag cause of death (predation vs starvation vs age). A controlled instrumented variant is required to identify proximate causes, without mislabeling observational correlations as mechanisms.

## Research plan for 004

1. Archive Experiment 003 checkpoint and 15-minute observation DB intact, including `lineage`; use `ops/close-experiment-003.sh` on `pve` manually. The archive script disables the service and sampler, preserving VM 220, and does **not** start Experiment 004.
2. Add *offline, test-only* death-cause and predation diagnostics with counters for predator kills, energy starvation, maximum-age deaths, and prey accessibility by biome. Keep existing deterministic outcomes unchanged.
3. Replay seed 303 with instrumentation to locate the mechanisms that killed the final prey.
4. Compare structural changes (e.g. prey refuge / pursuit cost / local food access) **one change at a time** and verify across multiple unseen seeds, >=100,000 ticks, plus food-rate sensitivity. Do not resurrect extinct species, and do not optimize solely for maximum predator numbers.
5. Only after reviewing those results select an Experiment 004 config. Archive verification and a dedicated launch procedure will be separate from parameter research.

## Deployment guardrail

No GitHub PR in this research branch has changed the host or guest. Do not use a script to auto-start Experiment 004, and do not restart Experiment 003. The production experiment is recorded as an ecological extinction, not a process crash.

## Instrumented cause-of-death replay (verified)

Run: https://github.com/mtrccl/the-living-lab/actions/runs/42476585617

An optional, off-by-default instrumentation counter was added to the research
branch. It labels predation when the engine explicitly zeros a grazer's energy
on capture, then distinguishes energy depletion and maximum-age deaths.
Replaying seed 303 preserved the **exact** extinction ticks of the original
world, verifying that instrumentation did not change this deterministic
trajectory.

Across all 30,317 ticks:
- Grazer deaths from predation: **7,443**
- Grazer deaths from energy exhaustion: **3,597**
- Grazer deaths from maximum age: **1**
- Predator deaths from energy exhaustion: **119**
- Predator deaths from maximum age: **111**

From tick **28,001 through 30,317**, when the population collapsed:
- Grazer deaths from predation: **566**
- Grazer deaths from energy exhaustion: **149**
- Grazer deaths from age: **0**
- Predator deaths from energy exhaustion: **23**
- Predator deaths from age: **10**

At tick 28,000 the average energy of living grazers was ~**56.88**. The
prey population fell despite global food later reaching its cap.
These outcomes show predation was the **dominant recorded immediate cause
of grazer death** in the terminal period; they do not imply that predation
was the only factor (spatial food access and energy stress remain relevant).

### Implications for the next model

The previous `predatorMinPreyRatio` gates **predator births** using a
single start-of-tick prey count, but it does not gate hunting; existing
predators can continue capturing dwindling prey. This helps explain why
reproduction regulation did not prevent prey depletion.

Experiment 004 research will compare:
- Spatial prey refuges / differentiated habitat accessibility, allowing
  prey to escape into locally safer regions without forcibly reviving them
- Local rather than purely global encounter rules
- Predator search efficiency and the cost of pursuit under low prey density
- Sensitivity across novel seeds and at least 100,000 ticks

Any changes must preserve determininism, conservation of births/deaths,
checkpoint compatibility, and a nonzero chance of ecosystem extinction.
No new live experiment has been launched.

## Experiment 004 research completed — parameter selection

All tests executed with the actual deterministic engine via GitHub Actions
without touching the archived Experiment 003 or the stopped Genesis VM.

### Root cause verification

Experiment 003's seed 303 is reproducible exactly: grazers become extinct at
tick **29,619**, predators at **30,317**. Instrumented telemetry classified
terminal grazer deaths from tick 28,001 to extinction: **566 predation,
149 energy depletion**. In the old model, a predator in capture range
automatically killed its prey; the reproduction ratio constrained births,
not hunting by existing predators.

### Options rejected

- Pure spatial prey refuge 160 units: **5/8** coexist at 40,000 ticks;
  refuge 280 units: **3/8**. Baseline Experiment 003: **4/8**.
  https://github.com/mtrccl/the-living-lab/actions/runs/42476964618
- Constant capture probability 0.6: **2/12** coexist at 100,000 ticks;
  constant 0.4: **0/12**.
  https://github.com/mtrccl/the-living-lab/actions/runs/42477342084

These results show that neither a static refuge nor fixed failed-attack
rate alone solves prolonged coexistence.

### Selected mechanism — prey-density-dependent hunting

The effective capture chance for an in-range predator is

```text
effectiveChance = predatorCatchChance *
                  min(1, livingGrazers / predatorScarcityThreshold)^2
```

This is a simple density-dependent encounter model: when prey become
scarce, the effective probability of successful capture declines.
It never creates organisms and does not guarantee survival.
The numbers describe an artificial ecosystem, not calibrated biological
field measurements.

Compatibility: `predatorScarcityThreshold=0` and
`predatorCatchChance=1` preserve the previous deterministic behavior
exactly. The seeded 003 retrospective remains unchanged.

### Screening

Eight seeds, 40,000 ticks:
- Scarcity threshold 50, maximal capture chance 1: **8/8** coexist
- Scarcity threshold 75, maximal capture chance 1: **7/8**
- Scarcity threshold 100, maximal capture chance 1: **8/8**
- Threshold 75 and maximal chance .8: **8/8**

Run: https://github.com/mtrccl/the-living-lab/actions/runs/42477637600

### Independent 100,000-tick validation

Ten new seeds, including proposed 004 seed `404`:

| Model | Both species alive at 100,000 |
|---|---:|
| Scarcity threshold 50, maximal chance 1 | **3/10** |
| **Scarcity threshold 100, maximal chance 1** | **9/10** |
| Scarcity threshold 75, maximal chance .8 | **9/10** |

Proposed seed 404 retained **34 grazers and 14 predators** after
100,000 ticks in the selected threshold-100 model. In one different
seed the two species did go extinct near tick 99,000. This remains a
stochastic-looking but deterministic seeded world; extinction is still
possible.

Run: https://github.com/mtrccl/the-living-lab/actions/runs/42477828748

### Resource sensitivity (60,000 ticks)

Eight additional seeded worlds at each food rate:

| Food rate | Compared with default | Both species at 60,000 |
|---|---:|---:|
| 2.0 | −20% | **7/8** |
| **2.5** | baseline | **8/8** |
| 3.0 | +20% | **7/8** |

Run: https://github.com/mtrccl/the-living-lab/actions/runs/42478384836

These are empirical statistics *inside the simulation*. They do not
guarantee indefinite viability or apply to actual ecology.

### Experiment 004 selected configuration

The world should start new with seed **404** and this configuration:

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
  "predatorBirthEnergy": 120,
  "preyRefugeWidth": 0,
  "predatorCatchChance": 1,
  "predatorScarcityThreshold": 100
}
```

The optional refuge mechanism is deliberately disabled for Experiment
004 because its initial comparative performance was inferior.

### Manual launch procedure and safeguards

`ops/start-experiment-004.sh` on the Proxmox host `pve`:

- Requires Experiment 003 to be closed (`active-experiment.txt` =
  `003-closed`) and the Genesis runner stopped and disabled.
- Verifies existing Experiment 003 archive checksums and history DB.
- Compiles and syntax-checks the current engine in a staging folder
  on isolated VM 220 using built-in Node.js TypeScript stripping.
- Runs a 100-tick deterministic checkpoint-restore smoke test.
- Installs updated runner and engine code with readable permissions.
- Configures a fresh 004 checkpoint and seed 404, without touching 003.
- Moves the old active history DB into the preserved Experiment 003
  archive and creates a **separate** 004 history from its initial tick.
- Enables the service and 15-minute observer only after checks.
- Verifies the fresh seed and configuration through the read-only API.

**Never rerun after any failure following activation.** Inspect service
state, history and checkpoint first to avoid accidental replacement.

### Re-running heavy research tests

The 60k ecology screen is opt-in, so day-to-day CI does not repeatedly
execute millions of simulation steps:

```bash
GENESIS_STRESS_TEST=1 npx vitest run src/experiment-004-screen.test.ts
```

The complete 100k and resource-sensitivity execution records remain in
the linked GitHub Actions jobs. No public deployment is included.
