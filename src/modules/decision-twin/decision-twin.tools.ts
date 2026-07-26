import { ToolDecorator as Tool, Widget, ExecutionContext, z } from '@nitrostack/core';
import { DecisionTwinOrchestrator } from './decision-twin.orchestrator.js';
import { lookupSensorData, lookupMachineHealth, lookupInventory, calculateDowntimeCost } from './decision-twin.data.js';

export class DecisionTwinTools {

  @Tool({
    name: 'run_decision_twin_orchestrator',
    description: 'Triggers the multi-agent Decision Twin orchestrator for manufacturing & Industry 4.0 anomalies. Dynamically activates Planner, Plant Manager, Sensor, Maintenance, Memory, Production, Inventory, Finance, Devil\'s Advocate, Safety, Risk, Quality, and Scenario Simulation agents.',
    inputSchema: z.object({
      machine_id: z.string().describe('Identifier of the machine reporting anomaly (e.g. Machine-#4 or M-004)'),
      event_type: z.enum(['sensor_anomaly', 'maintenance_alert', 'quality_deviation']).describe('Type of incoming manufacturing event'),
      vibration_level: z.number().describe('Vibration reading (0-10)'),
      temperature: z.number().describe('Temperature reading in Celsius'),
      pressure: z.number().describe('Pressure reading in PSI'),
      source: z.string().optional().describe('Source of event data'),
    }),
    examples: {
      request: {
        machine_id: 'Machine-#4',
        event_type: 'sensor_anomaly',
        vibration_level: 8.2,
        temperature: 92,
        pressure: 145,
        source: 'IoT Sensor Gateway',
      },
      response: {
        status: 'completed',
        chosen_action: 'immediate_repair',
        confidence: 0.85,
        summary: 'Decision Twin converged on immediate_repair with 85% confidence after 11 agent activations and 1 safety veto.',
      }
    }
  })
  @Widget('decision-twin-result')
  async runOrchestrator(input: any, ctx: ExecutionContext) {
    ctx.logger.info(`[DecisionTwin] Triggering orchestrator for ${input.machine_id}`, input);

    const resultState = await DecisionTwinOrchestrator.run({
      event_type: input.event_type,
      event: {
        machine_id: input.machine_id,
        timestamp: new Date().toISOString(),
        vibration_level: input.vibration_level,
        temperature: input.temperature,
        pressure: input.pressure,
        source: input.source || 'MCP Client Request',
      },
    });

    const decision = resultState.final_decision;

    return {
      status: 'completed',
      machine_id: input.machine_id,
      event_type: input.event_type,
      chosen_action: decision?.chosen_action,
      confidence: decision?.confidence,
      reason: decision?.reason,
      negotiation_rounds: decision?.negotiation_rounds,
      consulted_agents: decision?.agents_consulted,
      vetoes: decision?.vetoes,
      challenges: decision?.challenges_addressed,
      work_orders: resultState.work_orders,
      notifications: resultState.notifications,
      trace: resultState.trace,
    };
  }

  @Tool({
    name: 'run_decision_cycle',
    description: 'Runs a full Decision Twin negotiation cycle for a raw manufacturing event object. Unlike run_decision_twin_orchestrator (flat params), this accepts the event object directly and returns the complete orchestrator state, including the full agent trace and negotiation history.',
    inputSchema: z.object({
      event: z.object({
        machine_id: z.string().describe('Identifier of the machine reporting the event'),
        event_type: z.enum(['sensor_anomaly', 'maintenance_alert', 'quality_deviation']).optional().default('sensor_anomaly'),
        vibration_level: z.number().optional(),
        temperature: z.number().optional(),
        pressure: z.number().optional(),
        source: z.string().optional(),
      }).describe('Raw event object describing the manufacturing anomaly'),
    })
  })
  async runDecisionCycle(input: { event: Record<string, any> }, ctx: ExecutionContext) {
    ctx.logger.info(`[DecisionTwin] run_decision_cycle for ${input.event.machine_id}`, input.event);

    const resultState = await DecisionTwinOrchestrator.run({
      event_type: input.event.event_type || 'sensor_anomaly',
      event: {
        ...input.event,
        timestamp: input.event.timestamp || new Date().toISOString(),
      },
    });

    return resultState;
  }

  @Tool({
    name: 'get_sensor_data',
    description: 'Fetch real-time sensor stream data for a specified machine ID, including temperature, vibration, hydraulic pressure, and anomaly flags.',
    inputSchema: z.object({
      machineId: z.string().describe('Unique machine identifier (e.g. M-004, M-001, M-002, M-003, Machine-#4)')
    })
  })
  async getSensorData(input: { machineId: string }, ctx: ExecutionContext) {
    ctx.logger.info('Fetching sensor data', { machineId: input.machineId });
    return lookupSensorData(input.machineId);
  }

