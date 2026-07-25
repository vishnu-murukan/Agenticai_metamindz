"""Stub sub-agents for the Decision Twin system.

Each function is a LangGraph node: takes ``DecisionTwinState``, returns a
partial state update.  Stubs use rule-based mock logic that preserves the
input/output contract of the real implementations.

ASSUMPTION: Real agents will make LLM calls and/or MCP tool calls
(``get_sensor_data()``, ``check_machine_health()``, etc.).  The mock logic
lets the orchestrator run end-to-end without API keys.
"""

from __future__ import annotations

from .state import DecisionTwinState


# ══════════════════════════════════════════════════════════════════
#  EVIDENCE LAYER
# ══════════════════════════════════════════════════════════════════

def sensor_agent(state: DecisionTwinState) -> dict:
    """Read live sensor data and flag anomalies against thresholds.

    MOCK: Uses event payload directly.
    REAL: Calls ``get_sensor_data()`` MCP tool.
    """
    event = state["event"]
    vibration = event.get("vibration_level", 0)
    temperature = event.get("temperature", 0)
    pressure = event.get("pressure", 0)

    anomalies: list[str] = []
    if vibration > 5:
        anomalies.append(f"Vibration {vibration}/10 exceeds threshold (5)")
    if temperature > 80:
        anomalies.append(f"Temperature {temperature} C exceeds threshold (80 C)")
    if pressure > 150:
        anomalies.append(f"Pressure {pressure} PSI exceeds threshold (150)")

    severity = (
        "critical" if vibration > 8 or temperature > 95 else
        "high"     if vibration > 6 or temperature > 85 else
        "moderate" if anomalies else
        "normal"
    )

    findings = {
        "anomalies": anomalies,
        "severity": severity,
        "readings": {"vibration": vibration, "temperature": temperature, "pressure": pressure},
        "summary": f"{len(anomalies)} anomalies detected, severity: {severity}",
    }

    return {
        "blackboard": {"sensor_agent": findings},
        "agents_completed": ["sensor_agent"],
        "trace": [
            f"     [SensorAgent] {len(anomalies)} anomalies | Severity: {severity.upper()}",
            *[f"       - {a}" for a in anomalies],
        ],
    }


def maintenance_agent(state: DecisionTwinState) -> dict:
    """Assess machine health from maintenance history.

    MOCK: Derives health from sensor severity.
    REAL: Calls ``check_machine_health()`` MCP tool.
    """
    event = state["event"]
    bb = state.get("blackboard", {})
    sensor_data = bb.get("sensor_agent", {})
    severity = sensor_data.get("severity", "moderate")
    machine_id = event.get("machine_id", "unknown")

    health_score = {"critical": 0.2, "high": 0.4, "moderate": 0.6, "normal": 0.85}.get(severity, 0.5)
    failure_probability = round(1 - health_score, 2)
    needs_immediate = health_score < 0.4

    findings = {
        "machine_id": machine_id,
        "health_score": health_score,
        "failure_probability": failure_probability,
        "last_maintenance": "14 days ago",  # MOCK
        "recommendation": "immediate_repair" if needs_immediate else "schedule_maintenance",
        "summary": (
            f"Health={health_score:.0%}, P(failure)={failure_probability:.0%}, "
            f"Rec: {'IMMEDIATE REPAIR' if needs_immediate else 'scheduled maintenance'}"
        ),
    }

    result: dict = {
        "blackboard": {"maintenance_agent": findings},
        "agents_completed": ["maintenance_agent"],
        "trace": [
            f"     [MaintenanceAgent] {machine_id}: Health={health_score:.0%}, P(fail)={failure_probability:.0%}",
            f"       Recommendation: {findings['recommendation']}",
        ],
    }

    if needs_immediate:
        result["proposals"] = [{
            "source": "maintenance_agent",
            "action": "immediate_repair",
            "reason": (
                f"Health score {health_score:.0%} below critical threshold. "
                f"Failure probability {failure_probability:.0%}."
            ),
            "confidence": 0.75,
        }]

    return result


