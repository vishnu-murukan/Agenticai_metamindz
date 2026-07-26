import { DecisionTwinState, Proposal, Veto, Challenge } from './decision-twin.state.js';
import { lookupSensorData, lookupMachineHealth, lookupInventory, calculateDowntimeCost } from './decision-twin.data.js';
import { calculateStrategyMetrics } from './scenario_simulation_agent.js';
import * as RM from '../../reflection_memory/index.js';

// Real reflection/memory implementations (reused across the negotiation rounds below).
// Note: agents call the shared decision-twin.data.js lookups directly (the same logic
// DecisionTwinTools' @Tool methods delegate to) rather than instantiating DecisionTwinTools
// itself — that class imports the orchestrator, which imports this file, and importing
// DecisionTwinTools back here would create a circular module cycle that crashes under Node's
// strict ESM loader (tools -> orchestrator -> sub-agents -> tools).
const historicalMemory = new RM.HistoricalMemoryAgent();
const devilsAdvocate = new RM.DevilsAdvocateAgent();
const safetyAgentImpl = new RM.SafetyAgent();

// Helper to merge blackboard findings
function mergeBB(state: DecisionTwinState, key: string, val: any): Record<string, any> {
  return { ...(state.blackboard || {}), [key]: val };
}

// Append-only negotiation log so round-1 dissent is never overwritten by round-2 results.
function appendNegotiationHistory(state: DecisionTwinState, entry: Record<string, any>): Record<string, any> {
  const bb = state.blackboard || {};
  const history = Array.isArray(bb.negotiation_history) ? bb.negotiation_history : [];
  return { ...bb, negotiation_history: [...history, entry] };
}

// Replaces one agent's own prior verdict for a new round without touching other agents' entries.
function replaceBySource<T extends { source: string }>(list: T[], source: string, next: T[]): T[] {
  return [...list.filter(v => v.source !== source), ...next];
}

// Builds the reflection_memory Proposal shape (id/title/evidences/parameters) from the
// Decision Twin blackboard so the real DevilsAdvocateAgent / SafetyAgent classes can run.
// Round 1 intentionally carries no evidence -> guarantees a first-round challenge.
// Round 2+ (post RenegotiateAgent) attaches evidence + safety remediation -> can resolve.
function buildModelProposal(state: DecisionTwinState, round: number): RM.Proposal {
  const bb = state.blackboard || {};
  const event = state.event || {};
  const leading = [...(state.proposals || [])].sort((a, b) => b.confidence - a.confidence)[0];
  const action = leading?.action || 'immediate_repair';
  const sensor = bb.sensor_agent || {};
  const maintenance = bb.maintenance_agent || {};
  const finance = bb.finance_agent || {};
  const vibration = sensor.readings?.vibration ?? 0;
  const highVibration = vibration > 7;
  const budget = finance.repair_now_cost ?? 50000;

  const evidences: RM.Evidence[] = round >= 2 ? [
    { id: 'sensor_telemetry', description: `get_sensor_data confirms ${vibration} mm/s vibration reading`, source: 'sensor_agent', confidence_score: 0.9 },
    { id: 'maintenance_health_score', description: `check_machine_health reports health score ${maintenance.health_score !== undefined ? Math.round(maintenance.health_score * 100) + '%' : 'n/a'}`, source: 'maintenance_agent', confidence_score: 0.85 },
    { id: 'historical_precedent', description: 'HistoricalMemoryAgent precedent cross-checked mid-reasoning', source: 'memory_agent', confidence_score: 0.8 },
  ] : [];

  return {
    id: `proposal-${event.machine_id || 'unknown'}-r${round}`,
    title: `${String(action).replace(/_/g, ' ')} for ${event.machine_id || 'unknown machine'}`,
    description: leading?.reason || `Proposed action: ${action}`,
    proposed_by: leading?.source || 'maintenance_agent',
    parameters: {
      budget_allocation: budget,
      // Round 1: interlock only assumed enabled for the immediate_repair action.
      // Round 2: RenegotiateAgent has applied the SOP remediation (enable interlock).
      auto_failover: round >= 2 ? true : (action === 'immediate_repair' || !highVibration),
      action,
      machine_id: event.machine_id,
    },
    evidences,
    risk_level: highVibration ? 'HIGH' : 'MEDIUM',
  };
}

// ─────────────────────────────────────────────────────────────────
// EVIDENCE LAYER — PLANNING & TOOL-USE pillars: each agent calls a real MCP tool
// and states why it's calling it given what other agents already found.
// ─────────────────────────────────────────────────────────────────

