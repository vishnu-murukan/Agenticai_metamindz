from dataclasses import dataclass, field
from enum import Enum
from typing import List, Dict, Any, Optional

class VerdictType(str, Enum):
    APPROVED = "APPROVED"
    CONDITIONAL_APPROVAL = "CONDITIONAL_APPROVAL"
    HARD_VETO = "HARD_VETO"

class SOPCategory(str, Enum):
    BUDGET = "BUDGET"
    SECURITY = "SECURITY"
    OPERATIONAL_BLAST_RADIUS = "OPERATIONAL_BLAST_RADIUS"
    COMPLIANCE = "COMPLIANCE"

@dataclass
class Evidence:
    id: str
    description: str
    source: str
    confidence_score: float  # 0.0 to 1.0
    metadata: Dict[str, Any] = field(default_factory=dict)

@dataclass
class Proposal:
    id: str
    title: str
    description: str
    proposed_by: str
    parameters: Dict[str, Any]
    evidences: List[Evidence] = field(default_factory=list)
    risk_level: str = "MEDIUM"  # LOW, MEDIUM, HIGH, CRITICAL

@dataclass
class CounterArgument:
    agent_id: str
    challenge_summary: str
    missing_evidences: List[str]
    counter_claims: List[str]
    renegotiation_required: bool
    risk_score: float  # 0.0 to 1.0

@dataclass
class IncidentReport:
    id: str
    title: str
    domain: str
    description: str
    outcome: str
    risk_score: float
    lessons_learned: List[str]
    tags: List[str]

@dataclass
class SOPRule:
    rule_id: str
    name: str
    category: SOPCategory
    max_threshold: Optional[float] = None
    min_threshold: Optional[float] = None
    prohibited_actions: List[str] = field(default_factory=list)
    remediation_advice: str = ""

@dataclass
class SafetyVerdict:
    verdict: VerdictType
    violated_rules: List[str]
    remediation_required: List[str]
    details: str

@dataclass
class NegotiationRound:
    round_number: int
    proposal: Proposal
    counter_argument: Optional[CounterArgument] = None
    retrieved_incidents: List[IncidentReport] = field(default_factory=list)
    safety_verdict: Optional[SafetyVerdict] = None
    status: str = "PENDING"  # PENDING, CHALLENGED, VETOED, REVISED, RESOLVED
