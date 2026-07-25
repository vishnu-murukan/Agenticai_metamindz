from typing import List, Optional
from .models import Proposal, SOPRule, SafetyVerdict, VerdictType, SOPCategory

class SafetyAgent:
    """
    SafetyAgent validates proposed actions against predefined SOP rules.
    It can issue HARD_VETO to block unsafe or non-compliant decisions immediately.
    """

    def __init__(self, agent_id: str = "SafetyAgent_01", rules: Optional[List[SOPRule]] = None):
        self.agent_id = agent_id
        self.rules: List[SOPRule] = rules if rules is not None else self._get_default_sop_rules()

    def _get_default_sop_rules(self) -> List[SOPRule]:
        return [
            SOPRule(
                rule_id="SOP-BUDGET-01",
                name="Maximum Single Proposal Budget Cap",
                category=SOPCategory.BUDGET,
                max_threshold=50000.0,
                remediation_advice="Reduce proposed equipment budget allocation to $50,000 or below."
            ),
            SOPRule(
                rule_id="SOP-OPS-02",
                name="High Production Throughput Interlock Enforcement",
                category=SOPCategory.OPERATIONAL_BLAST_RADIUS,
                prohibited_actions=["no_auto_failover", "disable_replicas"],
                remediation_advice="Enable automated safety interlock and redundant conveyor sensor feeds."
            ),
            SOPRule(
                rule_id="SOP-SEC-03",
                name="Unverified High-Risk Machine Operation Prohibition",
                category=SOPCategory.SECURITY,
                prohibited_actions=["skip_load_testing", "bypass_security_scan"],
                remediation_advice="Include valid machine load testing evidence and safety inspection reports."
            )
        ]

    def validate_proposal(self, proposal: Proposal) -> SafetyVerdict:
        violated_rules = []
        remediations = []
        has_hard_veto = False

        params = proposal.parameters or {}

        # 1. Budget Cap Rule Check
        budget = params.get("budget_allocation", 0.0)
        for rule in self.rules:
            if rule.category == SOPCategory.BUDGET and rule.max_threshold is not None:
                if budget > rule.max_threshold:
                    violated_rules.append(
                        f"{rule.rule_id} ({rule.name}): Proposed budget (${budget:,.2f}) exceeds max allowed threshold (${rule.max_threshold:,.2f})."
                    )
                    remediations.append(rule.remediation_advice)
                    has_hard_veto = True

        # 2. Operational Prohibited Actions Check
        prohibited_in_proposal = params.get("prohibited_flags", [])
        if params.get("auto_failover") is False:
            prohibited_in_proposal.append("no_auto_failover")
        if params.get("skip_load_testing") is True:
            prohibited_in_proposal.append("skip_load_testing")

        for rule in self.rules:
            for action in rule.prohibited_actions:
                if action in prohibited_in_proposal:
                    violated_rules.append(
                        f"{rule.rule_id} ({rule.name}): Prohibited operational flag '{action}' detected."
                    )
                    remediations.append(rule.remediation_advice)
                    if rule.category in [SOPCategory.OPERATIONAL_BLAST_RADIUS, SOPCategory.SECURITY]:
                        has_hard_veto = True

        # 3. Formulate Verdict
        if has_hard_veto:
            verdict_type = VerdictType.HARD_VETO
            details = f"HARD VETO ISSUED: Proposal '{proposal.title}' violates {len(violated_rules)} critical SOP rule(s)."
        elif violated_rules:
            verdict_type = VerdictType.CONDITIONAL_APPROVAL
            details = f"CONDITIONAL APPROVAL: Proposal requires remediation before deployment."
        else:
            verdict_type = VerdictType.APPROVED
            details = f"SAFETY APPROVED: Proposal '{proposal.title}' complies with all standard operating procedures."

        return SafetyVerdict(
            verdict=verdict_type,
            violated_rules=violated_rules,
            remediation_required=remediations,
            details=details
        )