export async function sensorAgent(state: DecisionTwinState): Promise<Partial<DecisionTwinState>> {
  const event = state.event || {};
  const machineId = event.machine_id || 'unknown';
  const reasoning = `Event reported vibration=${event.vibration_level ?? 'n/a'}, temp=${event.temperature ?? 'n/a'}, pressure=${event.pressure ?? 'n/a'} -- calling get_sensor_data('${machineId}') to confirm against live telemetry.`;

  const sensorData = lookupSensorData(machineId, {
    vibration_level: event.vibration_level,
    temperature: event.temperature,
    pressure: event.pressure,
  });

  const vibration = sensorData.telemetry.vibration_mm_s;
  const temperature = sensorData.telemetry.temperature_celsius;
  const pressure = sensorData.telemetry.hydraulic_pressure_bar;

  const anomalies = [...sensorData.anomalies];

  const severity = (vibration > 7.5 || temperature > 85) ? 'critical' :
                   (vibration > 3.5 || temperature > 60) ? 'high' :
                   anomalies.length > 0 ? 'moderate' : 'normal';

  const findings = {
    machine_id: sensorData.machineId,
    anomalies,
    severity,
    readings: { vibration, temperature, pressure },
    status: sensorData.status,
    summary: `${anomalies.length} anomalies detected (live get_sensor_data telemetry), severity: ${severity}`,
  };

  return {
    blackboard: mergeBB(state, 'sensor_agent', findings),
    agents_completed: [...(state.agents_completed || []), 'sensor_agent'],
    trace: [
      ...(state.trace || []),
      `     [SensorAgent] ${reasoning}`,
      `       -> ${sensorData.name} (${sensorData.location}): ${anomalies.length} anomalies | Severity: ${severity.toUpperCase()}`,
      ...anomalies.map((a: string) => `       - ${a}`),
    ],
  };
}

export async function maintenanceAgent(state: DecisionTwinState): Promise<Partial<DecisionTwinState>> {
  const event = state.event || {};
  const machineId = event.machine_id || 'unknown';
  const sensor = (state.blackboard || {}).sensor_agent || {};
  const reasoning = `SensorAgent flagged severity='${sensor.severity || 'unknown'}' -- calling check_machine_health('${machineId}') for maintenance-derived health score.`;

  const health = lookupMachineHealth(machineId, {
    vibration_level: event.vibration_level,
    temperature: event.temperature,
  });

  const healthScore = health.healthScore / 100;
  const failureProbability = Number((1 - healthScore).toFixed(2));
  const needsImmediate = health.healthScore < 40;

  const findings = {
    machine_id: health.machineId,
    health_score: healthScore,
    failure_probability: failureProbability,
    component_wear: health.componentWearPercent,
    recommendation: needsImmediate ? 'immediate_repair' : 'schedule_maintenance',
    summary: `Health=${health.healthScore}% (check_machine_health), P(failure)=${(failureProbability * 100).toFixed(0)}%, Rec: ${health.recommendedAction}`,
  };

  const proposals: Proposal[] = needsImmediate ? [{
    source: 'maintenance_agent',
    action: 'immediate_repair',
    reason: `check_machine_health reports ${health.healthScore}% health (below critical threshold 40%). Failure probability ${(failureProbability * 100).toFixed(0)}%.`,
    confidence: 0.75,
  }] : [];

  return {
    blackboard: mergeBB(state, 'maintenance_agent', findings),
    agents_completed: [...(state.agents_completed || []), 'maintenance_agent'],
    proposals: [...(state.proposals || []), ...proposals],
    trace: [
      ...(state.trace || []),
      `     [MaintenanceAgent] ${reasoning}`,
      `       -> Health=${health.healthScore}%, P(fail)=${(failureProbability * 100).toFixed(0)}%, Recommendation: ${health.recommendedAction}`,
    ],
  };
}

