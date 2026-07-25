# Decision Twin — Multi-Agent Manufacturing Decision System

**MCP Agentic AI Hackathon | Manufacturing & Industry 4.0**

Built with **NitroStack MCP Server (TypeScript)** for NitroStack Cloud & Studio deployment.

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

### Key Features & MCP Tools
Exposed via NitroStack `@Tool` decorators:
- `run_decision_twin_orchestrator` — Triggers full multi-agent orchestrator lifecycle
- `get_sensor_data` — Reads live IoT sensor streams
- `check_machine_health` — Evaluates machine health & failure probability
- `search_incident_history` — RAG search over past manufacturing incidents
- `simulate_scenario` — Evaluates counterfactual maintenance actions

## Quick Start

```bash
# Install dependencies
npm install

# Run TypeScript Demo Test (Machine #4 Anomaly)
npx tsx test-demo.ts

# Start local NitroStack MCP Server (dev mode)
npm run dev

# Build for production & deployment
npm run build
```

## Project Structure

```
src/
  modules/
    decision-twin/
      decision-twin.state.ts        # Shared blackboard state interfaces
      decision-twin.planner.ts      # PlannerAgent node
      decision-twin.plant-manager.ts# PlantManager dispatch & convergence nodes
      decision-twin.sub-agents.ts   # 11 evidence/reflection/simulation sub-agents
      decision-twin.orchestrator.ts # Orchestrator engine state machine
      decision-twin.tools.ts       # NitroStack MCP Tool definitions (@Tool)
      decision-twin.module.ts      # NitroStack module
  app.module.ts                    # Root NitroStack App Module
  index.ts                         # Bootstrap entry point
test-demo.ts                       # Command-line demo runner
```

## Git Workflow

- Work on `feat/orchestrator` branch
- Commit often, push freely to your own branch
- Team lead merges at sync points
