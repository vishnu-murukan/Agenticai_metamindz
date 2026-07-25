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
        """Seed the memory bank with realistic manufacturing failure & negotiation incident reports."""
        default_incidents = [
            IncidentReport(
                id="INC-2024-089",
                title="Machine #4 Bearing Failure & Thermal Runaway",
                domain="Plant Maintenance",
                description="Operated Machine #4 CNC spindle without lubrication monitoring under 4x production throughput peak. Thermal expansion caused bearing lockup and conveyor line jam.",
                outcome="FAILURE: Production line suffered 42-minute factory floor shutdown.",
                risk_score=0.88,
                lessons_learned=[
                    "Enforce strict per-machine thermal and vibration limits.",
                    "Mandate predictive maintenance policies with automatic safety interlocks.",
                    "Never deploy production speed increases without load-test proof."
                ],
                tags=["manufacturing", "machine_4", "bearing_failure", "interlock", "shutdown"]
            ),
            IncidentReport(
                id="INC-2025-014",
                title="Uncapped CNC Tooling Budget Allocation",
                domain="Plant Operations",
                description="Approved $120k tooling upgrade budget without dynamic spend safety limits or ROI benchmarks during Q2 production run.",
                outcome="PARTIAL LOSS: Overspent by $45k with sub-1.0 ROI.",
                risk_score=0.75,
                lessons_learned=[
                    "Cap total unhedged tooling budget at $50,000.",
                    "Require SafetyAgent SOP approval for all tier-1 capital equipment changes."
                ],
                tags=["budget", "plant_operations", "overspend", "sop_violation"]
            ),
            IncidentReport(
                id="INC-2025-042",
                title="PLC Lockup under High Concurrent Conveyor Feed Rate",
                domain="Automation / PLC",
                description="Disabled redundant sensor checks during peak production run to save power costs, causing PLC input lock contention.",
                outcome="CRITICAL: Robot arm assembly failure rate hit 68%.",
                risk_score=0.92,
                lessons_learned=[
                    "Redundant PLC sensor feeds must remain active during any high-throughput event.",
                    "Staged rollout strategy required for PLC firmware and sensor updates."
                ],
                tags=["plc", "sensor_drift", "conveyor", "high_throughput", "redundancy"]
            ),
            IncidentReport(
                id="INC-2025-103",
                title="Successful Machine #4 Predictive Maintenance & Interlock Rollout",
                domain="Predictive Maintenance",
                description="Deployed gradual staged rollout on Machine #4 with 20% conveyor load, automated interlock triggers, and active sensor monitoring.",
                outcome="SUCCESS: Handled 5x production throughput with 99.99% operational uptime.",
                risk_score=0.15,
                lessons_learned=[
                    "Staged rollouts reduce blast radius on assembly lines effectively.",
                    "Pre-calibrated sensors mitigate calibration drift during scaling."
                ],
                tags=["staged_rollout", "predictive_maintenance", "success", "machine_4", "interlock"]
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
