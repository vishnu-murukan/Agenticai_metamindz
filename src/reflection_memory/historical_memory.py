import faiss
import numpy as np
from typing import List, Tuple, Dict, Any
from sklearn.feature_extraction.text import TfidfVectorizer
from .models import IncidentReport

class HistoricalMemoryAgent:
    """
    HistoricalMemoryAgent provides RAG capability over past incident reports using FAISS.
    It can be queried mid-reasoning at any stage of negotiation to fetch past decisions,
    failures, and mitigation lessons learned.
    """

    def __init__(self, agent_id: str = "HistoricalMemory_01"):
        self.agent_id = agent_id
        self.incidents: List[IncidentReport] = []
        self.vectorizer = TfidfVectorizer(stop_words='english', max_features=512)
        self.index: faiss.IndexFlatIP = None  # Inner product index for cosine similarity
        self.is_fitted = False
        self._seed_default_incidents()

    def _seed_default_incidents(self):
        """Seed the memory bank with realistic system failure & negotiation incident reports."""
        default_incidents = [
            IncidentReport(
                id="INC-2024-089",
                title="Monolith Cloud Migration Memory Leak",
                domain="Infrastructure",
                description="Migrated core service without worker thread pool limits under 4x traffic peak. Memory footprint spiked, causing cascading pod crashes.",
                outcome="FAILURE: System suffered 42-minute global outage.",
                risk_score=0.88,
                lessons_learned=[
                    "Enforce strict per-container memory limits.",
                    "Mandate auto-scaling policies with automatic failover.",
                    "Never deploy capacity changes without load-test proof."
                ],
                tags=["infrastructure", "traffic_spike", "memory_leak", "failover", "outage"]
            ),
            IncidentReport(
                id="INC-2025-014",
                title="Uncapped Marketing Budget Allocation",
                domain="Finance",
                description="Approved $120k ad campaign budget without dynamic spend safety limits or ROI benchmarks during Q2 launch.",
                outcome="PARTIAL LOSS: Overspent by $45k with sub-1.0 ROI.",
                risk_score=0.75,
                lessons_learned=[
                    "Cap total unhedged campaign budget at $50,000.",
                    "Require SafetyAgent SOP approval for all tier-1 budget changes."
                ],
                tags=["budget", "finance", "overspend", "sop_violation"]
            ),
            IncidentReport(
                id="INC-2025-042",
                title="Database Deadlock under High Concurrent Write Rate",
                domain="Database",
                description="Disabled read-replicas during peak flash sale to save infrastructure costs, causing database lock contention.",
                outcome="CRITICAL: Transaction failure rate hit 68%.",
                risk_score=0.92,
                lessons_learned=[
                    "Read-replicas must remain active during any high-concurrency event.",
                    "Blue-green deployment strategy required for DB schema updates."
                ],
                tags=["database", "deadlock", "concurrency", "traffic_spike", "replicas"]
            ),
            IncidentReport(
                id="INC-2025-103",
                title="Successful Auto-Scale Rollout with Fallback Strategy",
                domain="Infrastructure",
                description="Deployed gradual blue-green rollout with 20% canary traffic, automated fallback triggers, and active load monitoring.",
                outcome="SUCCESS: Handled 5x peak traffic with 99.99% availability.",
                risk_score=0.15,
                lessons_learned=[
                    "Canary deployments reduce blast radius effectively.",
                    "Pre-warmed instances mitigate latency spikes during scaling."
                ],
                tags=["canary", "auto_scaling", "success", "blue_green", "fallback"]
            )
        ]
        for inc in default_incidents:
            self.add_incident(inc)
        self.build_index()

    def add_incident(self, incident: IncidentReport):
        self.incidents.append(incident)
        self.is_fitted = False

    def build_index(self):
        """Build FAISS vector index over all stored incident descriptions and tags."""
        if not self.incidents:
            return

        corpus = [
            f"{inc.title} {inc.domain} {inc.description} {' '.join(inc.tags)} {' '.join(inc.lessons_learned)}"
            for inc in self.incidents
        ]

        tfidf_matrix = self.vectorizer.fit_transform(corpus).toarray().astype(np.float32)
        # Normalize vectors for Cosine Similarity using Inner Product index
        faiss.normalize_L2(tfidf_matrix)

        dimension = tfidf_matrix.shape[1]
        self.index = faiss.IndexFlatIP(dimension)
        self.index.add(tfidf_matrix)
        self.is_fitted = True

    def query_mid_reasoning(self, query: str, top_k: int = 2) -> List[Tuple[IncidentReport, float]]:
        """
        Queryable mid-reasoning at any point during negotiation loop.
        Returns list of (IncidentReport, similarity_score) tuples.
        """
        if not self.is_fitted or self.index is None:
            self.build_index()

        query_vec = self.vectorizer.transform([query]).toarray().astype(np.float32)
        faiss.normalize_L2(query_vec)

        scores, indices = self.index.search(query_vec, min(top_k, len(self.incidents)))

        results = []
        for idx, score in zip(indices[0], scores[0]):
            if idx >= 0 and idx < len(self.incidents):
                results.append((self.incidents[idx], float(score)))

        return results
