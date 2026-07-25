import { DecisionTwinState, Proposal, Veto, Challenge } from './decision-twin.state.js';

// Helper to merge blackboard findings
function mergeBB(state: DecisionTwinState, key: string, val: any): Record<string, any> {
  return { ...(state.blackboard || {}), [key]: val };
}

// ─────────────────────────────────────────────────────────────────
// EVIDENCE LAYER
// ─────────────────────────────────────────────────────────────────

export function sensorAgent(state: DecisionTwinState): Partial<DecisionTwinState> {
  const event = state.event || {};
  const vibration = Number(event.vibration_level || 0);
  const temperature = Number(event.temperature || 0);
  const pressure = Number(event.pressure || 0);

  const anomalies: string[] = [];
  if (vibration > 5) anomalies.push(`Vibration ${vibration}/10 exceeds threshold (5)`);
  if (temperature > 80) anomalies.push(`Temperature ${temperature} C exceeds threshold (80 C)`);
  if (pressure > 150) anomalies.push(`Pressure ${pressure} PSI exceeds threshold (150)`);

  const severity = (vibration > 8 || temperature > 95) ? 'critical' :
                   (vibration > 6 || temperature > 85) ? 'high' :
                   anomalies.length > 0 ? 'moderate' : 'normal';

  const findings = {
    anomalies,
    severity,
    readings: { vibration, temperature, pressure },
    summary: `${anomalies.length} anomalies detected, severity: ${severity}`,
  };

  return {
    blackboard: mergeBB(state, 'sensor_agent', findings),
    agents_completed: [...(state.agents_completed || []), 'sensor_agent'],
    trace: [
      ...(state.trace || []),
      `     [SensorAgent] ${anomalies.length} anomalies | Severity: ${severity.toUpperCase()}`,
      ...anomalies.map(a => `       - ${a}`),
    ],
  };
}

export function maintenanceAgent(state: DecisionTwinState): Partial<DecisionTwinState> {
  const event = state.event || {};
  const sensorData = (state.blackboard || {}).sensor_agent || {};
  const severity = sensorData.severity || 'moderate';
  const machineId = event.machine_id || 'unknown';

  const healthScoreMap: Record<string, number> = { critical: 0.2, high: 0.4, moderate: 0.6, normal: 0.85 };
  const healthScore = healthScoreMap[severity] ?? 0.5;
  const failureProbability = Number((1 - healthScore).toFixed(2));
  const needsImmediate = healthScore < 0.4;

  const findings = {
    machine_id: machineId,
    health_score: healthScore,
    failure_probability: failureProbability,
    last_maintenance: '14 days ago',
    recommendation: needsImmediate ? 'immediate_repair' : 'schedule_maintenance',
    summary: `Health=${(healthScore * 100).toFixed(0)}%, P(failure)=${(failureProbability * 100).toFixed(0)}%, Rec: ${needsImmediate ? 'IMMEDIATE REPAIR' : 'scheduled maintenance'}`,
  };

  const proposals: Proposal[] = needsImmediate ? [{
    source: 'maintenance_agent',
    action: 'immediate_repair',
    reason: `Health score ${(healthScore * 100).toFixed(0)}% below critical threshold. Failure probability ${(failureProbability * 100).toFixed(0)}%.`,
    confidence: 0.75,
  }] : [];

  return {
    blackboard: mergeBB(state, 'maintenance_agent', findings),
    agents_completed: [...(state.agents_completed || []), 'maintenance_agent'],
    proposals: [...(state.proposals || []), ...proposals],
    trace: [
      ...(state.trace || []),
      `     [MaintenanceAgent] ${machineId}: Health=${(healthScore * 100).toFixed(0)}%, P(fail)=${(failureProbability * 100).toFixed(0)}%`,
      `       Recommendation: ${findings.recommendation}`,
    ],
  };
}

export function memoryAgent(state: DecisionTwinState): Partial<DecisionTwinState> {
  const event = state.event || {};
  const machineId = event.machine_id || 'unknown';

  const similarIncidents = [
    {
      incident_id: 'INC-2024-0847',
      date: '2024-11-15',
      machine: machineId,
      symptoms: 'High vibration + elevated temperature',
      root_cause: 'Bearing wear in spindle assembly',
      action_taken: 'Immediate bearing replacement',
      outcome: 'Resolved in 4 hours. Delayed repair in similar INC-2024-0623 led to spindle failure (48 hr downtime).',
      similarity_score: 0.91,
    },
  ];

  const findings = {
    similar_incidents: similarIncidents,
    precedent_supports: 'immediate_repair',
    summary: `Found ${similarIncidents.length} similar incident(s). Closest match (91% similar): bearing wear; delayed repair caused 48 hr downtime.`,
  };

  return {
    blackboard: mergeBB(state, 'memory_agent', findings),
    agents_completed: [...(state.agents_completed || []), 'memory_agent'],
    trace: [
      ...(state.trace || []),
      `     [MemoryAgent] Found ${similarIncidents.length} precedent(s)`,
      `       Best match: INC-2024-0847 (91% similar) -> bearing wear`,
      `       Precedent supports: immediate_repair`,
    ],
  };
}

