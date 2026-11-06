import unittest
from datetime import datetime, timezone
from pathlib import Path
from tempfile import TemporaryDirectory
from reporting.daily import atomic_write, create_report, load_previous

SAMPLE = {
    "tick": 100, "population": 14, "generation": 2, "grazers": 11,
    "predators": 3, "food": 190, "births": 20, "deaths": 6,
    "averageEnergy": 42.5,
}
AT = datetime(2026, 11, 6, tzinfo=timezone.utc)

class DailyReportTests(unittest.TestCase):
    def test_initial(self):
        result = create_report(SAMPLE, at=AT)
        self.assertIsNone(result["since_previous_observation"])
        self.assertEqual(result["metrics"]["population"], 14)

    def test_deltas(self):
        new = {**SAMPLE, "tick": 110, "population": 15, "births": 23, "deaths": 8}
        result = create_report(new, {"metrics": SAMPLE}, AT)
        self.assertEqual(result["since_previous_observation"],
                         {"tick_delta": 10, "births": 3, "deaths": 2, "population_delta": 1})

    def test_restart(self):
        previous = {"metrics": {**SAMPLE, "tick": 500, "births": 35}}
        self.assertIsNone(create_report(SAMPLE, previous, AT)["since_previous_observation"])

    def test_round_trip(self):
        with TemporaryDirectory() as temp:
            path = Path(temp) / "latest.json"
            report = create_report(SAMPLE, at=AT)
            atomic_write(path, report)
            self.assertEqual(load_previous(path), report)

if __name__ == "__main__":
    unittest.main()
