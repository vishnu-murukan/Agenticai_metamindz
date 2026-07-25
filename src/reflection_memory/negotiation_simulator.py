from typing import List, Tuple
from .models import Proposal, NegotiationRound, SafetyVerdict, VerdictType, CounterArgument, IncidentReport
from .devils_advocate import DevilsAdvocateAgent
from .historical_memory import HistoricalMemoryAgent
from .safety_agent import SafetyAgent

class NegotiationSimulator:
    """
    NegotiationSimulator coordinates multi-round decision negotiation between agents:
    - Proposal Submission
    - SafetyAgent SOP Check (Veto / Conditional / Pass)
    - HistoricalMemoryAgent Mid-Reasoning RAG retrieval
    - DevilsAdvocateAgent Risk & Evidence Challenge
    - Revision & Final Resolution
    """

    def __init__(
        self,
        devils_advocate: DevilsAdvocateAgent = None,
        historical_memory: HistoricalMemoryAgent = None,
        safety_agent: SafetyAgent = None
    ):
        self.devils_advocate = devils_advocate or DevilsAdvocateAgent()
        self.historical_memory = historical_memory or HistoricalMemoryAgent()
        self.safety_agent = safety_agent or SafetyAgent()
        self.history: List[NegotiationRound] = []

    def evaluate_proposal_round(self, round_number: int, proposal: Proposal) -> NegotiationRound:
        # Step 1: Safety Agent Evaluation (SOP Rules & Hard Veto)
        safety_verdict = self.safety_agent.validate_proposal(proposal)

        # Step 2: Mid-Reasoning Memory Lookup using Proposal Query
        memory_query = f"{proposal.title} {proposal.description} {' '.join(proposal.parameters.keys())}"
        retrieved_results: List[Tuple[IncidentReport, float]] = self.historical_memory.query_mid_reasoning(
            query=memory_query, top_k=2
        )
        retrieved_incidents = [inc for inc, score in retrieved_results]

        # Step 3: Devil's Advocate Agent Evaluation with Historical Context
        counter_arg = self.devils_advocate.evaluate_proposal(
            proposal=proposal,
            context_incidents=retrieved_incidents
        )

        # Step 4: Determine Round Status
        if safety_verdict.verdict == VerdictType.HARD_VETO:
            status = "VETOED"
        elif counter_arg.renegotiation_required:
            status = "CHALLENGED"
        else:
            status = "RESOLVED"

        negotiation_round = NegotiationRound(
            round_number=round_number,
            proposal=proposal,
            counter_argument=counter_arg,
            retrieved_incidents=retrieved_incidents,
            safety_verdict=safety_verdict,
            status=status
        )

        self.history.append(negotiation_round)
        return negotiation_round
