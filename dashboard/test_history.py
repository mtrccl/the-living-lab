import json
import sqlite3
import unittest
from pathlib import Path
from tempfile import TemporaryDirectory
from dashboard.history import get_history, RANGES


class HistoryTests(unittest.TestCase):
    def test_empty_archive_returns_no_invented_samples(self):
        with TemporaryDirectory() as tmp:
            result = get_history("1h", Path(tmp) / "missing.sqlite3", now=2000)
            self.assertEqual(result["points"], [])
            self.assertEqual(result["sample_count"], 0)

    def test_reject_unknown_range(self):
        with self.assertRaises(ValueError):
            get_history("../etc/passwd")

    def test_all_ranges_aggregate_real_samples(self):
        with TemporaryDirectory() as tmp:
            db_path = Path(tmp) / "test.sqlite3"
            with sqlite3.connect(db_path) as db:
                db.executescript("""
                  CREATE TABLE observations (
                  slot INTEGER PRIMARY KEY, observed_at TEXT, tick INTEGER, population INTEGER,
                  generation INTEGER, grazers INTEGER, predators INTEGER, food INTEGER,
                  births INTEGER, deaths INTEGER, average_energy REAL, energy_bins TEXT,
                  generation_bins TEXT);
                """)
                for slot, pop in [(7200, 3), (8100, 5)]:
                    db.execute(
                        "INSERT INTO observations VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)",
                        (slot,"2026-11-06T00:00:00Z",slot, pop,2,pop-1,1,100,
                         10,4,50.0,json.dumps([pop,0,0,0,0,0]),
                         json.dumps([pop,0,0,0]))
                    )
            for key in RANGES:
                with self.subTest(range=key):
                    result = get_history(key, db_path, now=9000)
                    self.assertEqual(result["sample_count"], 2)
                    self.assertGreaterEqual(len(result["points"]), 1)
                    self.assertAlmostEqual(sum(point["population"] for point in result["points"]) /
                                           len(result["points"]), 4)


if __name__ == "__main__":
    unittest.main()
