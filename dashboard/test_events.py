import sqlite3
import unittest
from pathlib import Path
from tempfile import TemporaryDirectory

from dashboard.history import get_events


class EventJournalTests(unittest.TestCase):
    def test_true_changes_only(self):
        with TemporaryDirectory() as temp:
            p = Path(temp) / "history.sqlite3"
            with sqlite3.connect(p) as db:
                db.executescript("""CREATE TABLE observations (
                    slot INTEGER PRIMARY KEY, population INTEGER, generation INTEGER,
                    grazers INTEGER, predators INTEGER, food INTEGER, births INTEGER,
                    deaths INTEGER);""")
                db.executemany("INSERT INTO observations VALUES (?,?,?,?,?,?,?,?)", [
                    (900, 100, 2, 90, 10, 30, 200, 100),
                    (1800, 60, 4, 60, 0, 8, 210, 150),
                    (2700, 55, 3, 55, 0, 20, 213, 158),
                ])
            result = get_events("1h", p, now=3000)
            codes = [event["code"] for event in result["events"]]
            self.assertEqual(codes.count("predator_extinction"), 1)
            self.assertEqual(codes.count("population_drop"), 1)
            self.assertEqual(codes.count("food_scarcity"), 1)
            self.assertEqual(codes.count("new_generation"), 1)

    def test_empty_archive(self):
        with TemporaryDirectory() as temp:
            self.assertEqual(get_events("1d", Path(temp)/"none.db")["events"], [])

    def test_invalid_time_range(self):
        with self.assertRaises(ValueError):
            get_events("100y")


if __name__ == "__main__":
    unittest.main()