export function productionAgent(state: DecisionTwinState): Partial<DecisionTwinState> {
  const event = state.event || {};
  const machineId = event.machine_id || 'unknown';

  const findings = {
    machine_id: machineId,
    current_utilization: 0.87,
    active_orders: 3,
    next_deadline: '2 days',
    can_reroute: true,
    reroute_capacity: 0.70,
    impact_if_stopped_4h: 'Low — reroute absorbs 4 hr gap, no delivery slip',
    impact_if_stopped_48h: 'High — 2 of 3 orders delayed',
    summary: 'Machine at 87% utilisation, 3 active orders. 4 hr stop manageable via reroute; 48 hr stop causes delivery delays.',
  };

  return {
    blackboard: mergeBB(state, 'production_agent', findings),
    agents_completed: [...(state.agents_completed || []), 'production_agent'],
    trace: [
      ...(state.trace || []),
      `     [ProductionAgent] ${machineId}: 87% util, 3 orders`,
      `       4 hr stop : ${findings.impact_if_stopped_4h}`,
      `       48 hr stop: ${findings.impact_if_stopped_48h}`,
    ],
  };
}

export function inventoryAgent(state: DecisionTwinState): Partial<DecisionTwinState> {
  const findings = {
    required_part: 'Spindle Bearing Assembly (SKU: SBA-4420)',
    in_stock: true,
    quantity_available: 2,
    location: 'Warehouse B, Rack 14',
    lead_time_if_ordered: '3-5 business days',
    summary: 'Required part in stock (2 units). Immediate availability from Warehouse B.',
  };

  return {
    blackboard: mergeBB(state, 'inventory_agent', findings),
    agents_completed: [...(state.agents_completed || []), 'inventory_agent'],
    trace: [
      ...(state.trace || []),
      `     [InventoryAgent] Part: ${findings.required_part}`,
      `       In stock: ${findings.quantity_available} units at ${findings.location}`,
    ],
  };
}

export function financeAgent(state: DecisionTwinState): Partial<DecisionTwinState> {
  const hourlyCost = 12500;
  const repairNowCost = hourlyCost * 4;
  const expectedDelayCost = Math.round(hourlyCost * 48 * 0.65);

  const findings = {
    hourly_downtime_cost: hourlyCost,
    repair_now_cost: repairNowCost,
    repair_now_duration: '4 hours',
    delay_repair_risk_cost: hourlyCost * 48,
    delay_repair_probability: 0.65,
    expected_delay_cost: expectedDelayCost,
    summary: `Repair now: $${repairNowCost.toLocaleString()} (4 hr). Delay risk: $${expectedDelayCost.toLocaleString()} expected (65% chance of 48 hr failure).`,
  };

  const proposals: Proposal[] = [{
    source: 'finance_agent',
    action: 'immediate_repair',
    reason: `Expected delay cost ($${expectedDelayCost.toLocaleString()}) is ${(expectedDelayCost / repairNowCost).toFixed(1)}x repair-now cost ($${repairNowCost.toLocaleString()})`,
    confidence: 0.80,
  }];

  return {
    blackboard: mergeBB(state, 'finance_agent', findings),
    agents_completed: [...(state.agents_completed || []), 'finance_agent'],
    proposals: [...(state.proposals || []), ...proposals],
    trace: [
      ...(state.trace || []),
      `     [FinanceAgent] Repair now: $${repairNowCost.toLocaleString()} | Delay risk: $${expectedDelayCost.toLocaleString()}`,
      `       Recommendation: immediate_repair (cost ratio ${(expectedDelayCost / repairNowCost).toFixed(1)}x)`,
    ],
  };
}

// ─────────────────────────────────────────────────────────────────
// REFLECTION & SAFETY LAYER
// ─────────────────────────────────────────────────────────────────

