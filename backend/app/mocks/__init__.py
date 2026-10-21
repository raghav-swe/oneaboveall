"""Deterministic offline fixtures (backend/app/mocks/scenarios.json).

Shared loader for graph nodes. `load_scenarios()` is cached; `get_scenario(key)`
returns the fixture block for one of the three chaos scenario keys (plus the
`SEEDED_TICKETS` ledger used by Phase 2 database seeding).
"""

import json
from functools import lru_cache
from pathlib import Path
from typing import Any, Dict

_SCENARIOS_PATH = Path(__file__).resolve().parent / "scenarios.json"


@lru_cache(maxsize=1)
def load_scenarios() -> Dict[str, Any]:
    with open(_SCENARIOS_PATH, encoding="utf-8") as f:
        return json.load(f)


def get_scenario(scenario_key: str) -> Dict[str, Any]:
    scenarios = load_scenarios()
    if scenario_key not in scenarios:
        raise KeyError(f"Unknown scenario_key '{scenario_key}'. Available: {sorted(scenarios)}.")
    return scenarios[scenario_key]
