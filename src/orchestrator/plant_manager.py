"""PlantManagerAgent — meta-controller that orchestrates agent activation.

Two node functions live here:
* ``dispatch_node``  — dispatch loop: pops the next agent from the queue
                       or advances the orchestration phase.
* ``converge_node``  — final synthesis: picks the best non-vetoed proposal,
                       generates executable outputs (work order, notification).

ASSUMPTION: In production the convergence logic will use an LLM to
synthesise evidence.  The mock uses deterministic ranking.
"""

from __future__ import annotations

from .state import DecisionTwinState


# ── Phase-specific agent lists ───────────────────────────────────
REFLECTION_AGENTS = ["devils_advocate_agent", "safety_agent", "risk_agent"]
SIMULATION_AGENTS = ["scenario_simulation_agent", "quality_agent"]


# ─────────────────────────────────────────────────────────────────
# Dispatch node
# ─────────────────────────────────────────────────────────────────

def dispatch_node(state: DecisionTwinState) -> dict:
    """Dispatch loop: pop the next agent or advance the phase.

    Phase progression:
    planning → evidence → reflection → simulation (if vetoes) → convergence
    """
    active = state.get("active_agents", [])
    phase = state.get("phase", "")

    # ── Agents remain in queue → dispatch next ───────────────────
    if active:
        next_agent = active[0]
        remaining = active[1:]
        return {
            "current_agent": next_agent,
            "active_agents": remaining,
            "trace": [f"  >> [PlantManager] Dispatching -> {next_agent}"],
        }

    # ── Queue exhausted → advance to next phase ──────────────────

    if phase in ("", "planning"):
        # First call after Planner: build evidence-gathering queue
        agents = [g["required_agent"] for g in state.get("sub_goals", [])]
        if not agents:
            return {
                "phase": "convergence",
                "current_agent": "converge",
                "active_agents": [],
                "trace": ["  !! [PlantManager] No sub-goals. Skipping to CONVERGENCE."],
            }
        return {
            "phase": "evidence",
            "current_agent": agents[0],
            "active_agents": agents[1:],
            "trace": [
                f"\n{'-'*60}",
                f"  PHASE: EVIDENCE GATHERING",
                f"  Activating {len(agents)} agents: {agents}",
                f"{'-'*60}",
            ],
        }

    elif phase == "evidence":
        # Evidence done → reflection
        return {
            "phase": "reflection",
            "current_agent": REFLECTION_AGENTS[0],
            "active_agents": REFLECTION_AGENTS[1:],
            "trace": [
                f"\n{'-'*60}",
                f"  PHASE: REFLECTION & SAFETY",
                f"  Activating: {REFLECTION_AGENTS}",
                f"{'-'*60}",
            ],
        }

    elif phase == "reflection":
        vetoes = state.get("vetoes", [])
        challenges = state.get("challenges", [])

        if vetoes or challenges:
            return {
                "phase": "simulation",
                "current_agent": SIMULATION_AGENTS[0],
                "active_agents": SIMULATION_AGENTS[1:],
                "trace": [
                    f"\n{'-'*60}",
                    f"  PHASE: SCENARIO SIMULATION",
                    f"  Triggered by {len(vetoes)} veto(es), {len(challenges)} challenge(s)",
                    f"  Activating: {SIMULATION_AGENTS}",
                    f"{'-'*60}",
                ],
            }
        else:
            return {
                "phase": "convergence",
                "current_agent": "converge",
                "active_agents": [],
                "trace": [
                    f"\n{'-'*60}",
                    f"  No vetoes/challenges. Moving to CONVERGENCE.",
                    f"{'-'*60}",
                ],
            }

    elif phase == "simulation":
        return {
            "phase": "convergence",
            "current_agent": "converge",
            "active_agents": [],
            "trace": [
                f"\n{'-'*60}",
                f"  Simulation complete. Moving to CONVERGENCE.",
                f"{'-'*60}",
            ],
        }

    # Fallback
    return {
        "phase": "convergence",
        "current_agent": "converge",
        "active_agents": [],
        "trace": ["  !! [PlantManager] Unexpected state — fallback to CONVERGENCE."],
    }


# ─────────────────────────────────────────────────────────────────
# Convergence node
# ─────────────────────────────────────────────────────────────────

def converge_node(state: DecisionTwinState) -> dict:
    """Synthesise all evidence, proposals and vetoes into a final decision.

    Generates executable outputs: work order + supervisor notification.
    """
    blackboard = state.get("blackboard", {})
    proposals = state.get("proposals", [])
    vetoes = state.get("vetoes", [])
    challenges = state.get("challenges", [])
    completed = state.get("agents_completed", [])
    event = state.get("event", {})

    # ── Pick the best non-vetoed proposal ────────────────────────
    vetoed_actions = {v.get("vetoed_action") for v in vetoes}
    viable = [p for p in proposals if p.get("action") not in vetoed_actions]

    if viable:
        viable.sort(key=lambda p: p.get("confidence", 0), reverse=True)
        chosen = viable[0]
    else:
        chosen = {
            "action": "escalate_to_human",
            "reason": "All proposals vetoed or none generated",
            "confidence": 0.0,
        }

    final = {
        "chosen_action": chosen.get("action", "unknown"),
        "confidence": chosen.get("confidence", 0.0),
        "reason": chosen.get("reason", ""),
        "supporting_evidence": {
            agent: findings.get("summary", str(findings))
            for agent, findings in blackboard.items()
        },
        "vetoes": vetoes,
        "challenges_addressed": challenges,
        "agents_consulted": completed,
        "machine_id": event.get("machine_id", "unknown"),
    }

    # ── Generate executable outputs ──────────────────────────────
    work_order = {
        "type": "work_order",
        "machine_id": event.get("machine_id"),
        "action": chosen.get("action"),
        "priority": "HIGH" if chosen.get("confidence", 0) > 0.7 else "MEDIUM",
        "assigned_to": "available_technician",  # ASSUMPTION: technician roster integration pending
        "notes": chosen.get("reason", ""),
    }

    notification = {
        "type": "supervisor_notification",
        "machine_id": event.get("machine_id"),
        "summary": f"Decision: {chosen.get('action')} (confidence: {chosen.get('confidence', 0):.0%})",
        "requires_approval": chosen.get("confidence", 0) < 0.8,
    }

    return {
        "final_decision": final,
        "work_orders": [work_order],
        "notifications": [notification],
        "trace": [
            f"\n{'='*60}",
            f"  PLANT MANAGER — FINAL DECISION",
            f"{'='*60}",
            f"  Action     : {final['chosen_action']}",
            f"  Confidence : {final['confidence']:.0%}",
            f"  Reason     : {final['reason']}",
            f"  Consulted  : {len(completed)} agents",
            f"  Vetoes     : {len(vetoes)}",
            f"  Challenges : {len(challenges)}",
            f"{'='*60}",
        ],
    }
