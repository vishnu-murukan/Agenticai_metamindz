# Decision Twin — MCP Server (NitroStack TypeScript)

> **An Agentic AI Operating System for Manufacturing Decisions**  
> Built for the NitroStack × Amrita University Hackathon using the official **NitroStack TypeScript SDK (`@nitrostack/core`)**.

---

## 📌 Project Overview

**Decision Twin** models how a manufacturing plant makes operational decisions. Rather than relying on a single general-purpose assistant, Decision Twin coordinates specialized AI agents (Sensor, Maintenance, Inventory, Finance, Safety, Planner) that gather evidence, query precedent, calculate operational risk, and issue executable work orders.

This project implements the core **Model Context Protocol (MCP) Server** using the official **NitroStack TypeScript SDK**.

---

## 🏗️ System Architecture

The MCP Server exposes tools, resources, and prompts organized across 5 agentic capabilities:

```
                          ┌───────────────────────────┐
                          │   Plant Manager Agent     │
                          └─────────────┬─────────────┘
                                        │
             ┌──────────────────────────┼──────────────────────────┐
             ▼                          ▼                          ▼
   ┌───────────────────┐      ┌───────────────────┐      ┌───────────────────┐
   │ Tool-Use Layer    │      │ Reflection/Safety │      │ Memory & Resources│
   ├───────────────────┤      ├───────────────────┤      ├───────────────────┤
   │ get_sensor_data   │      │ calculate_risk    │      │ plant/sensor-     │
   │ check_machine_    │      │ (SOP Veto logic)  │      │ overview          │
   │ health            │      └───────────────────┘      │ sop/safety-rules  │
   │ check_inventory   │                                 └───────────────────┘
   │ estimate_downtime_│      ┌───────────────────┐
   │ cost              │      │ Executable Output │
   └───────────────────┘      ├───────────────────┤
                              │ generate_work_    │
                              │ order             │
                              └───────────────────┘
```

---

## 🛠️ MCP Tools Specification (`@Tool()` Decorators with Zod Schemas)

All tools are implemented in [`src/modules/decision-twin/decision-twin.tools.ts`](src/modules/decision-twin/decision-twin.tools.ts) with full type-safe Zod schema validation:

| Tool Name | Parameters | Description |
| :--- | :--- | :--- |
| **`get_sensor_data`** | `machineId: string` | Fetches real-time telemetry (`temp`, `vibration`, `bearingTemp`, `pressure`, `RPM`) & flags baseline anomaly thresholds (e.g. `M-004` high vibration 8.4 mm/s). |
| **`check_machine_health`** | `machineId: string` | Evaluates maintenance-derived health score (0-100), status levels (`Good`, `Fair`, `Degraded`, `Critical`), component wear breakdown, and action recommendations. |
| **`check_inventory`** | `partId: string` | Checks spare parts stock levels, warehouse bin locations (e.g. `Warehouse B - Bin 14-C`), reorder thresholds, unit costs ($), and lead times. |
| **`estimate_downtime_cost`** | `machineId: string`, `hours: number` | Computes financial downtime projections (lost production revenue, idle labor, expedited repair fees, SLA late penalties). |
| **`calculate_risk`** | `machineId: string` | Calculates composite operational risk score (0.0 to 10.0 scale) combining safety, financial, and schedule impact. Enforces **SOP Safety Rule Vetoes**. |
| **`generate_work_order`** | `machineId: string`, `action: string` | Generates an executable maintenance work order with priority levels, assigned technician, reserved parts, and Lockout/Tagout (LOTO) safety protocols. |

---

## 📂 Project Structure

```
.
├── src/
│   ├── app.module.ts              # Root NitroStack application module
│   ├── index.ts                   # MCP server entry point
│   ├── health/                    # System health checks
│   └── modules/
│       └── decision-twin/
│           ├── decision-twin.module.ts     # DecisionTwinModule definition
│           ├── decision-twin.tools.ts      # 6 MCP @Tool definitions
│           ├── decision-twin.resources.ts  # Plant sensor & SOP @Resource definitions
│           └── decision-twin.prompts.ts    # Anomaly investigation @Prompt definitions
├── dist/                          # Compiled TypeScript production bundle
├── test-tools.ts                  # Verification test script
├── package.json                   # Dependencies (@nitrostack/core, zod)
└── tsconfig.json                  # TypeScript configuration
```

---

## ⚙️ Environment Setup & Installation

### Prerequisites
- **Node.js**: v18+ (v20.x recommended)
- **Git**: Installed & configured
- **Package Manager**: `npm` or `pnpm`

### Installation Steps

1. **Clone the repository**:
   ```bash
   git clone https://github.com/vishnu-murukan/metamindz_hackathon_agenticai.git
   cd metamindz_hackathon_agenticai
   git checkout feat/mcp-tools
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Verify MCP Tools locally**:
   ```bash
   npx tsx test-tools.ts
   ```

4. **Build the production bundle**:
   ```bash
   npm run build
   ```

5. **Start the MCP Server**:
   ```bash
   npm start
   ```

---

## 💻 Visual Testing with NitroStudio

1. Download & install [NitroStudio Desktop IDE](https://nitrostack.ai/studio).
2. Open NitroStudio -> Click **Add Server** -> Select **Nitro Project**.
3. Point to this directory (`Metamindz`).
4. Explore and execute tools interactively under **App -> Tools** in NitroStudio Canvas!

---

## ☁️ Deployment on NitroCloud

This server is prepared for one-click deployment on **NitroCloud**:
1. Connect your repository on [NitroCloud Dashboard](https://nitrocloud.ai).
2. Enable Auto-Deploy on branch `feat/mcp-tools`.

---

## 📜 Compliance with Hackathon Guidelines
- ✅ **100% TypeScript**: Built exclusively with the official **NitroStack TypeScript SDK (`@nitrostack/core`)**.
- ✅ **Zero Secrets/Env files in Git**: Strictly clean `.gitignore`.
- ✅ **Tested & Verified**: Complete test suite passed locally before pushing.
