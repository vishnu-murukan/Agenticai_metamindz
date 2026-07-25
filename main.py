"""Decision Twin  —  Multi-Agent Orchestrator Demo

Triggers mock manufacturing events through the LangGraph orchestrator
and prints a detailed execution trace to the console.

Usage:
    python main.py
"""

from src.orchestrator.graph import build_graph


# ── Mock Events ──────────────────────────────────────────────────
# These simulate real IoT / SCADA payloads that would arrive via
# the MCP server in production.

MOCK_EVENTS = {
    "machine4_vibration": {
        "event": {
            "machine_id": "Machine-#4",
            "timestamp": "2026-07-25T14:32:00Z",
            "vibration_level": 8.2,
            "temperature": 92,
            "pressure": 145,
            "source": "IoT Sensor Gateway",
        },
        "event_type": "sensor_anomaly",
    },
    "machine2_maintenance": {
        "event": {
            "machine_id": "Machine-#2",
            "timestamp": "2026-07-25T09:15:00Z",
            "vibration_level": 4.5,
            "temperature": 78,
            "pressure": 120,
            "source": "Scheduled Check",
        },
        "event_type": "maintenance_alert",
    },
    "machine7_quality": {
        "event": {
            "machine_id": "Machine-#7",
            "timestamp": "2026-07-25T11:45:00Z",
            "vibration_level": 3.0,
            "temperature": 72,
            "pressure": 130,
            "defect_rate": 0.08,
            "source": "QC Station",
        },
        "event_type": "quality_deviation",
    },
}


def run_scenario(name: str, initial_state: dict) -> dict:
    """Execute a single scenario and print the trace."""
    print(f"\n{'#'*60}")
    print(f"  SCENARIO: {name}")
    print(f"{'#'*60}")

    graph = build_graph()

    # Initialize all accumulator fields so LangGraph reducers work
    full_initial: dict = {
        "sub_goals": [],
        "phase": "",
        "active_agents": [],
        "agents_completed": [],
        "current_agent": "",
        "blackboard": {},
        "proposals": [],
        "vetoes": [],
        "challenges": [],
        "final_decision": {},
        "work_orders": [],
        "notifications": [],
        "trace": [],
        **initial_state,
    }

    result = graph.invoke(full_initial)

    # ── Print execution trace ────────────────────────────────────
    print("\n-- EXECUTION TRACE --\n")
    for line in result.get("trace", []):
        print(line)

    # ── Print final decision ─────────────────────────────────────
    decision = result.get("final_decision", {})
    if decision:
        print(f"\n{'_'*60}")
        print("  DECISION SUMMARY")
        print(f"{'_'*60}")
        print(f"  Machine    : {decision.get('machine_id')}")
        print(f"  Action     : {decision.get('chosen_action')}")
        print(f"  Confidence : {decision.get('confidence', 0):.0%}")
        print(f"  Reason     : {decision.get('reason')}")
        consulted = decision.get('agents_consulted', [])
        print(f"  Consulted  : {', '.join(consulted)}")

        if decision.get("vetoes"):
            print(f"  Vetoes     : {len(decision['vetoes'])}")
            for v in decision["vetoes"]:
                print(f"    VETO {v['vetoed_action']}: {v['reason'][:60]}...")

        if decision.get("challenges_addressed"):
            print(f"  Challenges : {len(decision['challenges_addressed'])}")
            for c in decision["challenges_addressed"]:
                print(f"    CHALLENGE on '{c['challenged_proposal']}': {c['challenge'][:60]}...")
        print(f"{'_'*60}")

    # ── Print executable outputs ─────────────────────────────────
    print("\n  EXECUTABLE OUTPUTS:")
    for wo in result.get("work_orders", []):
        print(f"    [WORK ORDER] {wo.get('action')} on {wo.get('machine_id')} | Priority: {wo.get('priority')}")
    for n in result.get("notifications", []):
        print(f"    [NOTIFICATION] {n.get('summary')}")
        if n.get("requires_approval"):
            print(f"      ** Requires supervisor approval **")
    print()

    return result


# ─────────────────────────────────────────────────────────────────
#  Entry point
# ─────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    print("=" * 60)
    print("  DECISION TWIN — Multi-Agent Orchestrator")
    print("  Manufacturing & Industry 4.0  |  MCP Hackathon")
    print("=" * 60)

    # Primary demo scenario: Machine #4 sensor anomaly
    # This is the scenario from the proposal — vibration + temperature
    run_scenario(
        "Machine #4 — Abnormal Vibration & Rising Temperature",
        MOCK_EVENTS["machine4_vibration"],
    )

    # Optional: uncomment to run additional scenarios
    # run_scenario(
    #     "Machine #2 — Scheduled Maintenance Alert",
    #     MOCK_EVENTS["machine2_maintenance"],
    # )
    # run_scenario(
    #     "Machine #7 — Quality Deviation Detected",
    #     MOCK_EVENTS["machine7_quality"],
    # )
