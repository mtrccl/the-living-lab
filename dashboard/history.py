"""Bounded, read-only time-series access for Genesis dashboard.

Reading history.sqlite3 never writes into the simulation VM.
"""
import json
import sqlite3
import time
from datetime import datetime, timezone
from pathlib import Path

DB = Path("/var/lib/genesis-reports/history.sqlite3")
RANGES = {
    "1h": (3600, 900),
    "1d": (86400, 3600),
    "1w": (7 * 86400, 6 * 3600),
    "1m": (30 * 86400, 86400),
    "1y": (365 * 86400, 3 * 86400),
}
NUMBERS = ("tick", "population", "generation", "grazers", "predators",
           "food", "births", "deaths", "average_energy")
SQL = """SELECT slot, tick, population, generation, grazers, predators,
    food, births, deaths, average_energy, energy_bins, generation_bins
    FROM observations WHERE slot >= ? AND slot <= ?
    ORDER BY slot ASC LIMIT 40000"""


def aggregate(rows, step):
    groups = {}
    for row in rows:
        bucket = row[0] // step * step
        group = groups.setdefault(bucket, [])
        group.append(row)
    points = []
    for bucket, values in sorted(groups.items()):
        n = len(values)
        entry = {"timestamp": datetime.fromtimestamp(bucket, timezone.utc)
                 .isoformat().replace("+00:00", "Z")}
        for offset, key in enumerate(NUMBERS, 1):
            entry[key] = sum(v[offset] for v in values) / n
        for offset, key, size in ((10, "energyBins", 6), (11, "generationBins", 4)):
            hist = [0] * size
            for value in values:
                bins = json.loads(value[offset])
                if not isinstance(bins, list) or len(bins) != size:
                    raise ValueError("Invalid histogram in archive")
                for i, count in enumerate(bins):
                    hist[i] += count
            entry[key] = [count / n for count in hist]
        points.append(entry)
    return points


def get_history(range_key, db_path=DB, now=None):
    if range_key not in RANGES:
        raise ValueError("Unsupported time range")
    seconds, step = RANGES[range_key]
    now = int(time.time() if now is None else now)
    if not db_path.exists():
        return {"range": range_key, "interval_seconds": step,
                "sample_count": 0, "points": []}
    # mode=ro ensures requests cannot modify the host archive.
    with sqlite3.connect(db_path.resolve().as_uri() + "?mode=ro", uri=True, timeout=3) as db:
        rows = db.execute(SQL, (now - seconds, now)).fetchall()
    return {"range": range_key, "interval_seconds": step,
            "sample_count": len(rows), "points": aggregate(rows, step)}