def memory_agent(state: DecisionTwinState) -> dict:
    """RAG search over historical incident reports.

    MOCK: Returns a canned similar incident.
    REAL: Uses FAISS/ChromaDB RAG via ``search_incident_history()`` MCP tool.
    """
    event = state["event"]
    machine_id = event.get("machine_id", "unknown")

    similar_incidents = [
        {
            "incident_id": "INC-2024-0847",
            "date": "2024-11-15",
            "machine": machine_id,
            "symptoms": "High vibration + elevated temperature",
            "root_cause": "Bearing wear in spindle assembly",
            "action_taken": "Immediate bearing replacement",
            "outcome": (
                "Resolved in 4 hours.  Delayed repair in similar INC-2024-0623 "
                "led to spindle failure (48 hr downtime)."
            ),
            "similarity_score": 0.91,
        },
    ]

    findings = {
        "similar_incidents": similar_incidents,
        "precedent_supports": "immediate_repair",
        "summary": (
            f"Found {len(similar_incidents)} similar incident(s).  "
            f"Closest match (91% similar): bearing wear; delayed repair caused 48 hr downtime."
        ),
    }

    return {
        "blackboard": {"memory_agent": findings},
        "agents_completed": ["memory_agent"],
        "trace": [
            f"     [MemoryAgent] Found {len(similar_incidents)} precedent(s)",
            f"       Best match: INC-2024-0847 (91% similar) -> bearing wear",
            f"       Precedent supports: immediate_repair",
        ],
    }


def production_agent(state: DecisionTwinState) -> dict:
    """Evaluate production schedule and delivery-commitment impact.

    MOCK: Returns schedule data.
    REAL: Calls production-schedule MCP tools.
    """
    event = state["event"]
    machine_id = event.get("machine_id", "unknown")

    findings = {
        "machine_id": machine_id,
        "current_utilization": 0.87,
        "active_orders": 3,
        "next_deadline": "2 days",
        "can_reroute": True,
        "reroute_capacity": 0.70,
        "impact_if_stopped_4h": "Low — reroute absorbs 4 hr gap, no delivery slip",
        "impact_if_stopped_48h": "High — 2 of 3 orders delayed",
        "summary": (
            "Machine at 87% utilisation, 3 active orders.  "
            "4 hr stop manageable via reroute; 48 hr stop causes delivery delays."
        ),
    }

    return {
        "blackboard": {"production_agent": findings},
        "agents_completed": ["production_agent"],
        "trace": [
            f"     [ProductionAgent] {machine_id}: 87% util, 3 orders",
            f"       4 hr stop : {findings['impact_if_stopped_4h']}",
            f"       48 hr stop: {findings['impact_if_stopped_48h']}",
        ],
    }


def inventory_agent(state: DecisionTwinState) -> dict:
    """Check spare-parts availability.

    MOCK: Returns part stock.
    REAL: Calls ``check_inventory()`` MCP tool.
    """
    findings = {
        "required_part": "Spindle Bearing Assembly (SKU: SBA-4420)",
        "in_stock": True,
        "quantity_available": 2,
        "location": "Warehouse B, Rack 14",
        "lead_time_if_ordered": "3-5 business days",
        "summary": "Required part in stock (2 units).  Immediate availability from Warehouse B.",
    }

    return {
        "blackboard": {"inventory_agent": findings},
        "agents_completed": ["inventory_agent"],
        "trace": [
            f"     [InventoryAgent] Part: {findings['required_part']}",
            f"       In stock: {findings['quantity_available']} units at {findings['location']}",
        ],
    }


