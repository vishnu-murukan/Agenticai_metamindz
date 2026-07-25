"""PlannerAgent — decomposes incoming events into dynamic sub-goal lists.

ASSUMPTION: In production this agent will use an LLM to reason about the
event and generate goals.  The current implementation uses rule-based
decomposition that mirrors the expected LLM output contract so the
orchestrator works end-to-end without an API key.
"""

from __future__ import annotations

from .state import DecisionTwinState


# ── Decomposition rule table ─────────────────────────────────────
# Maps event_type → base sub-goals.  The planner extends this list
# dynamically based on severity indicators in the event payload.

DECOMPOSITION_RULES: dict[str, list[dict]] = {
    "sensor_anomaly": [
        {"id": "assess_sensors",   "description": "Read and analyse live sensor data for anomalies",
         "required_agent": "sensor_agent",      "priority": 1},
        {"id": "check_health",     "description": "Assess machine health from maintenance history",
         "required_agent": "maintenance_agent", "priority": 1},
        {"id": "search_precedent", "description": "Find similar past incidents via historical memory",
         "required_agent": "memory_agent",      "priority": 2},
        {"id": "evaluate_schedule","description": "Assess production schedule and delivery impact",
         "required_agent": "production_agent",  "priority": 2},
    ],
    "maintenance_alert": [
        {"id": "check_health",     "description": "Deep-dive machine health assessment",
         "required_agent": "maintenance_agent", "priority": 1},
        {"id": "search_precedent", "description": "Historical precedent lookup",
         "required_agent": "memory_agent",      "priority": 1},
        {"id": "check_parts",      "description": "Verify spare-parts availability",
         "required_agent": "inventory_agent",   "priority": 2},
        {"id": "estimate_cost",    "description": "Project financial impact",
         "required_agent": "finance_agent",     "priority": 2},
    ],
    "quality_deviation": [
        {"id": "assess_sensors",   "description": "Review sensor data around deviation window",
         "required_agent": "sensor_agent",      "priority": 1},
        {"id": "assess_quality",   "description": "Detailed quality impact analysis",
         "required_agent": "quality_agent",     "priority": 1},
        {"id": "evaluate_schedule","description": "Schedule impact of potential rework",
         "required_agent": "production_agent",  "priority": 2},
    ],
}


def planner_node(state: DecisionTwinState) -> dict:
    """Decompose the incoming event into a prioritised sub-goal list.

    The decomposition is *dynamic*: the set and number of goals varies
    with event type and severity indicators in the payload.  This is the
    core planning behaviour — deciding *what needs investigating* rather
    than following a fixed checklist.
    """
    event = state["event"]
    event_type = state["event_type"]

    # Start with base goals for this event type
    base_goals = DECOMPOSITION_RULES.get(event_type, DECOMPOSITION_RULES["sensor_anomaly"])
    sub_goals: list[dict] = [dict(g) for g in base_goals]  # shallow copy

    # ── Conditional expansion based on event severity ────────────
    vibration = event.get("vibration_level", 0)
    temperature = event.get("temperature", 0)

    if vibration > 7 or temperature > 85:
        existing_ids = {g["id"] for g in sub_goals}
        if "check_parts" not in existing_ids:
            sub_goals.append({
                "id": "check_parts",
                "description": "Verify spare-parts availability (high-severity trigger)",
                "required_agent": "inventory_agent",
                "priority": 2,
            })
        if "estimate_cost" not in existing_ids:
            sub_goals.append({
                "id": "estimate_cost",
                "description": "Project financial impact (high-severity trigger)",
                "required_agent": "finance_agent",
                "priority": 3,
            })

    # Sort by priority so the most urgent goals execute first
    sub_goals.sort(key=lambda g: g["priority"])
    goal_ids = [g["id"] for g in sub_goals]

    return {
        "sub_goals": sub_goals,
        "trace": [
            f"\n{'='*60}",
            f"  PLANNER AGENT",
            f"{'='*60}",
            f"  Event   : {event_type}",
            f"  Machine : {event.get('machine_id', 'unknown')}",
            f"  Severity: vibration={vibration}, temp={temperature} C",
            f"  Goals   : {len(sub_goals)} sub-goals decomposed",
            *[f"    [{g['priority']}] {g['id']:20s} -> {g['required_agent']}" for g in sub_goals],
            f"{'='*60}",
        ],
    }
