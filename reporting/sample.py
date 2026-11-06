#!/usr/bin/env python3
"""Record a 15-minute, read-only observation of the running Genesis world.

Runs on the Proxmox host, never inside the simulation VM.
No credentials, writes to simulation, or control API calls.
"""
import argparse
import json
import math
import sqlite3
from datetime import datetime, timezone
from pathlib import Path
from urllib.request import urlopen

DEFAULT_API = "http://127.0.0.1:18095/state"
DEFAULT_DB = Path("/var/lib/genesis-reports/history.sqlite3")

SCHEMA = """
CREATE TABLE IF NOT EXISTS observations (
 slot INTEGER PRIMARY KEY,
 observed_at TEXT NOT NULL,
 tick INTEGER NOT NULL,
 population INTEGER NOT NULL,
 generation INTEGER NOT NULL,
 grazers INTEGER NOT NULL,
 predators INTEGER NOT NULL,
 food INTEGER NOT NULL,
 births INTEGER NOT NULL,
 deaths INTEGER NOT NULL,
 average_energy REAL NOT NULL,
 energy_bins TEXT NOT NULL,
 generation_bins TEXT NOT NULL
);
"""


def capture(state, at):
    if not isinstance(state, dict) or not isinstance(state.get("world"), dict) or not isinstance(state.get("stats"), dict):
        raise ValueError("Invalid Genesis API response")
    stats = state["stats"]
    organisms = state["world"].get("organisms")
    if not isinstance(organisms, list) or len(organisms) > 10000:
        raise ValueError("Invalid organism collection")
    integer_keys = ("tick", "population", "generation", "grazers", "predators", "food", "births", "deaths")
    for key in integer_keys:
        value = stats.get(key)
        if type(value) is not int or value < 0:
            raise ValueError("Invalid field: " + key)
    avg = stats.get("averageEnergy")
    if type(avg) not in (float, int) or not math.isfinite(avg):
        raise ValueError("Invalid mean energy")
    if stats["population"] != len(organisms):
        raise ValueError("Population does not match living organisms")
    energy_bins = [0] * 6
    generation_bins = [0] * 4
    for organism in organisms:
        energy = organism.get("energy")
        generation = organism.get("generation")
        if type(energy) not in (float, int) or not math.isfinite(energy) or type(generation) is not int or generation < 0:
            raise ValueError("Invalid organism telemetry")
        energy_bins[max(0, min(5, int(energy // 20)))] += 1
        generation_bins[0 if generation == 0 else 1 if generation <= 2 else 2 if generation <= 5 else 3] += 1
    return {
        "slot": (int(at.timestamp()) // 900) * 900,
        "observed_at": at.isoformat().replace("+00:00", "Z"),
        **{k: stats[k] for k in integer_keys},
        "average_energy": float(avg),
        "energy_bins": json.dumps(energy_bins, separators=(",", ":")),
        "generation_bins": json.dumps(generation_bins, separators=(",", ":")),
    }


def fetch_state(api=DEFAULT_API):
    with urlopen(api, timeout=8) as response:
        raw = response.read(16 * 1024 * 1024 + 1)
    if len(raw) > 16 * 1024 * 1024:
        raise ValueError("API response too large")
    return json.loads(raw)


def store(path, record):
    path.parent.mkdir(parents=True, exist_ok=True, mode=0o755)
    with sqlite3.connect(path, timeout=15) as db:
        db.execute(SCHEMA)
        keys = tuple(record)
        sql = ("INSERT OR IGNORE INTO observations (" + ",".join(keys) +
               ") VALUES (" + ",".join("?" for _ in keys) + ")")
        cursor = db.execute(sql, tuple(record.values()))
    # Dashboard service user 'nobody' needs read-only access to history.
    path.chmod(0o644)
    return cursor.rowcount == 1


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--api", default=DEFAULT_API)
    parser.add_argument("--db", type=Path, default=DEFAULT_DB)
    args = parser.parse_args()
    record = capture(fetch_state(args.api), datetime.now(timezone.utc))
    inserted = store(args.db, record)
    print(("Recorded" if inserted else "Already recorded") +
          f" 15-minute slot {record['slot']} tick={record['tick']}")


if __name__ == "__main__":
    main()