def finance_agent(state: DecisionTwinState) -> dict:
    """Project financial impact of downtime options.

    MOCK: Rule-based cost estimation.
    REAL: Calls ``estimate_downtime_cost()`` MCP tool.
    """
    bb = state.get("blackboard", {})
    finance_data = bb.get("finance_agent", {})  # noqa: F841
    hourly_cost = 12_500  # USD per hour of downtime (MOCK)

    repair_now_cost = hourly_cost * 4
    expected_delay_cost = round(hourly_cost * 48 * 0.65)

    findings = {
        "hourly_downtime_cost": hourly_cost,
        "repair_now_cost": repair_now_cost,
        "repair_now_duration": "4 hours",
        "delay_repair_risk_cost": hourly_cost * 48,
        "delay_repair_probability": 0.65,
        "expected_delay_cost": expected_delay_cost,
        "summary": (
            f"Repair now: ${repair_now_cost:,} (4 hr).  "
            f"Delay risk: ${expected_delay_cost:,} expected (65% chance of 48 hr failure)."
        ),
    }

    return {
        "blackboard": {"finance_agent": findings},
        "agents_completed": ["finance_agent"],
        "proposals": [{
            "source": "finance_agent",
            "action": "immediate_repair",
            "reason": (
                f"Expected delay cost (${expected_delay_cost:,}) is "
                f"{expected_delay_cost / repair_now_cost:.1f}x repair-now cost (${repair_now_cost:,})"
            ),
            "confidence": 0.80,
        }],
        "trace": [
            f"     [FinanceAgent] Repair now: ${repair_now_cost:,} | Delay risk: ${expected_delay_cost:,}",
            f"       Recommendation: immediate_repair (cost ratio {expected_delay_cost / repair_now_cost:.1f}x)",
        ],
    }


# ══════════════════════════════════════════════════════════════════
#  REFLECTION & SAFETY LAYER
# ══════════════════════════════════════════════════════════════════

def devils_advocate_agent(state: DecisionTwinState) -> dict:
    """Challenge the leading proposal and request missing evidence.

    Implements the *reflection / self-critique* pattern.

    MOCK: Generates a structured challenge.
    REAL: LLM-driven critique with access to full blackboard.
    """
    proposals = state.get("proposals", [])
    bb = state.get("blackboard", {})

    if not proposals:
        return {
            "agents_completed": ["devils_advocate_agent"],
            "trace": ["     [DevilsAdvocate] No proposals to challenge."],
        }

    leading = max(proposals, key=lambda p: p.get("confidence", 0))
    utilization = bb.get("production_agent", {}).get("current_utilization", "unknown")

    challenge = {
        "challenged_proposal": leading["action"],
        "challenge": (
            f"The historical precedent (INC-2024-0847) involved a different production load.  "
            f"Current utilisation is {utilization}.  "
            f"Are we sure the failure timeline matches?"
        ),
        "requested_evidence": "Verify current load matches historical-case conditions",
        "severity": "moderate",
    }

    return {
        "challenges": [challenge],
        "agents_completed": ["devils_advocate_agent"],
        "trace": [
            f"     [DevilsAdvocate] Challenging: '{leading['action']}'",
            f"       \"{challenge['challenge'][:80]}...\"",
            f"       Requested: {challenge['requested_evidence']}",
        ],
    }


