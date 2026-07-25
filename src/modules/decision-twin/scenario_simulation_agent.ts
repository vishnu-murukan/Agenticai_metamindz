import { ToolDecorator as Tool, ExecutionContext, z } from '@nitrostack/core';

export interface ScenarioSimulationParams {
  vibrationLevel?: number;
  temperature?: number;
  hourlyDowntimeCost?: number;
  activeOrders?: number;
  delayDays?: number;
  capacityPct?: number;
}

export interface StrategyDetail {
  id: string;
  name: string;
  badge?: string;
  badgeColor?: string;
  totalExpectedCost: number;
  repairCost: number;
  downtimeLoss: number;
  downtimeHours: number;
  failureRiskPct: number;
  deliveryRiskPct: number;
  resilienceScore: number;
  recommendationRank: number;
  pros: string[];
  cons: string[];
}

export interface ScenarioSimulationResult {
  parametersEvaluated: {
    vibrationLevel: number;
    temperature: number;
    hourlyDowntimeCost: number;
    activeOrders: number;
    delayDays: number;
    capacityPct: number;
    severityFactor: number;
  };
  bestStrategyId: string;
  strategies: Record<string, StrategyDetail>;
  costSavingsVsDelay: number;
}

/**
 * Calculate quantitative metrics for all 3 maintenance strategies.
 */
