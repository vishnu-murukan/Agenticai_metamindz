import { DecisionTwinState } from './decision-twin.state.js';
import { plannerNode } from './decision-twin.planner.js';
import { dispatchNode, convergeNode } from './decision-twin.plant-manager.js';
import { AGENT_REGISTRY } from './decision-twin.sub-agents.js';

export class DecisionTwinOrchestrator {
  static run(initialState: Partial<DecisionTwinState>): DecisionTwinState {
    let state: DecisionTwinState = {
      event: initialState.event || {},
      event_type: initialState.event_type || 'sensor_anomaly',
      sub_goals: [],
      phase: 'planning',
      active_agents: [],
      agents_completed: [],
      current_agent: '',
      blackboard: {},
      proposals: [],
      vetoes: [],
      challenges: [],
      work_orders: [],
      notifications: [],
      trace: [],
      ...initialState,
    };

    // Step 1: Planner Agent
    const plannerResult = plannerNode(state);
    state = { ...state, ...plannerResult };

    // Loop: Dispatch -> Sub-agent -> Dispatch -> ... -> Convergence
    let maxSteps = 50;
    while (maxSteps > 0) {
      maxSteps--;

      // Plant Manager Dispatch
      const dispatchResult = dispatchNode(state);
      state = { ...state, ...dispatchResult };

      const currentAgent = state.current_agent;

      if (currentAgent === 'converge') {
        // Plant Manager Convergence
        const convergeResult = convergeNode(state);
        state = { ...state, ...convergeResult };
        break;
      }

      if (AGENT_REGISTRY[currentAgent]) {
        // Execute sub-agent node
        const agentResult = AGENT_REGISTRY[currentAgent](state);
        state = {
          ...state,
          blackboard: agentResult.blackboard || state.blackboard,
          agents_completed: agentResult.agents_completed || state.agents_completed,
          proposals: agentResult.proposals || state.proposals,
          vetoes: agentResult.vetoes || state.vetoes,
          challenges: agentResult.challenges || state.challenges,
          trace: agentResult.trace || state.trace,
        };
      } else {
        // Unknown agent -> break to convergence
        const convergeResult = convergeNode(state);
        state = { ...state, ...convergeResult };
        break;
      }
    }

    return state;
  }
}