export function devilsAdvocateAgent(state: DecisionTwinState): Partial<DecisionTwinState> {
  const proposals = state.proposals || [];
  const bb = state.blackboard || {};

  if (proposals.length === 0) {
    return {
      agents_completed: [...(state.agents_completed || []), 'devils_advocate_agent'],
      trace: [...(state.trace || []), '     [DevilsAdvocate] No proposals to challenge.'],
    };
  }

  const leading = [...proposals].sort((a, b) => b.confidence - a.confidence)[0];
  const utilization = bb.production_agent?.current_utilization ?? 'unknown';

  const challenge: Challenge = {
    challenged_proposal: leading.action,
    challenge: `The historical precedent (INC-2024-0847) involved a different production load. Current utilisation is ${utilization}. Are we sure the failure timeline matches?`,
    requested_evidence: 'Verify current load matches historical-case conditions',
    severity: 'moderate',
  };

  return {
    challenges: [...(state.challenges || []), challenge],
    agents_completed: [...(state.agents_completed || []), 'devils_advocate_agent'],
    trace: [
      ...(state.trace || []),
      `     [DevilsAdvocate] Challenging: '${leading.action}'`,
      `       "${challenge.challenge.slice(0, 80)}..."`,
      `       Requested: ${challenge.requested_evidence}`,
    ],
  };
}

export function safetyAgent(state: DecisionTwinState): Partial<DecisionTwinState> {
  const bb = state.blackboard || {};
  const sensor = bb.sensor_agent || {};
  const severity = sensor.severity || 'moderate';
  const vibration = sensor.readings?.vibration || 0;

  const sopViolations: string[] = [];
  const vetoesOut: Veto[] = [];

  if ((severity === 'critical' || severity === 'high') && vibration > 7) {
    sopViolations.push('SOP-MFG-042: Equipment with vibration >7 must not operate without inspection');
    vetoesOut.push({
      source: 'safety_agent',
      vetoed_action: 'delay_repair',
      reason: `SOP-MFG-042 violation: vibration level ${vibration}/10 exceeds safety limit for continued operation`,
      sop_reference: 'SOP-MFG-042',
    });
  }

  const findings = {
    sop_violations: sopViolations,
    vetoes_issued: vetoesOut.length,
    approved_actions: vetoesOut.length > 0 ? ['immediate_repair', 'reduced_capacity'] : ['immediate_repair', 'delay_repair', 'reduced_capacity'],
    summary: `${sopViolations.length} SOP violation(s), ${vetoesOut.length} veto(es) issued.`,
  };

  return {
    blackboard: mergeBB(state, 'safety_agent', findings),
    vetoes: [...(state.vetoes || []), ...vetoesOut],
    agents_completed: [...(state.agents_completed || []), 'safety_agent'],
    trace: [
      ...(state.trace || []),
      `     [SafetyAgent] SOP violations: ${sopViolations.length} | Vetoes: ${vetoesOut.length}`,
      ...vetoesOut.map(v => `       VETO: ${v.reason.slice(0, 70)}...`),
    ],
  };
}

export function riskAgent(state: DecisionTwinState): Partial<DecisionTwinState> {
  const bb = state.blackboard || {};
  const sensor = bb.sensor_agent || {};
  const maintenance = bb.maintenance_agent || {};
  const finance = bb.finance_agent || {};

  const safetyRiskMap: Record<string, number> = { critical: 0.95, high: 0.75, moderate: 0.4, normal: 0.1 };
  const safetyRisk = safetyRiskMap[sensor.severity || 'moderate'] ?? 0.5;
  const financialRisk = finance.expected_delay_cost ? Math.min(1.0, finance.expected_delay_cost / 500000) : 0.3;
  const mechanicalRisk = maintenance.health_score !== undefined ? (1 - maintenance.health_score) : 0.5;

  const composite = Number((safetyRisk * 0.4 + financialRisk * 0.3 + mechanicalRisk * 0.3).toFixed(3));
  const level = composite > 0.7 ? 'CRITICAL' : composite > 0.5 ? 'HIGH' : composite > 0.3 ? 'MODERATE' : 'LOW';

  const findings = {
    safety_risk: safetyRisk,
    financial_risk: Number(financialRisk.toFixed(3)),
    mechanical_risk: Number(mechanicalRisk.toFixed(3)),
    composite_score: composite,
    risk_level: level,
    summary: `Composite risk: ${(composite * 100).toFixed(1)}% (${level}). Safety=${(safetyRisk * 100).toFixed(0)}%, Financial=${(financialRisk * 100).toFixed(0)}%, Mechanical=${(mechanicalRisk * 100).toFixed(0)}%`,
  };

  return {
    blackboard: mergeBB(state, 'risk_agent', findings),
    agents_completed: [...(state.agents_completed || []), 'risk_agent'],
    trace: [
      ...(state.trace || []),
      `     [RiskAgent] Composite: ${(composite * 100).toFixed(1)}% (${level})`,
      `       Safety=${(safetyRisk * 100).toFixed(0)}% | Financial=${(financialRisk * 100).toFixed(0)}% | Mechanical=${(mechanicalRisk * 100).toFixed(0)}%`,
    ],
  };
}

