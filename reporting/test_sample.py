import sqlite3
import unittest
from datetime import datetime, timezone
from pathlib import Path
from tempfile import TemporaryDirectory

from reporting.sample import capture, store

AT = datetime(2026, 11, 6, 13, 15, 2, tzinfo=timezone.utc)
STATE = {
    "stats": {
        "tick": 200, "population": 3, "generation": 6, "grazers": 2,
        "predators": 1, "food": 140, "births": 9, "deaths": 6,
        "averageEnergy": 47.0,
    },
    "world": {
        "organisms": [
            {"energy": 5.0, "generation": 0},
            {"energy": 45.0, "generation": 2},
            {"energy": 91.0, "generation": 6},
        ]
    },
}


class SamplingTests(unittest.TestCase):
    def test_correct_buckets(self):
        r = capture(STATE, AT)
        self.assertEqual(r["slot"], 1793970900)
        self.assertEqual(r["energy_bins"], "[1,0,1,0,1,0]")
        self.assertEqual(r["generation_bins"], "[1,1,0,1]")

    def test_idempotent_quarter_hour(self):
        with TemporaryDirectory() as tmp:
            db_path = Path(tmp) / "history.sqlite3"
            r = capture(STATE, AT)
            self.assertTrue(store(db_path, r))
            self.assertFalse(store(db_path, r))
            with sqlite3.connect(db_path) as db:
                self.assertEqual(db.execute("SELECT COUNT(*) FROM observations").fetchone()[0], 1)

    def test_reject_inconsistent_counts(self):
        wrong = {**STATE, "stats": {**STATE["stats"], "population": 4}}
        with self.assertRaises(ValueError):
            capture(wrong, AT)


if __name__ == "__main__":
    unittest.main()