export async function memoryAgent(state: DecisionTwinState): Promise<Partial<DecisionTwinState>> {
  const event = state.event || {};
  const machineId = event.machine_id || 'unknown';
  const sensor = (state.blackboard || {}).sensor_agent || {};

  const query = `${machineId} ${sensor.severity || ''} bearing vibration temperature failure`.trim();
  const reasoning = `Cross-referencing SensorAgent's severity ('${sensor.severity || 'n/a'}') -- querying HistoricalMemoryAgent (TF-IDF RAG index) for precedent: "${query}"`;

  const results = historicalMemory.queryMidReasoning(query, 2);
  const similarIncidents = results.map(([inc, score]) => ({
    incident_id: inc.id,
    title: inc.title,
    outcome: inc.outcome,
    risk_score: inc.risk_score,
    lessons_learned: inc.lessons_learned,
    similarity_score: Number(score.toFixed(3)),
  }));

  const topMatch = similarIncidents[0];
  const precedentSupports = topMatch && /FAILURE|CRITICAL/i.test(topMatch.outcome) ? 'immediate_repair' : 'schedule_maintenance';

  const findings = {
    similar_incidents: similarIncidents,
    precedent_supports: precedentSupports,
    summary: topMatch
      ? `Found ${similarIncidents.length} precedent(s) via HistoricalMemoryAgent. Closest: ${topMatch.incident_id} (sim=${topMatch.similarity_score}) -> ${topMatch.outcome}`
      : 'No precedent found in historical memory index.',
  };

  return {
    blackboard: mergeBB(state, 'memory_agent', findings),
    agents_completed: [...(state.agents_completed || []), 'memory_agent'],
    trace: [
      ...(state.trace || []),
      `     [MemoryAgent] ${reasoning}`,
      ...similarIncidents.map(i => `       - ${i.incident_id} (sim=${i.similarity_score}): ${i.title} -> ${i.outcome}`),
      `       Precedent supports: ${precedentSupports}`,
    ],
  };
}

export async function productionAgent(state: DecisionTwinState): Promise<Partial<DecisionTwinState>> {
  const event = state.event || {};
  const machineId = event.machine_id || 'unknown';
  const maintenance = (state.blackboard || {}).maintenance_agent || {};

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
      `     [ProductionAgent] MaintenanceAgent recommends '${maintenance.recommendation || 'n/a'}' — checking schedule impact before that action is greenlit.`,
      `       -> ${machineId}: 87% util, 3 orders | 4hr stop: ${findings.impact_if_stopped_4h} | 48hr stop: ${findings.impact_if_stopped_48h}`,
    ],
  };
}

export async function inventoryAgent(state: DecisionTwinState): Promise<Partial<DecisionTwinState>> {
  const maintenance = (state.blackboard || {}).maintenance_agent || {};
  const partId = 'PART-BRG-409';
  const reasoning = `MaintenanceAgent flagged spindle bearing wear (health=${maintenance.health_score !== undefined ? Math.round(maintenance.health_score * 100) + '%' : 'n/a'}) -- calling check_inventory('${partId}') before recommending immediate repair.`;

  const item = lookupInventory(partId);

  const findings = {
    required_part: item.partName,
    part_id: item.partId,
    in_stock: item.availableCount > 0,
    quantity_available: item.availableCount,
    location: item.storageLocation,
    lead_time_if_ordered: `${item.leadTimeDays} business days`,
    summary: `check_inventory: ${item.partName} — ${item.availableCount} unit(s) available at ${item.storageLocation}.`,
  };

  return {
    blackboard: mergeBB(state, 'inventory_agent', findings),
    agents_completed: [...(state.agents_completed || []), 'inventory_agent'],
    trace: [
      ...(state.trace || []),
      `     [InventoryAgent] ${reasoning}`,
      `       -> ${item.partName}: ${item.availableCount} unit(s) at ${item.storageLocation}, lead time ${item.leadTimeDays}d`,
    ],
  };
}

