# GENESIS — The Living Lab
## Public observatory and experiment documentation

**Experiment 001 — An autonomous artificial ecosystem**

> A world that keeps living when nobody is watching.

Genesis is an educational artificial-life simulation. A world of small digital organisms unfolds according to simple rules: finding food, consuming energy, encountering predators, reproducing and passing inherited characteristics to offspring. The system is deterministic for a fixed initial seed and sequence of rules. It is a simplified experiment, **not** a scientifically validated ecological model or a claim about consciousness.

### Visitor experience

The observer page intentionally reads more like a digital natural-history observatory than an admin console:

1. **Introduction** — a concise explanation of what is being observed, with a clear statement that the visitor cannot influence the world.
2. **Live habitat** — 900×540 map showing grazing organisms as circles, predators as triangles, food as golden particles and three distinct biomes.
3. **Creature observer** — selecting a living organism reveals energy, age, inherited speed, vision, efficiency, generation and parent.
4. **Telemetry** — population, grazer/predator counts, food, births, deaths, latest generation and average energy.
5. **Temporal charts** — one shared time selection for population, species, food, energy and generational distribution.
6. **Expandable methodology** — how the rules work, what measurements mean, when archives begin, and limitations.

The introduction should make the science understandable without implying that the algorithm has consciousness or a human-like purpose. No visitor controls for pausing, resetting, accelerating, altering food or injecting organisms exist.

### Simulation rules — what is real within this model?

- Organisms have an energy store, age, species and a genome containing movement speed, vision, metabolic efficiency and color.
- Grazers look for food, and attempt to flee predators when they detect one.
- Predators chase grazers and gain energy by catching prey.
- Both species spend energy to survive and move.
- Creatures with sufficient energy can reproduce. Traits pass to offspring with mutations.
- Three regions have different food availability and energy costs.
- A creature can die from energy depletion, predation or its maximum modeled age.
- The pseudorandom generator is seeded, making controlled runs reproducible.

These rules describe the implementation; outcomes are *observations*, not predetermined achievements. See [GENESIS.md](./GENESIS.md) for experimental protocol and selection-method caveats.

### Measurements

| Label | Meaning |
| --- | --- |
| Population | Number of living organisms at observation time |
| Grazers / Predators | Living members of each species |
| Births / Deaths | Cumulative events since this world was initialized |
| Food | Count of food particles currently available |
| Generation | Largest generation index among currently living organisms |
| Mean energy | Arithmetic average of energy stored by currently living organisms, in simulation units (not percent) |
| Energy distribution | Counts of living organisms grouped into energy intervals 0–20, 20–40, 40–60, 60–80, 80–100 and 100+ |
| Generations alive | Counts in generation bands 0, 1–2, 3–5 and 6+ |

An empty population can have zero mean energy by definition in the engine. “Extinction” should not be inferred from a single drop in any one chart. Parent IDs describe lineage links; a selected creature's parent may no longer be alive.

### Historical data

The living-world API updates continuously. The independent observer on the Proxmox host is **intended** to save one compact SQLite sample every **15 minutes**. It does not save a full world checkpoint and does not affect the world tick.

The shared timeline ranges are:
- **1 hour:** 15-minute observations (temporary browser preview is used when there is no archive yet)
- **1 day:** hourly buckets of actual observations
- **1 week:** six-hour buckets
- **1 month:** one-day buckets
- **1 year:** three-day buckets

Aggregated periods use averages of the **observations actually recorded** within each bucket. They are not a continuous historical replay. Missing samples remain missing. Longer-range plots become meaningful only after data has accumulated.

A future daily public report may summarize longer-term patterns. Sampling on the host and publishing to a GitHub data branch are separate deployments; the latter is not enabled simply by opening the website.

### Implementation boundaries

Data flow:

```text
Genesis VM 220 (isolated vmbr220)
    └─ Node.js runner on VM loopback:8095 [GET /state, GET /health]
          ↓ localhost tunnel using SSH from Proxmox host
Proxmox host loopback:18095
    ├─ host-side 15-minute observer → local SQLite history
    └─ read-only Python web viewer loopback:3000
          ├─ GET /api/state
          ├─ GET /api/health
          ├─ GET /api/history?range=1h|1d|1w|1m|1y
          └─ GET / (static observatory interface)
```

The web viewer does not have a write endpoint. The virtual machine is not attached directly to the LAN bridge. A publicly accessible deployment for `livelab.neutry.pl` requires a separate review of the Cloudflare Tunnel, access controls, rate limiting and network firewall; the current localhost-only viewer should **not** be assumed safe for unrestricted public publication merely because it is read-only.

The visual dashboard deliberately avoids adding any frontend framework, external chart library, tracking service or remote font. Canvas rendering, HTML and JavaScript are delivered as a static asset by a lightweight Python HTTP service.

### Operation and validation

All website changes are developed through pull requests. Changing the website does not restart or reset the Genesis VM. Observer documentation is not evidence that a timer was deployed; verify it on the host.

Checklist before opening the website to the public:

- Verify `genesis.service` healthy without triggering a restart.
- Verify the SSH data tunnel and the read-only dashboard service healthy.
- Verify a real 15-minute sample exists in the archive and the next timer run occurs.
- Verify the five timeline selections and behavior when no archive exists.
- Verify organism selection, mobile layout and accessibility of explanatory text.
- Verify the UI does not claim to show earlier data than was recorded.
- Review read-only proxy, network/firewall and Cloudflare access controls.
- Keep world checkpoints and backup procedures independent of public-web deployment.

### Project language and positioning

**Name:** GENESIS · The Living Lab  
**Positioning:** Open digital ecology experiment / live observation, not a controllable game or AI-consciousness exhibit.  
**Audience:** Curious visitors, makers, students and people interested in emergent behavior.  
**Principle:** Observe without interfering.

Suggested short public description:

> Genesis is a living artificial ecosystem running continuously on an isolated machine. Creatures compete for resources, survive, reproduce and pass on their traits. Explore the world and its history as an observer — its future belongs to the rules, not to the viewer.
