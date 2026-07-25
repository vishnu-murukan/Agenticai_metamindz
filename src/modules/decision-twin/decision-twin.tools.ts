import { ToolDecorator as Tool, ExecutionContext, z } from '@nitrostack/core';

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
  /**
   * Tool 1: get_sensor_data
   * Fetches real-time sensor telemetry and flags anomalies against baseline thresholds.
   */
  @Tool({
    name: 'get_sensor_data',
    description: 'Fetch real-time sensor stream data for a specified machine ID, including temperature, vibration, hydraulic pressure, and anomaly flags.',
    inputSchema: z.object({
      machineId: z.string().describe('Unique machine identifier (e.g. M-004, M-001, M-002, M-003)')
    }),
    examples: {
      request: { machineId: 'M-004' },
      response: {
        machineId: 'M-004',
        name: 'CNC Milling Center #4',
        status: 'alarm',
        telemetry: {
          temperature_celsius: 88.5,
          vibration_mm_s: 8.4,
          bearing_temp_celsius: 94.2,
          hydraulic_pressure_bar: 1.8,
          rotation_speed_rpm: 11500
        }
      }
    }
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
      temperatureCelsius: 58.0,
      vibrationMmS: 2.1,
      bearingTempCelsius: 60.5,
      hydraulicPressureBar: 3.8,
      rotationSpeedRpm: 5000,
      operatingHours: 2400,
      lastMaintenanceDate: '2026-06-01',
      componentWear: { bearings: 20, motor: 15 },
      recentIncidents: [],
      hourlyProductionValueUSD: 3000
    };

    const anomalies: string[] = [];
    if (data.vibrationMmS > 7.0) {
      anomalies.push(`CRITICAL: Vibration level ${data.vibrationMmS} mm/s exceeds safety baseline (max 3.5 mm/s)`);
    } else if (data.vibrationMmS > 3.5) {
      anomalies.push(`WARNING: Elevated vibration detected (${data.vibrationMmS} mm/s)`);
    }

    if (data.bearingTempCelsius > 85.0) {
      anomalies.push(`CRITICAL: Bearing temperature ${data.bearingTempCelsius}°C exceeds thermal limit (max 80.0°C)`);
    }

    if (data.hydraulicPressureBar < 2.5) {
      anomalies.push(`WARNING: Hydraulic pressure low at ${data.hydraulicPressureBar} bar (nominal 4.0 bar)`);
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
      baselines: {
        max_normal_vibration_mm_s: 3.5,
        max_normal_temp_celsius: 70.0,
        max_normal_bearing_temp_celsius: 80.0,
        nominal_hydraulic_pressure_bar: 4.0
      },
      anomalies,
      hasActiveAnomalies: anomalies.length > 0
    };
  }

  /**
   * Tool 2: check_machine_health
   * Analyzes maintenance history, component wear, and generates health score assessment.
   */
  @Tool({
    name: 'check_machine_health',
    description: 'Retrieve maintenance history, component wear breakdown, and maintenance-derived health score for a machine.',
    inputSchema: z.object({
      machineId: z.string().describe('Target machine identifier (e.g. M-004)')
    })
  })
  async checkMachineHealth(input: { machineId: string }, ctx: ExecutionContext) {
    ctx.logger.info('Evaluating machine health', { machineId: input.machineId });
    const id = input.machineId.toUpperCase();
    const data = MACHINE_DATABASE[id] || {
      name: `Machine ${id}`,
      type: 'Production Equipment',
      location: 'Main Plant',
      status: 'normal',
      healthScore: 85,
      operatingHours: 2000,
      lastMaintenanceDate: '2026-06-01',
      componentWear: { spindleBearing: 25, motorAlignment: 15 },
      recentIncidents: [],
      hourlyProductionValueUSD: 3000
    };

    let statusLevel: 'Good' | 'Fair' | 'Degraded' | 'Critical';
    if (data.healthScore >= 80) statusLevel = 'Good';
    else if (data.healthScore >= 60) statusLevel = 'Fair';
    else if (data.healthScore >= 40) statusLevel = 'Degraded';
    else statusLevel = 'Critical';

    let recommendedAction = 'Routine inspection at next scheduled maintenance cycle.';
    if (data.healthScore < 40) {
      recommendedAction = 'IMMEDIATE REPAIR: Replace worn spindle bearings and re-align motor drive before continuing operation.';
    } else if (data.healthScore < 65) {
      recommendedAction = 'SCHEDULED REPAIR: Schedule bearing replacement within 48 operating hours.';
    }

    return {
      machineId: id,
      name: data.name,
      healthScore: data.healthScore,
      statusLevel,
      operatingHours: data.operatingHours,
      lastMaintenanceDate: data.lastMaintenanceDate,
      daysSinceLastMaintenance: Math.floor((Date.now() - new Date(data.lastMaintenanceDate).getTime()) / (1000 * 60 * 60 * 24)),
      componentWearPercent: data.componentWear,
      recentIncidents: data.recentIncidents,
      recommendedAction,
      requiresParts: data.healthScore < 65
    };
  }

  /**
   * Tool 3: check_inventory
   * Checks spare parts availability, warehouse locations, and reorder status.
   */
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
      partName: `Spare Part ${id}`,
      category: 'General Spares',
      inStock: 2,
      reservedCount: 0,
      reorderThreshold: 1,
      leadTimeDays: 3,
      storageLocation: 'Warehouse A - Bin 05-B',
      unitCostUSD: 450,
      compatibleMachines: ['M-004', 'M-001', 'M-002']
    };

    const availableCount = item.inStock - item.reservedCount;
    const isAvailable = availableCount > 0;

    return {
      partId: id,
      partName: item.partName,
      category: item.category,
      inStock: item.inStock,
      reservedCount: item.reservedCount,
      availableCount,
      isAvailable,
      reorderThreshold: item.reorderThreshold,
      needsReorder: item.inStock <= item.reorderThreshold,
      leadTimeDays: item.leadTimeDays,
      storageLocation: item.storageLocation,
      unitCostUSD: item.unitCostUSD,
      compatibleMachines: item.compatibleMachines,
      statusMessage: isAvailable 
        ? `Part ${id} (${item.partName}) is IN STOCK. ${availableCount} unit(s) ready for immediate deployment.`
        : `Part ${id} is OUT OF STOCK or fully reserved. Expedited reorder lead time: ${item.leadTimeDays} days.`
    };
  }

  /**
   * Tool 4: estimate_downtime_cost
   * Computes financial projection for unplanned machine downtime.
   */
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
    const id = input.machineId.toUpperCase();
    const data = MACHINE_DATABASE[id] || {
      name: `Machine ${id}`,
      hourlyProductionValueUSD: 3500
    };

    const lostRevenue = Math.round(data.hourlyProductionValueUSD * input.hours);
    const idleLaborCost = Math.round(180 * input.hours); // $180/hr operator team cost
    const expeditedRepairCost = input.hours > 4 ? 2500 : 1200; // flat technician callout
    const penaltyCost = input.hours > 6 ? Math.round((input.hours - 6) * 1500) : 0; // SLA delivery penalties

    const totalCost = lostRevenue + idleLaborCost + expeditedRepairCost + penaltyCost;

    let impactSeverity: 'Low' | 'Medium' | 'High' | 'Severe';
    if (totalCost > 30000) impactSeverity = 'Severe';
    else if (totalCost > 15000) impactSeverity = 'High';
    else if (totalCost > 5000) impactSeverity = 'Medium';
    else impactSeverity = 'Low';

    return {
      machineId: id,
      machineName: data.name,
      downtimeHours: input.hours,
      financialBreakdownUSD: {
        lostProductionRevenue: lostRevenue,
        idleLaborCost,
        expeditedRepairCost,
        lateDeliveryPenalty: penaltyCost,
        totalEstimatedCost: totalCost
      },
      impactSeverity,
      costPerAdditionalHourUSD: data.hourlyProductionValueUSD + 180,
      summary: `Estimated ${input.hours}h downtime for ${data.name} results in a $${totalCost.toLocaleString()} financial impact (${impactSeverity} severity).`
    };
  }

  /**
   * Tool 5: calculate_risk
   * Computes a composite operational risk score combining safety, financial, and schedule inputs.
   */
  @Tool({
    name: 'calculate_risk',
    description: 'Calculate composite operational risk score combining safety SOP compliance, financial risk, and schedule delay risk.',
    inputSchema: z.object({
      machineId: z.string().describe('Target machine ID for risk calculation')
    })
  })
  async calculateRisk(input: { machineId: string }, ctx: ExecutionContext) {
    ctx.logger.info('Calculating composite operational risk', { machineId: input.machineId });
    const id = input.machineId.toUpperCase();
    const data = MACHINE_DATABASE[id] || {
      name: `Machine ${id}`,
      vibrationMmS: 2.1,
      bearingTempCelsius: 60,
      healthScore: 85,
      hourlyProductionValueUSD: 3000
    };

    // Calculate sub-scores out of 10
    const safetyRisk = Math.min(10.0, Math.round(((data.vibrationMmS / 8.0) * 6.0 + (data.bearingTempCelsius / 95.0) * 4.0) * 10) / 10);
    const financialRisk = Math.min(10.0, Math.round(((data.hourlyProductionValueUSD / 6000.0) * 5.0 + ((100 - data.healthScore) / 100.0) * 5.0) * 10) / 10);
    const scheduleRisk = Math.min(10.0, Math.round((1.0 - (data.healthScore / 100.0)) * 9.5 * 10) / 10);

    const compositeScore = Math.min(10.0, Math.round((safetyRisk * 0.45 + financialRisk * 0.30 + scheduleRisk * 0.25) * 10) / 10);

    let riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    if (compositeScore >= 8.0) riskLevel = 'CRITICAL';
    else if (compositeScore >= 6.0) riskLevel = 'HIGH';
    else if (compositeScore >= 3.5) riskLevel = 'MEDIUM';
    else riskLevel = 'LOW';

    const riskFactors: string[] = [];
    let sopVetoStatus = false;

    if (data.vibrationMmS > 7.5) {
      riskFactors.push('SOP Safety Rule #14: Vibration exceeds 7.5 mm/s limit. Mandatory immediate shutdown or repair.');
      sopVetoStatus = true;
    }
    if (data.bearingTempCelsius > 90.0) {
      riskFactors.push('SOP Safety Rule #22: Thermal runaway hazard on spindle bearing (>90.0°C). Risk of catastrophic failure.');
      sopVetoStatus = true;
    }
    if (data.healthScore < 40) {
      riskFactors.push('Maintenance Assessment: Mechanical integrity compromised (Health Score < 40%).');
    }

    return {
      machineId: id,
      machineName: data.name,
      compositeRiskScore: compositeScore,
      riskLevel,
      subScores: {
        safetyRisk,
        financialRisk,
        scheduleRisk
      },
      sopVetoStatus,
      riskFactors,
      recommendation: sopVetoStatus
        ? 'SAFETY VETO: Continuous operation VETOED by Safety SOP. Immediate repair required.'
        : `Operating under ${riskLevel} risk level. Monitor telemetry closely.`
    };
  }

  /**
   * Tool 6: generate_work_order
   * Creates an executable maintenance work order, assigns technicians, and reserves parts.
   */
  @Tool({
    name: 'generate_work_order',
    description: 'Generate an executable work order for machine maintenance, assigning a qualified technician, reserving spare parts, and documenting safety protocols.',
    inputSchema: z.object({
      machineId: z.string().describe('Target machine ID (e.g. M-004)'),
      action: z.string().describe('Maintenance action to execute (e.g. "replace_bearing", "inspect_spindle", "realign_motor", "flush_coolant")')
    })
  })
  async generateWorkOrder(input: { machineId: string; action: string }, ctx: ExecutionContext) {
    ctx.logger.info('Generating executable work order', { machineId: input.machineId, action: input.action });
    const id = input.machineId.toUpperCase();
    const data = MACHINE_DATABASE[id] || { name: `Machine ${id}` };

    const timestamp = new Date().toISOString();
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const workOrderId = `WO-${new Date().getFullYear()}${(new Date().getMonth()+1).toString().padStart(2,'0')}${new Date().getDate().toString().padStart(2,'0')}-${id}-${randomSuffix}`;

    let priority: 'EMERGENCY' | 'HIGH' | 'MEDIUM' | 'ROUTINE' = 'HIGH';
    let assignedTechnician = 'Tech #14 - Senior Mechanical Specialist (Marcus Vance)';
    let reservedParts = ['PART-BRG-409 (Spindle Bearing Set)'];
    let estimatedDurationHours = 3.5;

    if (input.action.includes('bearing') || input.action.includes('repair') || id === 'M-004') {
      priority = 'EMERGENCY';
      assignedTechnician = 'Tech #14 - Senior Mechanical Specialist (Marcus Vance)';
      reservedParts = ['PART-BRG-409 (Spindle Bearing Set - Reserved Warehouse B Bin 14-C)'];
      estimatedDurationHours = 4.0;
    } else if (input.action.includes('motor')) {
      priority = 'HIGH';
      assignedTechnician = 'Tech #08 - Electrical & Servo Drive Lead (Elena Rostova)';
      reservedParts = ['PART-MTR-102 (30kW Servo Motor)'];
      estimatedDurationHours = 2.5;
    }

    return {
      workOrderId,
      machineId: id,
      machineName: data.name,
      action: input.action,
      createdAt: timestamp,
      priority,
      status: 'CREATED_AND_SCHEDULED',
      assignedTechnician,
      reservedParts,
      estimatedDurationHours,
      safetyProtocol: [
        'LOTO (Lockout / Tagout) Procedure #LOTO-M004 mandatory before cell entry',
        'Thermal PPE required due to elevated spindle bearing temperature',
        'Verify zero hydraulic pressure state before disconnecting line'
      ],
      nextSteps: [
        `Technician ${assignedTechnician} notified via dispatch stream`,
        `Parts reserved in inventory system (${reservedParts.join(', ')})`,
        `Production scheduler alerted to reroute active queue from ${id}`
      ]
    };
  }
}
