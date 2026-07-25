import sys
import os
import json

# Ensure stdout handles UTF-8 on Windows
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

# Ensure src is in python path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "src")))

from reflection_memory import (
    Proposal,
    Evidence,
    DevilsAdvocateAgent,
    HistoricalMemoryAgent,
    SafetyAgent,
    NegotiationSimulator,
    VerdictType
)

def run_transcript():
    print("=" * 80)
    print("      DECISION TWIN SYSTEM: REFLECTION & MEMORY NEGOTIATION TRANSCRIPT")
    print("=" * 80)
    print("Target Branch: feat/reflection-memory")
    print("Agents Involved: Proposer, SafetyAgent, HistoricalMemoryAgent (RAG), DevilsAdvocateAgent")
    print("=" * 80 + "\n")

    simulator = NegotiationSimulator()

    # ---------------------------------------------------------
    # ROUND 1: INITIAL PROPOSAL (Will trigger Safety Hard Veto & DA Challenge)
    # ---------------------------------------------------------
    print("┌" + "─" * 78 + "┐")
    print("│ ROUND 1: INITIAL PROPOSAL (Aggressive Cloud Infrastructure Redesign)      │")
    print("└" + "─" * 78 + "┘")

    prop_r1 = Proposal(
        id="PROP-001",
        title="Instant Global Cloud Migration & Capacity Expansion",
        description="Migrate core billing service directly to unpartitioned high-mem instances to handle anticipated 4x flash sale spike.",
        proposed_by="LeadArch_Dev",
        parameters={
            "budget_allocation": 120000.0,
            "traffic_spike_multiplier": 4.5,
            "auto_failover": False,
            "prohibited_flags": []
        },
        evidences=[
            Evidence("EV-PRELIM-01", "Vendor marketing benchmark flyer", "CloudProviderCorp", 0.45)
        ],
        risk_level="HIGH"
    )

    print(f"[PROPOSAL SUBMITTED]: '{prop_r1.title}'")
    print(f"  Proposed By: {prop_r1.proposed_by}")
    print(f"  Budget Requested: ${prop_r1.parameters['budget_allocation']:,.2f}")
    print(f"  Traffic Multiplier: {prop_r1.parameters['traffic_spike_multiplier']}x")
    print(f"  Auto-Failover: {prop_r1.parameters['auto_failover']}")
    print(f"  Evidence Count: {len(prop_r1.evidences)} (Confidence: {prop_r1.evidences[0].confidence_score})")

    res_r1 = simulator.evaluate_proposal_round(1, prop_r1)

    print("\n[SAFETY AGENT EVALUATION]:")
    print(f"  Verdict: {res_r1.safety_verdict.verdict.value}")
    print(f"  Details: {res_r1.safety_verdict.details}")
    for rule in res_r1.safety_verdict.violated_rules:
        print(f"    ❌ Violated Rule: {rule}")

    print("\n[MID-REASONING HISTORICAL MEMORY LOOKUP]:")
    for inc in res_r1.retrieved_incidents:
        print(f"  🔍 Past Incident Match: [{inc.id}] {inc.title} (Domain: {inc.domain})")
        print(f"     Outcome: {inc.outcome}")

    print("\n[DEVIL'S ADVOCATE EVALUATION]:")
    print(f"  Challenge Summary: {res_r1.counter_argument.challenge_summary}")
    print(f"  Calculated Risk Score: {res_r1.counter_argument.risk_score:.2f}")
    print("  Missing Evidence Demanded:")
    for me in res_r1.counter_argument.missing_evidences:
        print(f"    ⚠️ {me}")
    print("  Counter-Claims Raised:")
    for cc in res_r1.counter_argument.counter_claims:
        print(f"    ⚡ {cc}")

    print(f"\n>>> ROUND 1 STATUS: {res_r1.status} <<<\n")

    # ---------------------------------------------------------
    # ROUND 2: REVISED PROPOSAL 1 (Fixes Budget, but triggers DA & RAG Memory Challenge)
    # ---------------------------------------------------------
    print("┌" + "─" * 78 + "┐")
    print("│ ROUND 2: REVISED PROPOSAL (Scaled-Down Budget, Unverified Scaling)       │")
    print("└" + "─" * 78 + "┘")

    prop_r2 = Proposal(
        id="PROP-001-REV1",
        title="Targeted Service Migration with Static Cluster",
        description="Reduced cluster size to fit budget cap, keeping read-replicas disabled to stay within cost.",
        proposed_by="LeadArch_Dev",
        parameters={
            "budget_allocation": 45000.0,
            "traffic_spike_multiplier": 3.5,
            "auto_failover": True,
            "prohibited_flags": ["disable_replicas"]
        },
        evidences=[
            Evidence("EV-STAGING-01", "Internal staging cluster metric logs", "DevOpsMetrics", 0.68)
        ],
        risk_level="MEDIUM"
    )

    print(f"[REVISED PROPOSAL SUBMITTED]: '{prop_r2.title}'")
    print(f"  Budget Requested: ${prop_r2.parameters['budget_allocation']:,.2f} (Complies with $50k SOP limit)")
    print(f"  Traffic Multiplier: {prop_r2.parameters['traffic_spike_multiplier']}x")

    res_r2 = simulator.evaluate_proposal_round(2, prop_r2)

    print("\n[SAFETY AGENT EVALUATION]:")
    print(f"  Verdict: {res_r2.safety_verdict.verdict.value}")
    print(f"  Details: {res_r2.safety_verdict.details}")
    for rule in res_r2.safety_verdict.violated_rules:
        print(f"    ❌ Violated Rule: {rule}")

    print("\n[MID-REASONING HISTORICAL MEMORY LOOKUP]:")
    for inc in res_r2.retrieved_incidents:
        print(f"  🔍 Past Incident Match: [{inc.id}] {inc.title}")
        print(f"     Lessons Learned: {inc.lessons_learned[0] if inc.lessons_learned else 'N/A'}")

    print("\n[DEVIL'S ADVOCATE EVALUATION]:")
    print(f"  Challenge Summary: {res_r2.counter_argument.challenge_summary}")
    print(f"  Calculated Risk Score: {res_r2.counter_argument.risk_score:.2f}")
    for me in res_r2.counter_argument.missing_evidences:
        print(f"    ⚠️ {me}")
    for cc in res_r2.counter_argument.counter_claims:
        print(f"    ⚡ {cc}")

    print(f"\n>>> ROUND 2 STATUS: {res_r2.status} <<<\n")

    # ---------------------------------------------------------
    # ROUND 3: FINAL REVISED PROPOSAL (Fully Compliant & Validated -> RESOLVED)
    # ---------------------------------------------------------
    print("┌" + "─" * 78 + "┐")
    print("│ ROUND 3: FINAL REVISED PROPOSAL (Canary Auto-Scale & Load Tested)        │")
    print("└" + "─" * 78 + "┘")

    prop_r3 = Proposal(
        id="PROP-001-REV2",
        title="Canary Blue-Green Migration with Dynamic Auto-Scaling",
        description="Deploy 20% canary traffic with active read-replicas, dynamic auto-scaling up to 3x, and automated instant rollbacks.",
        proposed_by="LeadArch_Dev",
        parameters={
            "budget_allocation": 38000.0,
            "traffic_spike_multiplier": 2.5,
            "auto_failover": True,
            "prohibited_flags": []
        },
        evidences=[
            Evidence("EV-LOAD-99", "Synthetic 3x Peak Load Test Benchmark", "AutomatedPerfSuite", 0.96)
        ],
        risk_level="LOW"
    )

    print(f"[FINAL PROPOSAL SUBMITTED]: '{prop_r3.title}'")
    print(f"  Budget Requested: ${prop_r3.parameters['budget_allocation']:,.2f}")
    print(f"  Traffic Multiplier: {prop_r3.parameters['traffic_spike_multiplier']}x")
    print(f"  Evidence: {prop_r3.evidences[0].id} - {prop_r3.evidences[0].description} (Confidence: {prop_r3.evidences[0].confidence_score})")

    res_r3 = simulator.evaluate_proposal_round(3, prop_r3)

    print("\n[SAFETY AGENT EVALUATION]:")
    print(f"  Verdict: {res_r3.safety_verdict.verdict.value}")
    print(f"  Details: {res_r3.safety_verdict.details}")

    print("\n[MID-REASONING HISTORICAL MEMORY LOOKUP]:")
    for inc in res_r3.retrieved_incidents:
        print(f"  🔍 Past Precedent Found: [{inc.id}] {inc.title}")
        print(f"     Outcome: {inc.outcome}")

    print("\n[DEVIL'S ADVOCATE EVALUATION]:")
    print(f"  Challenge Summary: {res_r3.counter_argument.challenge_summary}")
    print(f"  Calculated Risk Score: {res_r3.counter_argument.risk_score:.2f}")

    print(f"\n>>> ROUND 3 STATUS: {res_r3.status} <<<")
    print("=" * 80)
    print("       NEGOTIATION CONVERGED & RESOLVED SUCCESSFULLY!")
    print("=" * 80 + "\n")

if __name__ == "__main__":
    run_transcript()
