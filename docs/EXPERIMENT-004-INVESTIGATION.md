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
