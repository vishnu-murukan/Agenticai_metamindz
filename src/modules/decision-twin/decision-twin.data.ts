/**
 * Shared manufacturing plant data + lookup logic.
 *
 * Extracted from decision-twin.tools.ts so both the MCP-facing DecisionTwinTools
 * class and the internal orchestrator sub-agents (decision-twin.sub-agents.ts) can
 * call the exact same logic without a circular import between tools <-> sub-agents
 * (both used to route through decision-twin.orchestrator.ts, which imports sub-agents).
 */

export const MACHINE_DATABASE: Record<string, {
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

export const INVENTORY_DATABASE: Record<string, {
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

export function lookupSensorData(machineId: string) {
  const id = machineId.toUpperCase();
  const data = MACHINE_DATABASE[id] || {
    name: `Machine ${id}`,
    type: 'Standard Production Equipment',
    location: 'Main Plant Floor',
    status: 'normal' as const,
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

export function lookupMachineHealth(machineId: string) {
  const id = machineId.toUpperCase();
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

export function lookupInventory(partId: string) {
  const id = partId.toUpperCase();
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

export function calculateDowntimeCost(machineId: string, hours: number) {
  const hourlyCost = 12500;
  const totalCost = hourlyCost * hours;
  return {
    machineId,
    downtimeHours: hours,
    totalEstimatedCostUSD: totalCost,
    summary: `Estimated ${hours}h downtime for ${machineId} results in a $${totalCost.toLocaleString()} financial impact.`
  };
}
