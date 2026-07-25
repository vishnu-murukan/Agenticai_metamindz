"""StateGraph builder for the Decision Twin orchestrator.

Wires together: PlannerAgent, PlantManager (dispatch + converge),
and all sub-agents into a compiled LangGraph StateGraph with
conditional routing.
"""

from __future__ import annotations

from langgraph.graph import StateGraph, START, END

from .state import DecisionTwinState
from .planner import planner_node
from .plant_manager import dispatch_node, converge_node
from .sub_agents import AGENT_REGISTRY


def route_after_dispatch(state: DecisionTwinState) -> str:
    """Conditional edge: route to the current agent or convergence.

    Called after every ``plant_manager_dispatch`` invocation.  Returns
    the name of the next node to execute.
    """
    agent = state.get("current_agent", "")
    if agent == "converge":
        return "plant_manager_converge"
    if agent in AGENT_REGISTRY:
        return agent
    # Unknown agent — skip to convergence rather than crash
    return "plant_manager_converge"


def build_graph():
    """Construct and compile the Decision Twin StateGraph.

    Graph topology::

        START
          |
        planner
          |
        plant_manager_dispatch  <---------+
          |  (conditional)                |
          +---> sub_agent_X  -------------+
          +---> plant_manager_converge
                      |
                     END
    """
    graph = StateGraph(DecisionTwinState)

    # ── Nodes ────────────────────────────────────────────────────
    graph.add_node("planner", planner_node)
    graph.add_node("plant_manager_dispatch", dispatch_node)
    graph.add_node("plant_manager_converge", converge_node)

    for agent_name, agent_fn in AGENT_REGISTRY.items():
        graph.add_node(agent_name, agent_fn)

    # ── Edges ────────────────────────────────────────────────────
    graph.add_edge(START, "planner")
    graph.add_edge("planner", "plant_manager_dispatch")

    # Dispatch -> conditional routing to agents or convergence
    routing_map: dict[str, str] = {name: name for name in AGENT_REGISTRY}
    routing_map["plant_manager_converge"] = "plant_manager_converge"
    graph.add_conditional_edges(
        "plant_manager_dispatch",
        route_after_dispatch,
        routing_map,
    )

    # Every sub-agent loops back to dispatch
    for agent_name in AGENT_REGISTRY:
        graph.add_edge(agent_name, "plant_manager_dispatch")

    # Convergence -> END
    graph.add_edge("plant_manager_converge", END)

    return graph.compile()
