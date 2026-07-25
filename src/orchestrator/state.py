"""Shared state schema for the Decision Twin multi-agent system.

Every agent reads from and writes to this TypedDict.  Fields annotated
with ``operator.add`` accumulate across node invocations (list-append
semantics).  All other fields use last-writer-wins semantics.
"""

from __future__ import annotations

import operator
from typing import Annotated, TypedDict


# ── Custom reducers ──────────────────────────────────────────────

def merge_blackboard(left: dict | None, right: dict | None) -> dict:
    """Deep-merge blackboard dicts.  Right values take precedence."""
    merged = dict(left) if left else {}
    if right:
        for key, value in right.items():
            if key in merged and isinstance(merged[key], dict) and isinstance(value, dict):
                merged[key] = {**merged[key], **value}
            else:
                merged[key] = value
    return merged


# ── State definition ─────────────────────────────────────────────

class DecisionTwinState(TypedDict):
    """Central state that every agent reads from and writes to.

    Blackboard pattern: agents deposit evidence under their own key
    inside ``blackboard`` so any downstream agent can reference it.
    """

    # ── Event Input ──────────────────────────────────────────────
    event: dict                                            # Raw event payload (sensor readings, alerts …)
    event_type: str                                        # "sensor_anomaly" | "maintenance_alert" | "quality_deviation"

    # ── Planning ─────────────────────────────────────────────────
    sub_goals: list[dict]                                  # [{id, description, required_agent, priority}, …]

    # ── Orchestration ────────────────────────────────────────────
    phase: str                                             # "evidence" | "reflection" | "simulation" | "convergence"
    active_agents: list[str]                               # Dispatch queue for the current phase
    agents_completed: Annotated[list[str], operator.add]   # Running log of finished agents
    current_agent: str                                     # Agent being dispatched right now

    # ── Shared Blackboard ────────────────────────────────────────
    blackboard: Annotated[dict, merge_blackboard]          # Findings keyed by agent name

    # ── Decision Artifacts ───────────────────────────────────────
    proposals: Annotated[list[dict], operator.add]         # Candidate action proposals
    vetoes: Annotated[list[dict], operator.add]            # Safety / compliance vetoes
    challenges: Annotated[list[dict], operator.add]        # Devil's-advocate objections
    final_decision: dict                                   # Converged output

    # ── Executable Outputs ───────────────────────────────────────
    work_orders: Annotated[list[dict], operator.add]       # Generated work orders
    notifications: Annotated[list[dict], operator.add]     # Supervisor notifications

    # ── Trace ────────────────────────────────────────────────────
    trace: Annotated[list[str], operator.add]              # Human-readable execution log