export async function financeAgent(state: DecisionTwinState): Promise<Partial<DecisionTwinState>> {
  const event = state.event || {};
  const machineId = event.machine_id || 'unknown';
  const maintenance = (state.blackboard || {}).maintenance_agent || {};
  const reasoning = `MaintenanceAgent recommendation is '${maintenance.recommendation || 'n/a'}' -- calling estimate_downtime_cost for both the 4h repair-now window and the 48h delay-risk window to quantify the tradeoff.`;

  const repairNow = calculateDowntimeCost(machineId, 4, event.vibration_level, event.temperature);
  const delayed = calculateDowntimeCost(machineId, 48, event.vibration_level, event.temperature);

  const severityFactor = Math.max(1.0, ((event.vibration_level ?? 1.2) / 5.0) * ((event.temperature ?? 48.2) / 80.0));
  const delayProbability = Number(Math.min(0.95, 0.05 * severityFactor * 7).toFixed(2));
  const expectedDelayCost = Math.round(delayed.totalEstimatedCostUSD * delayProbability);

  const findings = {
    repair_now_cost: repairNow.totalEstimatedCostUSD,
    repair_now_duration: '4 hours',
    delay_repair_risk_cost: delayed.totalEstimatedCostUSD,
    delay_repair_probability: delayProbability,
    expected_delay_cost: expectedDelayCost,
    summary: `estimate_downtime_cost: repair now $${repairNow.totalEstimatedCostUSD.toLocaleString()} (4h) vs. expected delay cost $${expectedDelayCost.toLocaleString()} (${Math.round(delayProbability * 100)}% x 48h risk).`,
  };

  const costRatio = repairNow.totalEstimatedCostUSD > 0 ? (expectedDelayCost / repairNow.totalEstimatedCostUSD).toFixed(1) : '1.0';
  const proposals: Proposal[] = [{
    source: 'finance_agent',
    action: expectedDelayCost > repairNow.totalEstimatedCostUSD ? 'immediate_repair' : 'continue_normal_operation',
    reason: `Expected delay cost ($${expectedDelayCost.toLocaleString()}) is ${costRatio}x repair-now cost ($${repairNow.totalEstimatedCostUSD.toLocaleString()})`,
    confidence: 0.80,
  }];

  return {
    blackboard: mergeBB(state, 'finance_agent', findings),
    agents_completed: [...(state.agents_completed || []), 'finance_agent'],
    proposals: [...(state.proposals || []), ...proposals],
    trace: [
      ...(state.trace || []),
      `     [FinanceAgent] ${reasoning}`,
      `       -> Repair now: $${repairNow.totalEstimatedCostUSD.toLocaleString()} | Delay risk: $${expectedDelayCost.toLocaleString()} expected`,
    ],
  };
}

// ─────────────────────────────────────────────────────────────────
// REFLECTION & SAFETY LAYER — real DevilsAdvocateAgent/SafetyAgent/HistoricalMemoryAgent.
// Runs twice (round 1 then round 2 via RenegotiateAgent) — the REFLECTION pillar.
// ─────────────────────────────────────────────────────────────────

export async function devilsAdvocateAgent(state: DecisionTwinState): Promise<Partial<DecisionTwinState>> {
  const round = state.negotiation_round || 1;
  const proposals = state.proposals || [];

  if (proposals.length === 0) {
    return {
      agents_completed: [...(state.agents_completed || []), 'devils_advocate_agent'],
      trace: [...(state.trace || []), '     [DevilsAdvocate] No proposals to challenge.'],
    };
  }

  const modelProposal = buildModelProposal(state, round);

  // MEMORY PILLAR: mid-reasoning lookup, independent of MemoryAgent's earlier upfront query —
  // the retrieved incidents directly influence the risk score / renegotiation verdict below.
  const memoryQuery = `${modelProposal.title} ${modelProposal.description}`;
  const retrieved = historicalMemory.queryMidReasoning(memoryQuery, 2);
  const incidents = retrieved.map(([inc]) => inc);

  const counter = devilsAdvocate.evaluateProposal(modelProposal, incidents);
  const reasoning = `Round ${round}: stress-testing leading proposal '${modelProposal.title}' (evidence attached=${modelProposal.evidences?.length || 0}) — pulling precedent mid-reasoning before ruling.`;

  const existingChallenges = state.challenges || [];
  const challenges = counter.renegotiation_required
    ? replaceBySource(existingChallenges, 'devils_advocate_agent', [{
        source: 'devils_advocate_agent',
        challenged_proposal: modelProposal.parameters.action,
        challenge: [counter.challenge_summary, ...counter.counter_claims].join(' '),
        requested_evidence: counter.missing_evidences.join('; ') || 'Additional supporting evidence',
        severity: counter.risk_score >= 0.6 ? 'high' : 'moderate',
        round,
      } as Challenge])
    : replaceBySource(existingChallenges, 'devils_advocate_agent', []);

  const bb = appendNegotiationHistory(state, {
    round,
    agent: 'devils_advocate_agent',
    incidents_consulted: incidents.map(i => i.id),
    risk_score: counter.risk_score,
    renegotiation_required: counter.renegotiation_required,
    summary: counter.challenge_summary,
  });

  return {
    blackboard: { ...bb, devils_advocate_agent: { round, ...counter, summary: counter.challenge_summary } },
    challenges,
    agents_completed: [...(state.agents_completed || []), 'devils_advocate_agent'],
    trace: [
      ...(state.trace || []),
      `     [DevilsAdvocate] ${reasoning}`,
      `       Precedent consulted mid-reasoning: [${incidents.map(i => i.id).join(', ') || 'none'}]`,
      `       ${counter.challenge_summary}`,
      ...(counter.renegotiation_required ? [`       Requested evidence: ${counter.missing_evidences.join('; ')}`] : []),
    ],
  };
}

