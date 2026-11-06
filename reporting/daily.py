#!/usr/bin/env python3
"""Observe Genesis through its read-only API and create daily local reports.

No code in this script modifies the world, restarts the engine, or publishes
anything online. Designed to run on the Proxmox host through the existing
loopback-only SSH forward (127.0.0.1:18095).
"""
import argparse
import json
import os
from datetime import datetime, timezone
from pathlib import Path
from tempfile import NamedTemporaryFile
from urllib.request import urlopen

STAT_FIELDS = ("tick", "population", "generation", "grazers", "predators",
               "food", "births", "deaths", "averageEnergy")
COUNTERS = ("births", "deaths")
DEFAULT_API = "http://127.0.0.1:18095/state"


def fetch_state(url=DEFAULT_API):
    with urlopen(url, timeout=8) as response:
        if response.status != 200:
            raise ValueError(f"API status {response.status}")
        raw = response.read(16 * 1024 * 1024 + 1)
    if len(raw) > 16 * 1024 * 1024:
        raise ValueError("World state exceeds size limit")
    data = json.loads(raw)
    if not isinstance(data, dict) or not isinstance(data.get("stats"), dict):
        raise ValueError("Invalid response: missing stats")
    stats = data["stats"]
    if any(not isinstance(stats.get(k), (int, float)) or
           isinstance(stats[k], bool) for k in STAT_FIELDS):
        raise ValueError("Invalid numeric telemetry")
    if any(not isinstance(stats[k], int) or stats[k] < 0 for k in
           ("tick", "population", "generation", "grazers", "predators",
            "food", "births", "deaths")):
        raise ValueError("Invalid counter")
    return {k: stats[k] for k in STAT_FIELDS}


def load_previous(path):
    if not path.exists():
        return None
    previous = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(previous, dict) or not isinstance(previous.get("metrics"), dict):
        raise ValueError("Prior report is invalid; refusing to overwrite it")
    return previous


def create_report(stats, previous=None, at=None):
    now = at or datetime.now(timezone.utc)
    result = {
        "schema_version": 1,
        "generated_at": now.isoformat().replace("+00:00", "Z"),
        "source": "Genesis read-only /state API",
        "metrics": stats,
        "since_previous_observation": None,
    }
    if previous:
        old = previous["metrics"]
        old_tick = old.get("tick")
        if isinstance(old_tick, int) and stats["tick"] > old_tick and all(
            isinstance(old.get(k), int) and stats[k] >= old[k] for k in COUNTERS
        ):
            result["since_previous_observation"] = {
                "tick_delta": stats["tick"] - old_tick,
                "births": stats["births"] - old["births"],
                "deaths": stats["deaths"] - old["deaths"],
                "population_delta": stats["population"] - old.get("population", stats["population"]),
            }
    return result


def atomic_write(path, data):
    path.parent.mkdir(mode=0o700, parents=True, exist_ok=True)
    tmp = None
    try:
        with NamedTemporaryFile("w", encoding="utf-8", dir=path.parent,
                                prefix=".report-", suffix=".tmp", delete=False) as handle:
            tmp = Path(handle.name)
            json.dump(data, handle, indent=2, ensure_ascii=False, allow_nan=False)
            handle.write("\n")
            handle.flush()
            os.fsync(handle.fileno())
        os.replace(tmp, path)
    finally:
        if tmp is not None:
            tmp.unlink(missing_ok=True)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--api", default=DEFAULT_API)
    parser.add_argument("--output", type=Path, default=Path("/var/lib/genesis-reports"))
    args = parser.parse_args()
    at = datetime.now(timezone.utc)
    current = args.output / "latest.json"
    previous = load_previous(current)
    stats = fetch_state(args.api)
    report = create_report(stats, previous, at)
    day = args.output / (at.strftime("%Y-%m-%dT%H%M%SZ") + ".json")
    # Store dated observation first; do not overwrite a prior observation.
    if day.exists():
        raise FileExistsError(day)
    atomic_write(day, report)
    atomic_write(current, report)
    print(f"Saved {day}; tick={stats['tick']} population={stats['population']}")


if __name__ == "__main__":
    main()
