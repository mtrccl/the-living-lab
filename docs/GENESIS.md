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
