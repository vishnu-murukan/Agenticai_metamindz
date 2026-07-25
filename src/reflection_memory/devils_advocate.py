from typing import List, Dict, Any
from .models import Proposal, CounterArgument, Evidence

class DevilsAdvocateAgent:
    """
    DevilsAdvocateAgent takes a proposed decision and its supporting evidence,
    critically analyzes risks, logical holes, and missing evidence, and issues
    a structured CounterArgument with a flag indicating if renegotiation is required.
    """

    def __init__(
        self,
        agent_id: str = "DevilsAdvocate_01",
        min_evidence_confidence: float = 0.75,
        risk_tolerance_threshold: float = 0.6
    ):
        self.agent_id = agent_id
        self.min_evidence_confidence = min_evidence_confidence
        self.risk_tolerance_threshold = risk_tolerance_threshold

    def evaluate_proposal(
        self,
        proposal: Proposal,
        context_incidents: List[Any] = None
    ) -> CounterArgument:
        missing_evidences = []
        counter_claims = []
        calculated_risk = 0.0

        # 1. Evaluate Evidence Quality & Confidence
        if not proposal.evidences:
            missing_evidences.append("No empirical evidence provided to support proposal parameters.")
            calculated_risk += 0.4
        else:
            low_conf_evidences = [
                e for e in proposal.evidences
                if e.confidence_score < self.min_evidence_confidence
            ]
            if low_conf_evidences:
                for e in low_conf_evidences:
                    missing_evidences.append(
                        f"Evidence '{e.id}' ({e.description}) has low confidence score ({e.confidence_score:.2f} < {self.min_evidence_confidence}). Rigorous benchmark evidence required."
                    )
                calculated_risk += 0.25 * len(low_conf_evidences)

        # 2. Check for Specific Risk Factors in Parameters
        params = proposal.parameters or {}

        # Production throughput speed scaling risk check
        if params.get("traffic_spike_multiplier", 1.0) > 3.0 and not any("load_test" in e.id.lower() or "load" in e.description.lower() for e in proposal.evidences):
            missing_evidences.append("Machine stress/load testing results under 3x+ throughput multiplier missing.")
            counter_claims.append("High production speed scaling without verified load tests risks cascading machine and conveyor line failure.")
            calculated_risk += 0.35

        # Failover / Safety interlock mechanism risk check
        if params.get("auto_failover") is False and proposal.risk_level in ["HIGH", "CRITICAL"]:
            counter_claims.append("Manual safety interlock override for high-risk Machine #4 operation introduces unacceptably high downtime (MTTR).")
            calculated_risk += 0.3

        # Cost / Resource efficiency risk check
        if params.get("budget_allocation", 0) > 50000 and params.get("roi_estimate", 0.0) < 1.2:
            counter_claims.append(f"Budget allocation (${params.get('budget_allocation')}) has low estimated ROI ({params.get('roi_estimate')}).")
            calculated_risk += 0.2

        # 3. Incorporate Historical Context if present
        if context_incidents:
            for inc in context_incidents:
                if getattr(inc, 'risk_score', 0) > 0.7:
                    counter_claims.append(
                        f"Past incident '{getattr(inc, 'title', 'Incident')}' ({getattr(inc, 'id', '')}) indicates potential recurrence of: {getattr(inc, 'outcome', '')}"
                    )
                    calculated_risk += 0.2

        # Normalize risk score between 0.0 and 1.0
        risk_score = min(1.0, calculated_risk)
        renegotiation_required = (risk_score >= self.risk_tolerance_threshold) or (len(missing_evidences) > 0)

        # Build challenge summary
        if renegotiation_required:
            summary = (
                f"CHALLENGE ISSUED: Proposal '{proposal.title}' exhibits risk score {risk_score:.2f} "
                f"with {len(missing_evidences)} missing evidence requirement(s) and {len(counter_claims)} counter-claims."
            )
        else:
            summary = f"PASSED DEVIL'S ADVOCATE: Proposal '{proposal.title}' meets initial risk and evidence standards."

        return CounterArgument(
            agent_id=self.agent_id,
            challenge_summary=summary,
            missing_evidences=missing_evidences,
            counter_claims=counter_claims,
            renegotiation_required=renegotiation_required,
            risk_score=risk_score
        )