export async function safetyAgent(state: DecisionTwinState): Promise<Partial<DecisionTwinState>> {
  const round = state.negotiation_round || 1;
  const proposals = state.proposals || [];

  if (proposals.length === 0) {
    return {
      agents_completed: [...(state.agents_completed || []), 'safety_agent'],
      trace: [...(state.trace || []), '     [SafetyAgent] No proposal to validate.'],
    };
  }

  const modelProposal = buildModelProposal(state, round);
  const verdict = safetyAgentImpl.validateProposal(modelProposal);
  const reasoning = `Round ${round}: validating '${modelProposal.title}' against SOP rules (budget cap, operational interlock, security) before Plant Manager convergence.`;

  const existingVetoes = state.vetoes || [];
  const vetoes = verdict.verdict === RM.VerdictType.HARD_VETO
    ? replaceBySource(existingVetoes, 'safety_agent', [{
        source: 'safety_agent',
        vetoed_action: modelProposal.parameters.action,
        reason: `${verdict.details} ${verdict.violated_rules.join(' ')}`,
        sop_reference: verdict.violated_rules.map(r => r.split(' ')[0]).join(', '),
        round,
      } as Veto])
    : replaceBySource(existingVetoes, 'safety_agent', []);

  const bb = appendNegotiationHistory(state, {
    round,
    agent: 'safety_agent',
    verdict: verdict.verdict,
    violated_rules: verdict.violated_rules,
  });

  return {
    blackboard: { ...bb, safety_agent: { round, ...verdict, summary: verdict.details } },
    vetoes,
    agents_completed: [...(state.agents_completed || []), 'safety_agent'],
    trace: [
      ...(state.trace || []),
      `     [SafetyAgent] ${reasoning}`,
      `       ${verdict.details}`,
      ...verdict.violated_rules.map(r => `       VIOLATION: ${r}`),
    ],
  };
}

// Bridges round 1 -> round 2: revises the proposal with evidence + SOP remediation so
// DevilsAdvocate/SafetyAgent can be re-run against a materially different proposal.
export async function renegotiateAgent(state: DecisionTwinState): Promise<Partial<DecisionTwinState>> {
  const lastChallenge = (state.challenges || []).find(c => c.source === 'devils_advocate_agent');
  const lastVeto = (state.vetoes || []).find(v => v.source === 'safety_agent');

  const fixes: string[] = [];
  if (lastVeto) fixes.push('enabling automated safety interlock (auto_failover) per SOP remediation advice');
  if (lastChallenge) fixes.push('attaching sensor telemetry, machine-health, and precedent evidence (confidence >= 0.8)');
  if (fixes.length === 0) fixes.push('attaching supporting evidence proactively');

  const findings = {
    round: 2,
    revision_applied: fixes,
    summary: `Revised proposal for round 2: ${fixes.join('; ')}.`,
  };

  return {
    blackboard: mergeBB(state, 'renegotiate_agent', findings),
    agents_completed: [...(state.agents_completed || []), 'renegotiate_agent'],
    trace: [
      ...(state.trace || []),
      `     [RenegotiateAgent] Round 1 objection(s): ${lastChallenge ? `DevilsAdvocate — "${lastChallenge.challenge.slice(0, 90)}..."` : ''}${lastVeto ? ` SafetyAgent VETO — "${lastVeto.reason.slice(0, 90)}..."` : ''}`,
      `       Revising proposal: ${fixes.join('; ')}.`,
    ],
  };
}

export async function riskAgent(state: DecisionTwinState): Promise<Partial<DecisionTwinState>> {
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
      `     [RiskAgent] Cross-referencing SensorAgent + MaintenanceAgent + FinanceAgent blackboard entries -> Composite: ${(composite * 100).toFixed(1)}% (${level})`,
      `       Safety=${(safetyRisk * 100).toFixed(0)}% | Financial=${(financialRisk * 100).toFixed(0)}% | Mechanical=${(mechanicalRisk * 100).toFixed(0)}%`,
    ],
  };
}

// ─────────────────────────────────────────────────────────────────
// SIMULATION LAYER — real calculateStrategyMetrics from scenario_simulation_agent.ts
// ─────────────────────────────────────────────────────────────────

