import { ToolDecorator as Tool, ExecutionContext, z } from '@nitrostack/core';
import { DecisionTwinOrchestrator } from './decision-twin.orchestrator.js';

export class DecisionTwinTools {

  @Tool({
    name: 'run_decision_twin_orchestrator',
    description: 'Triggers the multi-agent Decision Twin orchestrator for manufacturing & Industry 4.0 anomalies. Dynamically activates Planner, Plant Manager, Sensor, Maintenance, Memory, Production, Inventory, Finance, Devil\'s Advocate, Safety, Risk, Quality, and Scenario Simulation agents.',
    inputSchema: z.object({
      machine_id: z.string().describe('Identifier of the machine reporting anomaly (e.g. Machine-#4)'),
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
  async runOrchestrator(input: any, ctx: ExecutionContext) {
    ctx.logger.info(`[DecisionTwin] Triggering orchestrator for ${input.machine_id}`, input);

    const resultState = DecisionTwinOrchestrator.run({
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
      consulted_agents: decision?.agents_consulted,
      vetoes: decision?.vetoes,
      challenges: decision?.challenges_addressed,
      work_orders: resultState.work_orders,
      notifications: resultState.notifications,
      trace: resultState.trace,
    };
  }

  @Tool({
    name: 'get_sensor_data',
    description: 'Fetch live sensor data streams for a specific machine',
    inputSchema: z.object({
      machine_id: z.string().describe('Machine ID to query'),
    })
  })
  async getSensorData(input: { machine_id: string }, ctx: ExecutionContext) {
    ctx.logger.info(`Fetching sensor data for ${input.machine_id}`);
    return {
      machine_id: input.machine_id,
      timestamp: new Date().toISOString(),
      vibration_level: 8.2,
      temperature: 92,
      pressure: 145,
      status: 'CRITICAL_ANOMALY',
    };
  }

  @Tool({
    name: 'check_machine_health',
    description: 'Evaluate machine health score and maintenance history',
    inputSchema: z.object({
      machine_id: z.string().describe('Machine ID to check'),
    })
  })
  async checkMachineHealth(input: { machine_id: string }, ctx: ExecutionContext) {
    ctx.logger.info(`Checking machine health for ${input.machine_id}`);
    return {
      machine_id: input.machine_id,
      health_score: 0.20,
      failure_probability: 0.80,
      last_maintenance: '14 days ago',
      recommendation: 'immediate_repair',
    };
  }

  @Tool({
    name: 'search_incident_history',
    description: 'RAG retrieval search over historical manufacturing incident reports',
    inputSchema: z.object({
      query: z.string().describe('Search query string (e.g. vibration bearing wear)'),
      machine_id: z.string().optional(),
    })
  })
  async searchIncidentHistory(input: { query: string; machine_id?: string }, ctx: ExecutionContext) {
    ctx.logger.info(`Searching incident history for query "${input.query}"`);
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
