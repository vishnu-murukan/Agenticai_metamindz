import { ToolDecorator as Tool, ExecutionContext, z } from '@nitrostack/core';
import { DecisionTwinOrchestrator } from './decision-twin.orchestrator.js';

/**
 * Mock database for Decision Twin manufacturing plant
 */
const MACHINE_DATABASE: Record<string, {
  name: string;
  type: string;
  location: string;
  status: 'normal' | 'warning' | 'critical' | 'alarm';
  healthScore: number;
  temperatureCelsius: number;
  vibrationMmS: number;
  bearingTempCelsius: number;
  hydraulicPressureBar: number;
  rotationSpeedRpm: number;
  operatingHours: number;
  lastMaintenanceDate: string;
  componentWear: Record<string, number>;
  recentIncidents: Array<{ id: string; date: string; summary: string }>;
  hourlyProductionValueUSD: number;
}> = {
  'M-004': {
    name: 'CNC Milling Center #4',
    type: '5-Axis CNC Mill',
    location: 'Bay B - Line 2',
    status: 'alarm',
    healthScore: 38,
    temperatureCelsius: 88.5,
    vibrationMmS: 8.4,
    bearingTempCelsius: 94.2,
    hydraulicPressureBar: 1.8,
    rotationSpeedRpm: 11500,
    operatingHours: 4250,
    lastMaintenanceDate: '2026-05-12',
    componentWear: {
      spindleBearing: 87,
      motorAlignment: 64,
      hydraulicSeals: 42,
      coolantPump: 25
    },
    recentIncidents: [
      { id: 'INC-2026-089', date: '2026-06-14', summary: 'Minor vibration warning during high-feed milling' },
      { id: 'INC-2026-042', date: '2026-04-02', summary: 'Spindle coolant temperature spike' }
    ],
    hourlyProductionValueUSD: 4500
  },
  'M-001': {
    name: 'Stamping Press #1',
    type: 'Heavy Hydraulic Press',
    location: 'Bay A - Line 1',
    status: 'normal',
    healthScore: 94,
    temperatureCelsius: 48.2,
    vibrationMmS: 1.2,
    bearingTempCelsius: 52.0,
    hydraulicPressureBar: 4.2,
    rotationSpeedRpm: 850,
    operatingHours: 1200,
    lastMaintenanceDate: '2026-07-01',
    componentWear: {
      hydraulicSeals: 12,
      mainDieAlignment: 8,
      pumpMotor: 15
    },
    recentIncidents: [],
    hourlyProductionValueUSD: 6200
  },
  'M-002': {
    name: 'Robotic Welder #2',
    type: '6-Axis Articulated Robot',
    location: 'Bay A - Line 2',
    status: 'warning',
    healthScore: 74,
    temperatureCelsius: 68.0,
    vibrationMmS: 4.1,
    bearingTempCelsius: 71.5,
    hydraulicPressureBar: 3.5,
    rotationSpeedRpm: 3200,
    operatingHours: 3100,
    lastMaintenanceDate: '2026-06-20',
    componentWear: {
      joint3Gearbox: 45,
      weldingTorchTip: 62,
      cableHarness: 30
    },
    recentIncidents: [
      { id: 'INC-2026-104', date: '2026-07-10', summary: 'Joint 3 positional jitter during arc cycle' }
    ],
    hourlyProductionValueUSD: 3800
  },
  'M-003': {
    name: 'Conveyor Transport #3',
    type: 'Automated Pallet Conveyor',
    location: 'Bay C - Logistics',
    status: 'critical',
    healthScore: 42,
    temperatureCelsius: 91.0,
    vibrationMmS: 9.2,
    bearingTempCelsius: 98.4,
    hydraulicPressureBar: 2.1,
    rotationSpeedRpm: 450,
    operatingHours: 5800,
    lastMaintenanceDate: '2026-03-15',
    componentWear: {
      driveMotor: 82,
      rollerBearings: 91,
      beltTensioner: 58
    },
    recentIncidents: [
      { id: 'INC-2026-112', date: '2026-07-18', summary: 'Drive motor overcurrent trip' }
    ],
    hourlyProductionValueUSD: 2900
  }
};