export function calculateStrategyMetrics(params: ScenarioSimulationParams = {}): ScenarioSimulationResult {
  const vibrationLevel = params.vibrationLevel ?? 6.5;
  const temperature = params.temperature ?? 85.0;
  const hourlyDowntimeCost = params.hourlyDowntimeCost ?? 12500.0;
  const activeOrders = params.activeOrders ?? 3;
  const delayDays = params.delayDays ?? 7;
  const capacityPct = params.capacityPct ?? 60.0;

  // Base severity coefficient
  const severityFactor = Math.max(1.0, (vibrationLevel / 5.0) * (temperature / 80.0));

  // --- 1. REPAIR NOW ---
  const rnDowntimeHrs = 4.0;
  const rnRepairCost = 45000.0;
  const rnDowntimeLoss = rnDowntimeHrs * hourlyDowntimeCost;
  const rnTotalCost = rnRepairCost + rnDowntimeLoss;
  const rnFailureRisk = 2.0;
  const rnDeliveryRisk = 5.0;
  const rnScore = severityFactor > 1.2 ? 92 : 80;

  // --- 2. DELAY REPAIR ---
  const baseDailyRisk = Math.min(0.25, 0.05 * severityFactor);
  const drFailureProb = Math.min(0.95, 1.0 - Math.exp(-baseDailyRisk * delayDays));
  const drCatastrophicDowntimeHrs = 48.0;
  const drCatastrophicRepairCost = 140000.0;
  const drDowntimeLoss = drCatastrophicDowntimeHrs * hourlyDowntimeCost;
  const drOrderPenalty = activeOrders * 25000.0;

  const drExpectedCost = drFailureProb * (drCatastrophicRepairCost + drDowntimeLoss + drOrderPenalty);
  const drFailureRisk = Number((drFailureProb * 100).toFixed(1));
  const drDeliveryRisk = Math.min(95.0, Number((drFailureProb * 90).toFixed(1)));
  const drScore = Math.max(10, 100 - Math.round(drFailureRisk * 1.1));

  // --- 3. REDUCED CAPACITY ---
  const deratedStress = severityFactor * Math.pow(capacityPct / 100.0, 2);
  const rcFailureProb = Math.min(0.35, 0.03 * deratedStress * delayDays);
  const rcCapacityLossPerDay = ((100.0 - capacityPct) / 100.0) * (hourlyDowntimeCost * 12);
  const rcRevenueLoss = rcCapacityLossPerDay * delayDays;
  const rcScheduledRepairCost = 38000.0;
  const rcPlannedDowntimeLoss = 4.0 * hourlyDowntimeCost * 0.7;

  const rcExpectedCost = rcRevenueLoss + rcScheduledRepairCost + rcPlannedDowntimeLoss + (rcFailureProb * drCatastrophicRepairCost);
  const rcFailureRisk = Number((rcFailureProb * 100).toFixed(1));
  const rcDeliveryRisk = Number(Math.min(60.0, (100.0 - capacityPct) * 0.75).toFixed(1));
  const rcScore = severityFactor <= 1.5 ? 85 : 72;

  const strategies: Record<string, StrategyDetail> = {
    repair_now: {
      id: 'repair_now',
      name: 'Repair Now (Immediate Maintenance)',
      badge: 'Immediate Action',
      badgeColor: 'cyan',
      totalExpectedCost: Math.round(rnTotalCost),
      repairCost: Math.round(rnRepairCost),
      downtimeLoss: Math.round(rnDowntimeLoss),
      downtimeHours: rnDowntimeHrs,
      failureRiskPct: rnFailureRisk,
      deliveryRiskPct: rnDeliveryRisk,
      resilienceScore: rnScore,
      recommendationRank: rnScore >= Math.max(drScore, rcScore) ? 1 : 2,
      pros: ['Eliminates catastrophic breakdown risk', 'Uses in-stock parts immediately', 'Fastest restoration to 100% capacity'],
      cons: ['Immediate 4-hour production stoppage'],
    },
    reduced_capacity: {
      id: 'reduced_capacity',
      name: `Operate at Reduced Capacity (De-rate to ${Math.round(capacityPct)}%)`,
      badge: 'Balanced De-Rate',
      badgeColor: 'amber',
      totalExpectedCost: Math.round(rcExpectedCost),
      repairCost: Math.round(rcScheduledRepairCost),
      downtimeLoss: Math.round(rcRevenueLoss + rcPlannedDowntimeLoss),
      downtimeHours: 4.0,
      failureRiskPct: rcFailureRisk,
      deliveryRiskPct: rcDeliveryRisk,
      resilienceScore: rcScore,
      recommendationRank: rnScore >= Math.max(drScore, rcScore) ? 2 : 1,
      pros: ['Maintains partial order throughput', 'Schedules maintenance during off-peak hours', 'Significant stress reduction'],
      cons: ['Accumulates daily capacity revenue loss', 'Requires active order rerouting'],
    },
    delay_repair: {
      id: 'delay_repair',
      name: `Delay Repair (${delayDays} Days)`,
      badge: 'High Risk Deferral',
      badgeColor: 'rose',
      totalExpectedCost: Math.round(drExpectedCost),
      repairCost: Math.round(drCatastrophicRepairCost * drFailureProb),
      downtimeLoss: Math.round(drDowntimeLoss * drFailureProb),
      downtimeHours: Number((drCatastrophicDowntimeHrs * drFailureProb).toFixed(1)),
      failureRiskPct: drFailureRisk,
      deliveryRiskPct: drDeliveryRisk,
      resilienceScore: drScore,
      recommendationRank: 3,
      pros: ['Zero immediate downtime today'],
      cons: ['Exponentially escalating failure risk', 'Potential 48h catastrophic outage', 'Severe financial penalty'],
    },
  };

  const bestId = Object.keys(strategies).reduce((a, b) =>
    strategies[a].resilienceScore > strategies[b].resilienceScore ? a : b
  );

  return {
    parametersEvaluated: {
      vibrationLevel,
      temperature,
      hourlyDowntimeCost,
      activeOrders,
      delayDays,
      capacityPct,
      severityFactor: Number(severityFactor.toFixed(2)),
    },
    bestStrategyId: bestId,
    strategies,
    costSavingsVsDelay: Math.round(drExpectedCost - strategies[bestId].totalExpectedCost),
  };
}

/**
 * ScenarioSimulationAgent MCP Controller & Tool Provider
 */
