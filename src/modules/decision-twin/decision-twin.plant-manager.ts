import { DecisionTwinState, FinalDecision, WorkOrder, SupervisorNotification } from './decision-twin.state.js';

const REFLECTION_AGENTS = ['devils_advocate_agent', 'safety_agent', 'risk_agent'];
const SIMULATION_AGENTS = ['scenario_simulation_agent', 'quality_agent'];

export function dispatchNode(state: DecisionTwinState): Partial<DecisionTwinState> {
  const active = [...(state.active_agents || [])];
  const phase = state.phase || '';

  if (active.length > 0) {
    const nextAgent = active[0];
    const remaining = active.slice(1);
    return {
      current_agent: nextAgent,
      active_agents: remaining,
      trace: [...(state.trace || []), `  >> [PlantManager] Dispatching -> ${nextAgent}`],
    };
  }

  if (phase === '' || phase === 'planning') {
    const agents = (state.sub_goals || []).map(g => g.requiredAgent);
    if (agents.length === 0) {
      return {
        phase: 'convergence',
        current_agent: 'converge',
        active_agents: [],
        trace: [...(state.trace || []), '  !! [PlantManager] No sub-goals. Skipping to CONVERGENCE.'],
      };
    }
    return {
      phase: 'evidence',
      current_agent: agents[0],
      active_agents: agents.slice(1),
      trace: [
        ...(state.trace || []),
        '\n' + '-'.repeat(60),
        '  PHASE: EVIDENCE GATHERING',
        `  Activating ${agents.length} agents: [${agents.join(', ')}]`,
        '-'.repeat(60),
      ],
    };
  }

  if (phase === 'evidence') {
    return {
      phase: 'reflection',
      current_agent: REFLECTION_AGENTS[0],
      active_agents: REFLECTION_AGENTS.slice(1),
      trace: [
        ...(state.trace || []),
        '\n' + '-'.repeat(60),
        '  PHASE: REFLECTION & SAFETY',
        `  Activating: [${REFLECTION_AGENTS.join(', ')}]`,
        '-'.repeat(60),
      ],
    };
  }

  if (phase === 'reflection') {
    const vetoes = state.vetoes || [];
    const challenges = state.challenges || [];

    if (vetoes.length > 0 || challenges.length > 0) {
      return {
        phase: 'simulation',
        current_agent: SIMULATION_AGENTS[0],
        active_agents: SIMULATION_AGENTS.slice(1),
        trace: [
          ...(state.trace || []),
          '\n' + '-'.repeat(60),
          '  PHASE: SCENARIO SIMULATION',
          `  Triggered by ${vetoes.length} veto(es), ${challenges.length} challenge(s)`,
          `  Activating: [${SIMULATION_AGENTS.join(', ')}]`,
          '-'.repeat(60),
        ],
      };
    }
    return {
      phase: 'convergence',
      current_agent: 'converge',
      active_agents: [],
      trace: [
        ...(state.trace || []),
        '\n' + '-'.repeat(60),
        '  No vetoes/challenges. Moving to CONVERGENCE.',
        '-'.repeat(60),
      ],
    };
  }

  if (phase === 'simulation') {
    return {
      phase: 'convergence',
      current_agent: 'converge',
      active_agents: [],
      trace: [
        ...(state.trace || []),
        '\n' + '-'.repeat(60),
        '  Simulation complete. Moving to CONVERGENCE.',
        '-'.repeat(60),
      ],
    };
  }

  return {
    phase: 'convergence',
    current_agent: 'converge',
    active_agents: [],
    trace: [...(state.trace || []), '  !! [PlantManager] Unexpected state — fallback to CONVERGENCE.'],
  };
}

export function convergeNode(state: DecisionTwinState): Partial<DecisionTwinState> {
  const blackboard = state.blackboard || {};
  const proposals = state.proposals || [];
  const vetoes = state.vetoes || [];
  const challenges = state.challenges || [];
  const completed = state.agents_completed || [];
  const event = state.event || {};

  const vetoedActions = new Set(vetoes.map(v => v.vetoed_action));
  const viable = proposals.filter(p => !vetoedActions.has(p.action));

  let chosen: { action: string; reason: string; confidence: number };
  if (viable.length > 0) {
    viable.sort((a, b) => b.confidence - a.confidence);
    chosen = viable[0];
  } else {
    chosen = {
      action: 'escalate_to_human',
      reason: 'All proposals vetoed or none generated',
      confidence: 0.0,
    };
  }

  const supportingEvidence: Record<string, string> = {};
  for (const [agent, findings] of Object.entries(blackboard)) {
    supportingEvidence[agent] = typeof findings === 'object' && findings !== null && 'summary' in findings
      ? (findings as any).summary
      : JSON.stringify(findings);
  }

  const finalDecision: FinalDecision = {
    chosen_action: chosen.action,
    confidence: chosen.confidence,
    reason: chosen.reason,
    supporting_evidence: supportingEvidence,
    vetoes,
    challenges_addressed: challenges,
    agents_consulted: completed,
    machine_id: event.machine_id || 'unknown',
  };

  const workOrder: WorkOrder = {
    type: 'work_order',
    machine_id: event.machine_id || 'unknown',
    action: chosen.action,
    priority: chosen.confidence > 0.7 ? 'HIGH' : 'MEDIUM',
    assigned_to: 'available_technician',
    notes: chosen.reason,
  };

  const notification: SupervisorNotification = {
    type: 'supervisor_notification',
    machine_id: event.machine_id || 'unknown',
    summary: `Decision: ${chosen.action} (confidence: ${(chosen.confidence * 100).toFixed(0)}%)`,
    requires_approval: chosen.confidence < 0.8,
  };

  const traceLines = [
    '\n' + '='.repeat(60),
    '  PLANT MANAGER — FINAL DECISION',
    '='.repeat(60),
    `  Action     : ${finalDecision.chosen_action}`,
    `  Confidence : ${(finalDecision.confidence * 100).toFixed(0)}%`,
    `  Reason     : ${finalDecision.reason}`,
    `  Consulted  : ${completed.length} agents`,
    `  Vetoes     : ${vetoes.length}`,
    `  Challenges : ${challenges.length}`,
    '='.repeat(60),
  ];

  return {
    final_decision: finalDecision,
    work_orders: [...(state.work_orders || []), workOrder],
    notifications: [...(state.notifications || []), notification],
    trace: [...(state.trace || []), ...traceLines],
  };
}
