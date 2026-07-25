# Decision Twin — Multi-Agent MCP System (TypeScript/NitroStack)

> **An Agentic AI Operating System for Manufacturing & Industry 4.0**  
> Built for the NitroStack × Amrita University Hackathon using the official **NitroStack TypeScript SDK (`@nitrostack/core`)**.

---

## 📌 Project Overview

**Decision Twin** models how a manufacturing plant makes operational decisions. When an anomaly occurs (e.g. sensor overheating, high vibration, quality deviation), Decision Twin dynamically coordinates a team of 12 specialized AI agents (Planner, Plant Manager, Sensor, Maintenance, Inventory, Finance, Devil's Advocate, Safety, Risk, Quality, Scenario Simulation) to gather evidence, query precedent, calculate operational risk, evaluate counterfactuals, and generate executable work orders.

---

## 🏗️ System Architecture

```
Event → PlannerAgent → PlantManager(dispatch) → [Sub-Agents] → PlantManager(converge) → Executable Decision
                              ↑                       |
                              └───────────────────────┘
                                   (dispatch loop)
```

### Agents (12 total across 5 layers)

| Layer | Agents | Function |
| :--- | :--- | :--- |
| **Planning** | PlannerAgent, PlantManagerAgent | Dynamic goal decomposition & phase-based meta-dispatch |
| **Evidence** | Sensor, Maintenance, Memory, Production, Inventory, Finance | Autonomous tool execution & blackboard evidence collection |
| **Reflection** | Devil's Advocate, SafetyAgent, RiskAgent | Self-critique challenge loop, composite risk, **SOP Safety Veto** |
| **Simulation** | ScenarioSimulationAgent, QualityAgent | Counterfactual action scoring & downstream quality defect risk |

---

## 🛠️ MCP Tools Specification (`@Tool()` Decorators with Zod Schemas)

All tools are implemented in [`src/modules/decision-twin/decision-twin.tools.ts`](src/modules/decision-twin/decision-twin.tools.ts) with full type-safe Zod schema validation:

| Tool Name | Parameters | Description |
| :--- | :--- | :--- |
| **`run_decision_twin_orchestrator`** | `machine_id`, `event_type`, `vibration_level`, `temperature`, `pressure` | Triggers the complete 12-agent Decision Twin orchestrator lifecycle. |
| **`get_sensor_data`** | `machineId: string` | Fetches real-time telemetry (`temp`, `vibration`, `bearingTemp`, `pressure`, `RPM`) & flags baseline anomaly thresholds. |
| **`check_machine_health`** | `machineId: string` | Evaluates maintenance-derived health score (0-100), component wear breakdown, and action recommendations. |
| **`check_inventory`** | `partId: string` | Checks spare parts stock levels, warehouse bin locations (e.g. `Warehouse B - Bin 14-C`), reorder thresholds, and lead times. |
| **`estimate_downtime_cost`** | `machineId: string`, `hours: number` | Computes financial downtime projections (lost production revenue, idle labor, expedited repair fees, SLA penalties). |
| **`calculate_risk`** | `machineId: string` | Calculates composite operational risk score (0.0 to 10.0 scale) combining safety, financial, and schedule impact. Enforces **SOP Safety Rule Vetoes**. |
| **`generate_work_order`** | `machineId: string`, `action: string` | Generates an executable maintenance work order with priority levels, assigned technician, reserved parts, and Lockout/Tagout (LOTO) safety protocols. |
| **`search_incident_history`** | `query: string` | RAG retrieval search over historical manufacturing incident reports. |
| **`simulate_scenario`** | `action: string`, `machineId: string` | Counterfactual scenario scoring for candidate maintenance actions. |

---

## ⚙️ Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Run TypeScript Multi-Agent Orchestrator Demo (Machine #4 Anomaly)
npx tsx test-demo.ts

# 3. Run MCP Tools verification test
npx tsx test-tools.ts

# 4. Start local NitroStack MCP Server (dev mode)
npm run dev

# 5. Build for production & deployment
npm run build
```

---

## 📂 Project Structure

```
.
├── src/
│   ├── app.module.ts              # Root NitroStack application module
│   ├── index.ts                   # MCP server entry point
│   ├── health/                    # System health checks
│   ├── reflection_memory/         # Reflection & Memory module
│   └── modules/
│       └── decision-twin/
│           ├── decision-twin.state.ts        # Shared blackboard state interfaces
│           ├── decision-twin.planner.ts      # PlannerAgent node
│           ├── decision-twin.plant-manager.ts# PlantManager dispatch & convergence nodes
│           ├── decision-twin.sub-agents.ts   # 11 evidence/reflection/simulation sub-agents
│           ├── decision-twin.orchestrator.ts # Orchestrator state machine engine
│           ├── decision-twin.tools.ts      # NitroStack @Tool definitions
│           ├── decision-twin.resources.ts  # Plant sensor & SOP @Resource definitions
│           └── decision-twin.prompts.ts    # Anomaly investigation @Prompt definitions
├── test-demo.ts                   # Orchestrator demo runner
├── test-tools.ts                  # Tools test runner
├── package.json                   # Dependencies (@nitrostack/core, zod)
└── tsconfig.json                  # TypeScript configuration
```

---

## 📜 Compliance with Hackathon Guidelines
- ✅ **100% TypeScript**: Built exclusively with the official **NitroStack TypeScript SDK (`@nitrostack/core`)**.
- ✅ **Zero Secrets/Env files in Git**: Clean `.gitignore`.
- ✅ **Tested & Verified**: Production bundle compiled and tested cleanly.
