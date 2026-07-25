import pytest
import sys
import os

# Add src to pythonpath for tests
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "src")))

from reflection_memory import (
    Proposal,
    Evidence,
    DevilsAdvocateAgent,
    HistoricalMemoryAgent,
    SafetyAgent,
    NegotiationSimulator,
    VerdictType,
    IncidentReport
)

def test_devils_advocate_renegotiation_trigger():
    agent = DevilsAdvocateAgent(min_evidence_confidence=0.8, risk_tolerance_threshold=0.5)

    # Proposal with no evidence and high production speed multiplier
    proposal = Proposal(
        id="PROP-001",
        title="Machine #4 Aggressive Throughput Proposal",
        description="Scale Machine #4 production throughput by 5x without load testing",
        proposed_by="PlantOps_Lead",
        parameters={"traffic_spike_multiplier": 5.0, "auto_failover": False},
        evidences=[]
    )

    counter_arg = agent.evaluate_proposal(proposal)

    assert counter_arg.renegotiation_required is True
    assert counter_arg.risk_score >= 0.5
    assert len(counter_arg.missing_evidences) > 0
    assert len(counter_arg.counter_claims) > 0


def test_historical_memory_faiss_mid_reasoning_query():
    memory_agent = HistoricalMemoryAgent()

    # Query mid-reasoning about machine 4 bearing failure incidents
    results = memory_agent.query_mid_reasoning(query="machine 4 bearing failure shutdown", top_k=2)

    assert len(results) > 0
    top_incident, score = results[0]
    assert isinstance(top_incident, IncidentReport)
    assert top_incident.id == "INC-2024-089"
    assert score > 0.0


def test_safety_agent_hard_veto():
    safety_agent = SafetyAgent()

    # Proposal violating budget cap ($50,000 max, proposing $100,000)
    proposal = Proposal(
        id="PROP-002",
        title="Over-budget CNC Machine Overhaul",
        description="Massive tooling buy",
        proposed_by="PlantOps_Lead",
        parameters={"budget_allocation": 100000.0, "auto_failover": True},
        evidences=[Evidence("EV-01", "Preliminary vendor quote", "ToolingCorp", 0.9)]
    )

    verdict = safety_agent.validate_proposal(proposal)

    assert verdict.verdict == VerdictType.HARD_VETO
    assert len(verdict.violated_rules) > 0
    assert any("SOP-BUDGET-01" in r for r in verdict.violated_rules)


def test_negotiation_simulator_resolution_flow():
    simulator = NegotiationSimulator()

    # Proposal that complies with safety and has strong evidence
    strong_evidence = Evidence("EV-LOAD-01", "Passed 5x machine load stress test", "AutomatedTestRig", 0.95)
    proposal = Proposal(
        id="PROP-003",
        title="Balanced Machine #4 Upgrade",
        description="Controlled rollout with safety interlocks and load testing",
        proposed_by="ReliabilityTeam",
        parameters={
            "budget_allocation": 35000.0,
            "auto_failover": True,
            "traffic_spike_multiplier": 2.0
        },
        evidences=[strong_evidence]
    )

    round_res = simulator.evaluate_proposal_round(round_number=1, proposal=proposal)

    assert round_res.safety_verdict.verdict == VerdictType.APPROVED
    assert round_res.counter_argument.renegotiation_required is False
    assert round_res.status == "RESOLVED"