// ─────────────────────────────────────────────────────────────────
// SIMULATION LAYER
// ─────────────────────────────────────────────────────────────────

export function scenarioSimulationAgent(state: DecisionTwinState): Partial<DecisionTwinState> {
  const vetoes = state.vetoes || [];
  const vetoedActions = new Set(vetoes.map(v => v.vetoed_action));

  const scenarios: Record<string, { downtime: string; cost: string; risk_reduction: string; schedule_impact: string; score: number }> = {
    immediate_repair: { downtime: '4 hours', cost: '$50,000', risk_reduction: '95%', schedule_impact: 'Minimal — reroute absorbs gap', score: 0.85 },
    delay_repair: { downtime: '0 now / 48 hr if failure', cost: '$0 now / $600,000 if failure', risk_reduction: '0%', schedule_impact: 'None now / severe if failure', score: 0.25 },
    reduced_capacity: { downtime: '0 hours', cost: '$18,000/day revenue reduction', risk_reduction: '60%', schedule_impact: 'Moderate — slower throughput', score: 0.55 },
  };

  const viable = Object.entries(scenarios).filter(([k]) => !vetoedActions.has(k));
  viable.sort((a, b) => b[1].score - a[1].score);
  const best = viable[0];

  const findings = {
    scenarios_evaluated: scenarios,
    vetoed_scenarios: Array.from(vetoedActions),
    recommended: best[0],
    summary: `Evaluated 3 scenarios, ${vetoedActions.size} vetoed. Best viable: ${best[0]} (score: ${best[1].score})`,
  };

  const proposals: Proposal[] = [{
    source: 'scenario_simulation_agent',
    action: best[0],
    reason: `Best scenario after simulation: ${best[0]} (score=${best[1].score}, downtime=${best[1].downtime})`,
    confidence: best[1].score,
  }];

  return {
    blackboard: mergeBB(state, 'scenario_simulation_agent', findings),
    agents_completed: [...(state.agents_completed || []), 'scenario_simulation_agent'],
    proposals: [...(state.proposals || []), ...proposals],
    trace: [
      ...(state.trace || []),
      `     [ScenarioSim] Evaluated ${Object.keys(scenarios).length} scenarios, ${vetoedActions.size} vetoed`,
      ...Object.entries(scenarios).map(([k, v]) => `       ${k === best[0] ? '>>>' : vetoedActions.has(k) ? 'XXX' : '   '} ${k}: score=${v.score}`),
      `       Recommended: ${best[0]}`,
    ],
  };
}

export function qualityAgent(state: DecisionTwinState): Partial<DecisionTwinState> {
  const bb = state.blackboard || {};
  const sensor = bb.sensor_agent || {};
  const severity = sensor.severity || 'moderate';

  const qualityRiskMap: Record<string, { defect_rate_increase: string; batch_at_risk: boolean; quarantine_recommended: boolean }> = {
    critical: { defect_rate_increase: '15-25%', batch_at_risk: true, quarantine_recommended: true },
    high: { defect_rate_increase: '5-15%', batch_at_risk: true, quarantine_recommended: false },
    moderate: { defect_rate_increase: '1-5%', batch_at_risk: false, quarantine_recommended: false },
    normal: { defect_rate_increase: '<1%', batch_at_risk: false, quarantine_recommended: false },
  };

  const qualityRisk = qualityRiskMap[severity] || qualityRiskMap.moderate;

  const findings = {
    ...qualityRisk,
    severity,
    summary: `Defect rate increase: ${qualityRisk.defect_rate_increase}. Batch at risk: ${qualityRisk.batch_at_risk}.`,
  };

  return {
    blackboard: mergeBB(state, 'quality_agent', findings),
    agents_completed: [...(state.agents_completed || []), 'quality_agent'],
    trace: [
      ...(state.trace || []),
      `     [QualityAgent] Defect risk: ${qualityRisk.defect_rate_increase} increase`,
      `       Batch at risk: ${qualityRisk.batch_at_risk} | Quarantine: ${qualityRisk.quarantine_recommended}`,
    ],
  };
}

// Sub-agent registry map
export const AGENT_REGISTRY: Record<string, (state: DecisionTwinState) => Partial<DecisionTwinState>> = {
  sensor_agent: sensorAgent,
  maintenance_agent: maintenanceAgent,
  memory_agent: memoryAgent,
  production_agent: productionAgent,
  inventory_agent: inventoryAgent,
  finance_agent: financeAgent,
  devils_advocate_agent: devilsAdvocateAgent,
  safety_agent: safetyAgent,
  risk_agent: riskAgent,
  scenario_simulation_agent: scenarioSimulationAgent,
  quality_agent: qualityAgent,
};