def safety_agent(state: DecisionTwinState) -> dict:
    """Validate proposals against SOPs.  Holds veto power.

    MOCK: Vetoes delay if vibration is critical.
    REAL: Checks SOP database via MCP tool.
    """
    bb = state.get("blackboard", {})
    sensor = bb.get("sensor_agent", {})
    severity = sensor.get("severity", "moderate")
    vibration = sensor.get("readings", {}).get("vibration", 0)

    sop_violations: list[str] = []
    vetoes_out: list[dict] = []

    if severity in ("critical", "high") and vibration > 7:
        sop_violations.append(
            "SOP-MFG-042: Equipment with vibration >7 must not operate without inspection"
        )
        vetoes_out.append({
            "source": "safety_agent",
            "vetoed_action": "delay_repair",
            "reason": (
                f"SOP-MFG-042 violation: vibration level {vibration}/10 "
                f"exceeds safety limit for continued operation"
            ),
            "sop_reference": "SOP-MFG-042",
        })

    findings = {
        "sop_violations": sop_violations,
        "vetoes_issued": len(vetoes_out),
        "approved_actions": (
            ["immediate_repair", "reduced_capacity"] if vetoes_out
            else ["immediate_repair", "delay_repair", "reduced_capacity"]
        ),
        "summary": f"{len(sop_violations)} SOP violation(s), {len(vetoes_out)} veto(es) issued.",
    }

    return {
        "blackboard": {"safety_agent": findings},
        "vetoes": vetoes_out,
        "agents_completed": ["safety_agent"],
        "trace": [
            f"     [SafetyAgent] SOP violations: {len(sop_violations)} | Vetoes: {len(vetoes_out)}",
            *[f"       VETO: {v['reason'][:70]}..." for v in vetoes_out],
        ],
    }


def risk_agent(state: DecisionTwinState) -> dict:
    """Compute composite operational risk score.

    MOCK: Weighted average of safety, financial, and mechanical inputs.
    REAL: Calls ``calculate_risk()`` MCP tool.
    """
    bb = state.get("blackboard", {})
    sensor = bb.get("sensor_agent", {})
    maintenance = bb.get("maintenance_agent", {})
    finance = bb.get("finance_agent", {})

    safety_risk = {"critical": 0.95, "high": 0.75, "moderate": 0.4, "normal": 0.1}.get(
        sensor.get("severity", "moderate"), 0.5
    )
    financial_risk = min(1.0, (finance.get("expected_delay_cost", 0) / 500_000)) if finance else 0.3
    mechanical_risk = (1 - maintenance.get("health_score", 0.5)) if maintenance else 0.5

    composite = round(safety_risk * 0.4 + financial_risk * 0.3 + mechanical_risk * 0.3, 3)
    level = (
        "CRITICAL" if composite > 0.7 else
        "HIGH"     if composite > 0.5 else
        "MODERATE" if composite > 0.3 else
        "LOW"
    )

    findings = {
        "safety_risk": safety_risk,
        "financial_risk": round(financial_risk, 3),
        "mechanical_risk": round(mechanical_risk, 3),
        "composite_score": composite,
        "risk_level": level,
        "summary": (
            f"Composite risk: {composite:.1%} ({level}).  "
            f"Safety={safety_risk:.0%}, Financial={financial_risk:.0%}, Mechanical={mechanical_risk:.0%}"
        ),
    }

    return {
        "blackboard": {"risk_agent": findings},
        "agents_completed": ["risk_agent"],
        "trace": [
            f"     [RiskAgent] Composite: {composite:.1%} ({level})",
            f"       Safety={safety_risk:.0%} | Financial={financial_risk:.0%} | Mechanical={mechanical_risk:.0%}",
        ],
    }


# ══════════════════════════════════════════════════════════════════
#  SIMULATION LAYER
# ══════════════════════════════════════════════════════════════════