const INVENTORY_DATABASE: Record<string, {
  partName: string;
  category: string;
  inStock: number;
  reservedCount: number;
  reorderThreshold: number;
  leadTimeDays: number;
  storageLocation: string;
  unitCostUSD: number;
  compatibleMachines: string[];
}> = {
  'PART-BRG-409': {
    partName: 'Ultra-Precision Spindle Bearing Set (Class P4)',
    category: 'Bearings',
    inStock: 3,
    reservedCount: 1,
    reorderThreshold: 2,
    leadTimeDays: 5,
    storageLocation: 'Warehouse B - Bin 14-C',
    unitCostUSD: 1450,
    compatibleMachines: ['M-004', 'M-005']
  },
  'PART-MTR-102': {
    partName: '30kW Servo Drive Motor',
    category: 'Motors',
    inStock: 1,
    reservedCount: 0,
    reorderThreshold: 1,
    leadTimeDays: 12,
    storageLocation: 'Warehouse A - Rack 03-A',
    unitCostUSD: 4800,
    compatibleMachines: ['M-003', 'M-002']
  },
  'PART-SEAL-088': {
    partName: 'High-Pressure Hydraulic Seal Kit',
    category: 'Hydraulics',
    inStock: 12,
    reservedCount: 2,
    reorderThreshold: 5,
    leadTimeDays: 2,
    storageLocation: 'Warehouse B - Bin 08-F',
    unitCostUSD: 185,
    compatibleMachines: ['M-001', 'M-004']
  }
};

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
    description: 'Fetch real-time sensor stream data for a specified machine ID, including temperature, vibration, hydraulic pressure, and anomaly flags.',
    inputSchema: z.object({
      machineId: z.string().describe('Unique machine identifier (e.g. M-004, M-001, M-002, M-003, Machine-#4)')
    })
  })
  async getSensorData(input: { machineId: string }, ctx: ExecutionContext) {
    ctx.logger.info('Fetching sensor data', { machineId: input.machineId });
    const id = input.machineId.toUpperCase();
    const data = MACHINE_DATABASE[id] || {
      name: `Machine ${id}`,
      type: 'Standard Production Equipment',
      location: 'Main Plant Floor',
      status: 'normal',
      healthScore: 88,
      temperatureCelsius: 88.5,
      vibrationMmS: 8.2,
      bearingTempCelsius: 92.0,
      hydraulicPressureBar: 3.8,
      rotationSpeedRpm: 5000,
      operatingHours: 2400,
      lastMaintenanceDate: '2026-06-01',
      componentWear: { bearings: 80, motor: 15 },
      recentIncidents: [],
      hourlyProductionValueUSD: 3000
    };

    const anomalies: string[] = [];
    if (data.vibrationMmS > 3.5) {
      anomalies.push(`Vibration level ${data.vibrationMmS} mm/s exceeds safety baseline (max 3.5 mm/s)`);
    }
    if (data.bearingTempCelsius > 80.0) {
      anomalies.push(`Bearing temperature ${data.bearingTempCelsius}°C exceeds thermal limit (max 80.0°C)`);
    }

    return {
      machineId: id,
      name: data.name,
      type: data.type,
      location: data.location,
      timestamp: new Date().toISOString(),
      status: data.status,
      telemetry: {
        temperature_celsius: data.temperatureCelsius,
        vibration_mm_s: data.vibrationMmS,
        bearing_temp_celsius: data.bearingTempCelsius,
        hydraulic_pressure_bar: data.hydraulicPressureBar,
        rotation_speed_rpm: data.rotationSpeedRpm
      },
      anomalies,
      hasActiveAnomalies: anomalies.length > 0
    };
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
    const id = input.machineId.toUpperCase();
    const data = MACHINE_DATABASE[id] || {
      name: `Machine ${id}`,
      healthScore: 38,
      operatingHours: 4250,
      lastMaintenanceDate: '2026-05-12',
      componentWear: { spindleBearing: 87, motorAlignment: 64 },
      recentIncidents: []
    };

    return {
      machineId: id,
      name: data.name,
      healthScore: data.healthScore,
      operatingHours: data.operatingHours,
      lastMaintenanceDate: data.lastMaintenanceDate,
      componentWearPercent: data.componentWear,
      recommendedAction: data.healthScore < 40 ? 'IMMEDIATE REPAIR' : 'SCHEDULED MAINTENANCE'
    };
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
    const id = input.partId.toUpperCase();
    const item = INVENTORY_DATABASE[id] || {
      partName: 'Ultra-Precision Spindle Bearing Set',
      category: 'Bearings',
      inStock: 3,
      reservedCount: 1,
      reorderThreshold: 2,
      leadTimeDays: 5,
      storageLocation: 'Warehouse B - Bin 14-C',
      unitCostUSD: 1450,
      compatibleMachines: ['M-004', 'Machine-#4']
    };

    return {
      partId: id,
      partName: item.partName,
      inStock: item.inStock,
      availableCount: item.inStock - item.reservedCount,
      storageLocation: item.storageLocation,
      leadTimeDays: item.leadTimeDays
    };
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
    const hourlyCost = 12500;
    const totalCost = hourlyCost * input.hours;
    return {
      machineId: input.machineId,
      downtimeHours: input.hours,
      totalEstimatedCostUSD: totalCost,
      summary: `Estimated ${input.hours}h downtime for ${input.machineId} results in a $${totalCost.toLocaleString()} financial impact.`
    };
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
