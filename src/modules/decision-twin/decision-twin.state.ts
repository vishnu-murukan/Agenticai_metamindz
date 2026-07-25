export interface SubGoal {
  id: string;
  description: string;
  requiredAgent: string;
  priority: number;
}

export interface Proposal {
  source: string;
  action: string;
  reason: string;
  confidence: number;
}

export interface Veto {
  source: string;
  vetoed_action: string;
  reason: string;
  sop_reference?: string;
}

export interface Challenge {
  challenged_proposal: string;
  challenge: string;
  requested_evidence: string;
  severity: string;
}

export interface WorkOrder {
  type: string;
  machine_id: string;
  action: string;
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  assigned_to: string;
  notes: string;
}

export interface SupervisorNotification {
  type: string;
  machine_id: string;
  summary: string;
  requires_approval: boolean;
}

export interface FinalDecision {
  chosen_action: string;
  confidence: number;
  reason: string;
  supporting_evidence: Record<string, string>;
  vetoes: Veto[];
  challenges_addressed: Challenge[];
  agents_consulted: string[];
  machine_id: string;
}

export interface DecisionTwinState {
  event: Record<string, any>;
  event_type: 'sensor_anomaly' | 'maintenance_alert' | 'quality_deviation' | string;
  
  sub_goals: SubGoal[];
  
  phase: 'planning' | 'evidence' | 'reflection' | 'simulation' | 'convergence' | string;
  active_agents: string[];
  agents_completed: string[];
  current_agent: string;
  
  blackboard: Record<string, any>;
  
  proposals: Proposal[];
  vetoes: Veto[];
  challenges: Challenge[];
  final_decision?: FinalDecision;
  
  work_orders: WorkOrder[];
  notifications: SupervisorNotification[];
  
  trace: string[];
}