def scenario_simulation_agent(state: DecisionTwinState) -> dict:
    """Run counterfactual comparisons of alternative actions.

    MOCK: Rule-based scenario scoring.
    REAL: Re-invokes agents against hypothetical states via
    ``simulate_scenario()`` MCP tool.
    """
    vetoes = state.get("vetoes", [])
    vetoed_actions = {v.get("vetoed_action") for v in vetoes}

    scenarios = {
        "immediate_repair": {
            "downtime": "4 hours",
            "cost": "$50,000",
            "risk_reduction": "95%",
            "schedule_impact": "Minimal — reroute absorbs gap",
            "score": 0.85,
        },
        "delay_repair": {
            "downtime": "0 now / 48 hr if failure",
            "cost": "$0 now / $600,000 if failure",
            "risk_reduction": "0%",
            "schedule_impact": "None now / severe if failure",
            "score": 0.25,
        },
        "reduced_capacity": {
            "downtime": "0 hours",
            "cost": "$18,000/day revenue reduction",
            "risk_reduction": "60%",
            "schedule_impact": "Moderate — slower throughput",
            "score": 0.55,
        },
    }

    viable_scenarios = {k: v for k, v in scenarios.items() if k not in vetoed_actions}
    best = max(viable_scenarios.items(), key=lambda x: x[1]["score"])

    findings = {
        "scenarios_evaluated": scenarios,
        "vetoed_scenarios": list(vetoed_actions),
        "viable_scenarios": viable_scenarios,
        "recommended": best[0],
        "summary": (
            f"Evaluated 3 scenarios, {len(vetoed_actions)} vetoed.  "
            f"Best viable: {best[0]} (score: {best[1]['score']})"
        ),
    }

    return {
        "blackboard": {"scenario_simulation_agent": findings},
        "agents_completed": ["scenario_simulation_agent"],
        "proposals": [{
            "source": "scenario_simulation_agent",
            "action": best[0],
            "reason": (
                f"Best scenario after simulation: {best[0]} "
                f"(score={best[1]['score']}, downtime={best[1]['downtime']})"
            ),
            "confidence": best[1]["score"],
        }],
        "trace": [
            f"     [ScenarioSim] Evaluated {len(scenarios)} scenarios, {len(vetoed_actions)} vetoed",
            *[
                f"       {'>>>' if k == best[0] else 'XXX' if k in vetoed_actions else '   '} "
                f"{k}: score={v['score']}"
                for k, v in scenarios.items()
            ],
            f"       Recommended: {best[0]}",
        ],
    }


def quality_agent(state: DecisionTwinState) -> dict:
    """Assess downstream quality implications.

    MOCK: Quality impact based on machine condition.
    REAL: Uses quality-report data via MCP tool.
    """
    bb = state.get("blackboard", {})
    sensor = bb.get("sensor_agent", {})
    severity = sensor.get("severity", "moderate")

    quality_risk = {
        "critical":  {"defect_rate_increase": "15-25%", "batch_at_risk": True,  "quarantine_recommended": True},
        "high":      {"defect_rate_increase": "5-15%",  "batch_at_risk": True,  "quarantine_recommended": False},
        "moderate":  {"defect_rate_increase": "1-5%",   "batch_at_risk": False, "quarantine_recommended": False},
        "normal":    {"defect_rate_increase": "<1%",    "batch_at_risk": False, "quarantine_recommended": False},
    }.get(severity, {"defect_rate_increase": "unknown", "batch_at_risk": False, "quarantine_recommended": False})

    findings = {
        **quality_risk,
        "severity": severity,
        "summary": (
            f"Defect rate increase: {quality_risk['defect_rate_increase']}.  "
            f"Batch at risk: {quality_risk['batch_at_risk']}."
        ),
    }

    return {
        "blackboard": {"quality_agent": findings},
        "agents_completed": ["quality_agent"],
        "trace": [
            f"     [QualityAgent] Defect risk: {quality_risk['defect_rate_increase']} increase",
            f"       Batch at risk: {quality_risk['batch_at_risk']} | "
            f"Quarantine: {quality_risk['quarantine_recommended']}",
        ],
    }


# ══════════════════════════════════════════════════════════════════
#  AGENT REGISTRY — maps name -> node function
# ══════════════════════════════════════════════════════════════════

AGENT_REGISTRY: dict[str, callable] = {
    "sensor_agent":              sensor_agent,
    "maintenance_agent":         maintenance_agent,
    "memory_agent":              memory_agent,
    "production_agent":          production_agent,
    "inventory_agent":           inventory_agent,
    "finance_agent":             finance_agent,
    "devils_advocate_agent":     devils_advocate_agent,
    "safety_agent":              safety_agent,
    "risk_agent":                risk_agent,
    "scenario_simulation_agent": scenario_simulation_agent,
    "quality_agent":             quality_agent,
}