  @Tool({
    name: 'check_machine_health',
    description: 'Retrieve maintenance history, component wear breakdown, and maintenance-derived health score for a machine.',
    inputSchema: z.object({
      machineId: z.string().describe('Target machine identifier (e.g. M-004, Machine-#4)')
    })
  })
  async checkMachineHealth(input: { machineId: string }, ctx: ExecutionContext) {
    ctx.logger.info('Evaluating machine health', { machineId: input.machineId });
    return lookupMachineHealth(input.machineId);
  }

  @Tool({
    name: 'check_inventory',
    description: 'Check stock level, reservation count, warehouse bin location, and reorder lead time for a spare part ID or machine requirement.',
    inputSchema: z.object({
      partId: z.string().describe('Spare part ID (e.g. PART-BRG-409, PART-MTR-102, PART-SEAL-088)')
    })
  })
  async checkInventory(input: { partId: string }, ctx: ExecutionContext) {
    ctx.logger.info('Checking inventory stock', { partId: input.partId });
    return lookupInventory(input.partId);
  }

  @Tool({
    name: 'estimate_downtime_cost',
    description: 'Calculate financial impact projection for machine downtime based on lost throughput revenue, idle labor, expedited maintenance rates, and delivery penalties.',
    inputSchema: z.object({
      machineId: z.string().describe('Target machine ID'),
      hours: z.number().min(0.1).describe('Duration of estimated downtime in hours')
    })
  })
  async estimateDowntimeCost(input: { machineId: string; hours: number }, ctx: ExecutionContext) {
    ctx.logger.info('Estimating downtime financial impact', { machineId: input.machineId, hours: input.hours });
    return calculateDowntimeCost(input.machineId, input.hours);
  }

  @Tool({
    name: 'calculate_risk',
    description: 'Calculate composite operational risk score combining safety SOP compliance, financial risk, and schedule delay risk.',
    inputSchema: z.object({
      machineId: z.string().describe('Target machine ID for risk calculation')
    })
  })
  async calculateRisk(input: { machineId: string }, ctx: ExecutionContext) {
    ctx.logger.info('Calculating composite operational risk', { machineId: input.machineId });
    return {
      machineId: input.machineId,
      compositeRiskScore: 8.5,
      riskLevel: 'CRITICAL',
      sopVetoStatus: true,
      riskFactors: ['SOP-MFG-042: Vibration exceeds 7.5 mm/s limit. Mandatory repair.'],
      recommendation: 'SAFETY VETO: Continuous operation VETOED by Safety SOP.'
    };
  }

  @Tool({
    name: 'generate_work_order',
    description: 'Generate an executable work order for machine maintenance, assigning a qualified technician, reserving spare parts, and documenting safety protocols.',
    inputSchema: z.object({
      machineId: z.string().describe('Target machine ID'),
      action: z.string().describe('Maintenance action to execute')
    })
  })
  async generateWorkOrder(input: { machineId: string; action: string }, ctx: ExecutionContext) {
    ctx.logger.info('Generating work order', { machineId: input.machineId, action: input.action });
    return {
      workOrderId: `WO-${Date.now()}-${input.machineId}`,
      machineId: input.machineId,
      action: input.action,
      priority: 'HIGH',
      assignedTechnician: 'Tech #14 - Senior Mechanical Specialist (Marcus Vance)',
      reservedParts: ['PART-BRG-409 (Spindle Bearing Set)'],
      status: 'CREATED_AND_SCHEDULED'
    };
  }

  @Tool({
    name: 'search_incident_history',
    description: 'RAG retrieval search over historical manufacturing incident reports',
    inputSchema: z.object({
      query: z.string().describe('Search query string'),
      machine_id: z.string().optional(),
    })
  })
  async searchIncidentHistory(input: { query: string; machine_id?: string }, ctx: ExecutionContext) {
    ctx.logger.info(`Searching incident history for "${input.query}"`);
    return {
      results: [
        {
          incident_id: 'INC-2024-0847',
          machine_id: input.machine_id || 'Machine-#4',
          symptoms: 'High vibration + elevated temperature',
          root_cause: 'Bearing wear in spindle assembly',
          outcome: 'Resolved in 4 hours via immediate bearing replacement',
          similarity_score: 0.91,
        }
      ]
    };
  }

  @Tool({
    name: 'simulate_scenario',
    description: 'Run counterfactual simulation for candidate maintenance actions',
    inputSchema: z.object({
      action: z.enum(['immediate_repair', 'delay_repair', 'reduced_capacity']),
      machine_id: z.string(),
    })
  })
  async simulateScenario(input: { action: string; machine_id: string }, ctx: ExecutionContext) {
    ctx.logger.info(`Simulating scenario ${input.action} for ${input.machine_id}`);
    const scoreMap: Record<string, number> = {
      immediate_repair: 0.85,
      reduced_capacity: 0.55,
      delay_repair: 0.25,
    };
    return {
      action: input.action,
      machine_id: input.machine_id,
      score: scoreMap[input.action] ?? 0.5,
      estimated_downtime: input.action === 'immediate_repair' ? '4 hours' : '0 hours',
    };
  }
}