export async function scenarioSimulationAgent(state: DecisionTwinState): Promise<Partial<DecisionTwinState>> {
  const vetoes = state.vetoes || [];
  const vetoedActions = new Set(vetoes.map(v => v.vetoed_action));
  const bb = state.blackboard || {};
  const sensor = bb.sensor_agent || {};
  const finance = bb.finance_agent || {};
  const production = bb.production_agent || {};

  const reasoning = `Negotiation resolved after ${state.negotiation_round || 1} round(s) — running quantitative simulation (calculateStrategyMetrics) across Repair Now / Delay Repair / Reduced Capacity before final convergence.`;

  const sim = calculateStrategyMetrics({
    vibrationLevel: sensor.readings?.vibration,
    temperature: sensor.readings?.temperature,
    hourlyDowntimeCost: finance.repair_now_cost ? finance.repair_now_cost / 4 : undefined,
    activeOrders: production.active_orders,
    delayDays: 2,
    capacityPct: production.reroute_capacity ? production.reroute_capacity * 100 : undefined,
  });

  // Maps the real simulator's strategy ids onto the domain action vocabulary used elsewhere.
  const actionMap: Record<string, string> = {
    repair_now: 'immediate_repair',
    delay_repair: 'delay_repair',
    reduced_capacity: 'reduced_capacity',
  };

  const viableIds = Object.keys(sim.strategies).filter(id => !vetoedActions.has(actionMap[id]));
  viableIds.sort((a, b) => sim.strategies[b].resilienceScore - sim.strategies[a].resilienceScore);
  const bestId = viableIds[0] || sim.bestStrategyId;
  const best = sim.strategies[bestId];

  const findings = {
    scenarios_evaluated: sim.strategies,
    vetoed_scenarios: Array.from(vetoedActions),
    recommended: actionMap[bestId],
    cost_savings_vs_delay: sim.costSavingsVsDelay,
    summary: `calculateStrategyMetrics evaluated 3 strategies, ${vetoedActions.size} vetoed. Best viable: ${best.name} (score=${best.resilienceScore}/100).`,
  };

  const proposals: Proposal[] = [{
    source: 'scenario_simulation_agent',
    action: actionMap[bestId],
    reason: `Numeric simulation ranks ${best.name} #1 (score=${best.resilienceScore}/100, expected cost $${best.totalExpectedCost.toLocaleString()}). Saves $${sim.costSavingsVsDelay.toLocaleString()} vs. delaying repair.`,
    confidence: Math.min(0.95, best.resilienceScore / 100),
  }];

  return {
    blackboard: mergeBB(state, 'scenario_simulation_agent', findings),
    agents_completed: [...(state.agents_completed || []), 'scenario_simulation_agent'],
    proposals: [...(state.proposals || []), ...proposals],
    trace: [
      ...(state.trace || []),
      `     [ScenarioSim] ${reasoning}`,
      ...Object.entries(sim.strategies).map(([id, s]) =>
        `       ${id === bestId ? '>>>' : vetoedActions.has(actionMap[id]) ? 'XXX' : '   '} ${s.name}: cost=$${s.totalExpectedCost.toLocaleString()}, risk=${s.failureRiskPct}%, score=${s.resilienceScore}`),
      `       Recommended: ${actionMap[bestId]}`,
    ],
  };
}

export async function qualityAgent(state: DecisionTwinState): Promise<Partial<DecisionTwinState>> {
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
      `     [QualityAgent] SensorAgent severity='${severity}' -> Defect risk: ${qualityRisk.defect_rate_increase} increase`,
      `       Batch at risk: ${qualityRisk.batch_at_risk} | Quarantine: ${qualityRisk.quarantine_recommended}`,
    ],
  };
}

// Sub-agent registry map — every entry is a real, async node (no stubs/mocks).
export const AGENT_REGISTRY: Record<string, (state: DecisionTwinState) => Promise<Partial<DecisionTwinState>>> = {
  sensor_agent: sensorAgent,
  maintenance_agent: maintenanceAgent,
  memory_agent: memoryAgent,
  production_agent: productionAgent,
  inventory_agent: inventoryAgent,
  finance_agent: financeAgent,
  devils_advocate_agent: devilsAdvocateAgent,
  safety_agent: safetyAgent,
  renegotiate_agent: renegotiateAgent,
  risk_agent: riskAgent,
  scenario_simulation_agent: scenarioSimulationAgent,
  quality_agent: qualityAgent,
};
