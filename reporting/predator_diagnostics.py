#!/usr/bin/env python3
"""Read-only one-hour Genesis telemetry: 60 one-minute samples.

Runs on the Proxmox host, not inside VM 220. Never writes to the simulation.
Keeps the existing 15-minute SQLite sampling untouched.
"""
import argparse
import csv
import json
import math
import os
import signal
import time
from datetime import datetime, timezone
from pathlib import Path
from urllib.request import urlopen

URL = "http://127.0.0.1:18095/state"
COLUMNS = (
    "timestamp_utc", "tick", "population", "grazers", "predators",
    "food", "births", "deaths", "generation", "mean_energy",
    "grazer_mean_energy", "predator_mean_energy", "predator_min_energy",
    "predator_mean_age", "predator_mean_speed", "predator_mean_vision",
    "predator_mean_efficiency", "predators_with_prey_in_vision",
    "predators_with_prey_within_8", "predators_with_prey_within_12",
    "total_grazer_energy", "total_predator_energy",
)
STOP = False


def stop(_signal, _frame):
    global STOP
    STOP = True


def mean(values):
    return round(sum(values) / len(values), 4) if values else ""


def capture():
    with urlopen(URL, timeout=8) as response:
        raw = response.read(16 * 1024 * 1024 + 1)
    if len(raw) > 16 * 1024 * 1024:
        raise ValueError("Response too large")
    data = json.loads(raw)
    stats = data["stats"]
    world = data["world"]
    grazers = [o for o in world["organisms"] if o["species"] == "grazer"]
    predators = [o for o in world["organisms"] if o["species"] == "predator"]
    if len(grazers) + len(predators) != stats["population"]:
        raise ValueError("Population mismatch")
    nearest = []
    for predator in predators:
        nearest.append(min(
            (math.hypot(predator["x"] - grazer["x"],
                        predator["y"] - grazer["y"]) for grazer in grazers),
            default=float("inf")
        ))
    now = datetime.now(timezone.utc).isoformat(timespec="seconds")
    return {
        "timestamp_utc": now,
        "tick": world["tick"],
        "population": stats["population"],
        "grazers": len(grazers),
        "predators": len(predators),
        "food": stats["food"],
        "births": stats["births"],
        "deaths": stats["deaths"],
        "generation": stats["generation"],
        "mean_energy": round(stats["averageEnergy"], 4),
        "grazer_mean_energy": mean([o["energy"] for o in grazers]),
        "predator_mean_energy": mean([o["energy"] for o in predators]),
        "predator_min_energy": round(min(o["energy"] for o in predators), 4) if predators else "",
        "predator_mean_age": mean([o["age"] for o in predators]),
        "predator_mean_speed": mean([o["genome"]["speed"] for o in predators]),
        "predator_mean_vision": mean([o["genome"]["vision"] for o in predators]),
        "predator_mean_efficiency": mean([o["genome"]["efficiency"] for o in predators]),
        "predators_with_prey_in_vision": sum(d < o["genome"]["vision"] for d, o in zip(nearest, predators)),
        "predators_with_prey_within_8": sum(d < 8 for d in nearest),
        "predators_with_prey_within_12": sum(d < 12 for d in nearest),
        "total_grazer_energy": round(sum(o["energy"] for o in grazers), 4),
        "total_predator_energy": round(sum(o["energy"] for o in predators), 4),
    }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--samples", type=int, default=60)
    parser.add_argument("--interval", type=int, default=60)
    args = parser.parse_args()
    if not (1 <= args.samples <= 360 and 5 <= args.interval <= 3600):
        parser.error("Invalid interval or sample count")
    if args.output.exists():
        parser.error("Output exists; refusing overwrite")
    args.output.parent.mkdir(parents=True, exist_ok=True)
    fd = os.open(str(args.output), os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o600)
    with os.fdopen(fd, "w", newline="", encoding="utf-8", buffering=1) as handle:
        writer = csv.DictWriter(handle, fieldnames=COLUMNS)
        writer.writeheader()
        for i in range(args.samples):
            if STOP:
                break
            start = time.monotonic()
            try:
                row = capture()
                writer.writerow(row)
                print(f"sample {i+1}/{args.samples}: tick={row['tick']} "
                      f"grazers={row['grazers']} predators={row['predators']}", flush=True)
            except Exception as error:
                # Preserve the 1-minute schedule even during brief connection failures.
                print(f"sample {i+1}/{args.samples}: ERROR {error}", flush=True)
            until = start + args.interval
            if i != args.samples - 1:
                while not STOP and time.monotonic() < until:
                    time.sleep(min(1.0, until - time.monotonic()))
    print(f"Diagnostics saved to {args.output}", flush=True)


if __name__ == "__main__":
    signal.signal(signal.SIGTERM, stop)
    signal.signal(signal.SIGINT, stop)
    main()