export class ScenarioSimulationAgent {
  /**
   * Tool 1: simulate_scenarios
   * Evaluates Repair Now, Delay Repair, and Reduced Capacity operational strategies.
   */
  @Tool({
    name: 'simulate_scenarios',
    description: 'Performs quantitative rule-based simulation comparing three operational strategies: Repair Now, Delay Repair, and Reduced Capacity.',
    inputSchema: z.object({
      vibrationLevel: z.number().optional().default(6.5).describe('Vibration level reading (mm/s)'),
      temperature: z.number().optional().default(85.0).describe('Operating temperature in Celsius'),
      hourlyDowntimeCost: z.number().optional().default(12500.0).describe('Hourly downtime cost in USD'),
      activeOrders: z.number().optional().default(3).describe('Active production orders affected'),
      delayDays: z.number().optional().default(7).describe('Deferred repair delay in days'),
      capacityPct: z.number().optional().default(60.0).describe('De-rated capacity percentage')
    })
  })
  async simulateScenarios(
    input: ScenarioSimulationParams,
    ctx?: ExecutionContext
  ): Promise<ScenarioSimulationResult> {
    if (ctx?.logger) {
      ctx.logger.info('Executing Scenario Simulation Agent strategy matrix', { ...input });
    }
    return calculateStrategyMetrics(input);
  }

  /**
   * Tool 2: evaluate_scenario_agent
   * Evaluates state event parameters and produces a blackboard proposal.
   */
  @Tool({
    name: 'evaluate_scenario_agent',
    description: 'Evaluates state event parameters for Decision Twin multi-agent workflow and returns agent blackboard state and proposal.',
    inputSchema: z.object({
      vibrationLevel: z.number().optional().default(6.5),
      temperature: z.number().optional().default(85.0),
      hourlyDowntimeCost: z.number().optional().default(12500.0),
      activeOrders: z.number().optional().default(3),
      delayDays: z.number().optional().default(7),
      capacityPct: z.number().optional().default(60.0)
    })
  })
  async evaluateScenarioAgent(input: ScenarioSimulationParams, ctx?: ExecutionContext) {
    if (ctx?.logger) {
      ctx.logger.info('Evaluating scenario simulation agent state proposal', { ...input });
    }

    const simulationResults = calculateStrategyMetrics(input);
    const bestStrat = simulationResults.strategies[simulationResults.bestStrategyId];

    const proposal = {
      source: 'scenario_simulation_agent',
      action: simulationResults.bestStrategyId,
      reason: `Numeric simulation ranks ${bestStrat.name} #1 (Score: ${bestStrat.resilienceScore}/100). Saves $${simulationResults.costSavingsVsDelay.toLocaleString()} compared to delaying repair.`,
      confidence: 0.88,
      matrix: simulationResults,
    };

    const trace = [
      `     [ScenarioSimulationAgent] Evaluated 3 strategies:`,
      `       1. Repair Now        : Expected Cost = $${simulationResults.strategies.repair_now.totalExpectedCost.toLocaleString()} (Risk: ${simulationResults.strategies.repair_now.failureRiskPct}%)`,
      `       2. Reduced Capacity  : Expected Cost = $${simulationResults.strategies.reduced_capacity.totalExpectedCost.toLocaleString()} (Risk: ${simulationResults.strategies.reduced_capacity.failureRiskPct}%)`,
      `       3. Delay Repair (${simulationResults.parametersEvaluated.delayDays}d): Expected Cost = $${simulationResults.strategies.delay_repair.totalExpectedCost.toLocaleString()} (Risk: ${simulationResults.strategies.delay_repair.failureRiskPct}%)`,
      `       Recommendation: ${simulationResults.bestStrategyId} (Savings vs Delay: $${simulationResults.costSavingsVsDelay.toLocaleString()})`,
    ];

    return {
      blackboard: { scenario_simulation_agent: simulationResults },
      agentsCompleted: ['scenario_simulation_agent'],
      proposals: [proposal],
      trace,
    };
  }
}
