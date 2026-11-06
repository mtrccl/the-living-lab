# Experiment 001 — Genesis

## Hypothesis
Simple rules for energy, food, inherited variation and bounded resources can produce measurable population changes without a central planner.

## Protocol
1. Run Primordial soup for 1000 ticks; record population, births, deaths and generation.
2. Reset to Scarcity, run 1000 ticks and compare.
3. Repeat with Mutation storm; compare results across seeds.
4. Export and restore a snapshot; compare deterministic continuations.

These are hypotheses, not predetermined findings.

## Design
Deterministic xorshift32 random stream; browser-only simulation; Canvas rendering; local JSON snapshot export. No telemetry, API keys, cloud services or paid infrastructure.

## Limitations
Educational toy model, not scientifically validated biology or sentient life. The v1 simulation runs on the main browser thread; a dedicated Web Worker is a future optimization. Snapshot imports receive basic validation only. The chart shows rendered frames, not every tick.

## Genesis 1.1 — Emergence

Three horizontal biomes (fertile, arid, extreme) introduce differing metabolic costs and food growth probabilities. Grazers seek plants; predators pursue living grazers and gain energy on capture. Species is inherited; every child stores its parent's ID. Selecting an organism in the habitat opens its live genome and ancestry information. The discovery gallery stores selected genome records in browser localStorage (up to 60) and supports JSON export and deletion.

### Experimental caution

This is an intentionally simplified predator-prey model. It does not implement biological realism, gene-driven behavior trees, a complete family tree, or validated ecology. The gallery is browser-local and is not uploaded. The first version still runs its simulation on the main thread; performance is limited at high population/speed settings.

## Repeatable evolution experiments

`src/experiments.ts` exposes `runExperiment(seed, ticks, config)` and `runBatch(seeds, ticks, config)`. Each seed starts an independent world. The browser offers a five-seed comparison at 300 ticks; the batch API supports 1–500 seeds and up to 100,000 ticks per run. It reports survival rate, mean population, generation, and average trait changes. The engine is deterministic for fixed inputs. Trait changes alone do **not** establish adaptive evolution; proper selection studies require controls, replicates and statistical analysis. Large batches should be run offline rather than on the UI thread.

## Genesis v1.2 — behavioral selection (first increment)

Grazers now prioritize fleeing the nearest predator inside their inherited vision radius, then seek food. Predators pursue visible grazers. With no visible target, organisms wander. All steering decisions are deterministic for a fixed world state and random seed. This creates a measurable survival trade-off between vision, movement speed, and energy efficiency, but does not by itself establish long-term adaptation. Multi-generation lineage visualization and controlled selection experiments remain future work.

## Persistent genealogy

Each world records founding organisms and offspring with immutable parent identifiers, generation, inherited genome, birth tick and optional death tick. Dead ancestors remain in the world history and JSON snapshot. The observer shows a selected organism's ancestry (up to twelve generations). Legacy snapshots without lineage restore a partial history containing only organisms alive at import time; earlier ancestors cannot be reconstructed. The lineage log grows with births, so long-running persistent worlds will need retention and archival policies before deployment.
