# Decision Twin — Multi-Agent Manufacturing Decision System

**MCP Agentic AI Hackathon | Manufacturing & Industry 4.0**

## What is this?

A **Decision Twin** — a multi-agent system that models *organizational reasoning*, not just machine state. When a manufacturing event occurs (sensor anomaly, maintenance alert, quality deviation), the system dynamically activates a team of AI agents that gather evidence, debate the best course of action, enforce safety rules, simulate alternatives, and produce executable decisions (work orders, notifications, schedule updates).

## Architecture

```
Event → PlannerAgent → PlantManager(dispatch) → [Sub-Agents] → PlantManager(converge) → Decision
                              ↑                       |
                              └───────────────────────┘
                                   (dispatch loop)
```

### Agents (12 total, 5 layers)

| Layer | Agents |
|-------|--------|
| **Planning** | PlannerAgent, PlantManagerAgent |
| **Evidence** | SensorAgent, MaintenanceAgent, MemoryAgent, ProductionAgent, InventoryAgent, FinanceAgent |
| **Reflection** | DevilsAdvocateAgent, SafetyAgent, RiskAgent |
| **Simulation** | ScenarioSimulationAgent, QualityAgent |

### Key Patterns
- **Dynamic goal decomposition** — Planner creates different sub-goal lists based on event type + severity
- **Blackboard pattern** — shared state all agents read/write to
- **Phase-based dispatch** — Evidence → Reflection → Simulation → Convergence
- **Safety veto power** — SafetyAgent can veto proposals that violate SOPs
- **Devil's Advocate reflection** — forces re-evaluation of leading proposals
- **Counterfactual simulation** — compares repair-now / delay / reduced-capacity

## Quick Start

```bash
# Install dependencies
pip install -r requirements.txt

# Run the demo (Machine #4 vibration anomaly)
python main.py
```

## Project Structure

```
src/
  orchestrator/
    state.py           # Shared TypedDict state schema (blackboard)
    planner.py         # PlannerAgent — dynamic goal decomposition
    plant_manager.py   # PlantManagerAgent — dispatch loop + convergence
    sub_agents.py      # 11 stub agents across evidence/reflection/simulation
    graph.py           # LangGraph StateGraph wiring
main.py                # Demo runner with mock events
requirements.txt       # langgraph, langchain-core
```

## Git Workflow

- Work on `feat/orchestrator` branch
- Never push to `main` directly
- Commit often, push freely to your own branch
- Team lead merges at sync points

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Orchestration | LangGraph (StateGraph) |
| MCP Layer | NitroStack MCP Server |
| Backend | FastAPI |
| Knowledge | RAG + FAISS/ChromaDB |
| Frontend | React + Tailwind CSS |
| LLM | GPT / Llama / Gemma |
