import { existsSync, mkdirSync, readFileSync, writeFileSync, renameSync } from "fs";
import { join, dirname } from "path";

// ─── Types ───────────────────────────────────────────────────────────────────

export type NodeType = "Requirement" | "Constraint" | "Scenario" | "Dependency";
export type EdgeType = "has_constraint" | "has_scenario" | "depends_on" | "conflicts_with";

export interface GraphNode {
  id: string;
  type: NodeType;
  description: string;
  createdAt: string;
}

export interface GraphEdge {
  type: EdgeType;
  from: string;
  to: string;
  createdAt: string;
}

export interface KnowledgeGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
  updatedAt: string;
}

// ─── File I/O ────────────────────────────────────────────────────────────────

const GRAPH_PATH = join(process.cwd(), ".mavis", "knowledge-graph.json");

function ensureDir(filePath: string): void {
  const dir = dirname(filePath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

function atomicWrite(filePath: string, content: string): void {
  ensureDir(filePath);
  const tmpPath = `${filePath}.tmp-${Date.now()}`;
  writeFileSync(tmpPath, content, "utf-8");
  renameSync(tmpPath, filePath);
}

export function loadGraph(): KnowledgeGraph {
  if (!existsSync(GRAPH_PATH)) {
    return { nodes: [], edges: [], updatedAt: new Date().toISOString() };
  }
  return JSON.parse(readFileSync(GRAPH_PATH, "utf-8"));
}

export function saveGraph(graph: KnowledgeGraph): void {
  graph.updatedAt = new Date().toISOString();
  atomicWrite(GRAPH_PATH, JSON.stringify(graph, null, 2));
}

// ─── CRUD Operations ─────────────────────────────────────────────────────────

export function addNode(graph: KnowledgeGraph, type: NodeType, id: string, description: string): KnowledgeGraph {
  if (graph.nodes.some((n) => n.id === id)) {
    throw new Error(`Node with id "${id}" already exists`);
  }
  const node: GraphNode = {
    id,
    type,
    description,
    createdAt: new Date().toISOString(),
  };
  graph.nodes.push(node);
  return graph;
}

export function addEdge(graph: KnowledgeGraph, type: EdgeType, from: string, to: string): KnowledgeGraph {
  if (!graph.nodes.some((n) => n.id === from)) {
    throw new Error(`Source node "${from}" not found`);
  }
  if (!graph.nodes.some((n) => n.id === to)) {
    throw new Error(`Target node "${to}" not found`);
  }
  // Prevent duplicate edges
  if (graph.edges.some((e) => e.type === type && e.from === from && e.to === to)) {
    throw new Error(`Edge ${type} from "${from}" to "${to}" already exists`);
  }
  const edge: GraphEdge = {
    type,
    from,
    to,
    createdAt: new Date().toISOString(),
  };
  graph.edges.push(edge);
  return graph;
}

export function removeNode(graph: KnowledgeGraph, id: string): KnowledgeGraph {
  const idx = graph.nodes.findIndex((n) => n.id === id);
  if (idx === -1) {
    throw new Error(`Node "${id}" not found`);
  }
  graph.nodes.splice(idx, 1);
  // Remove all edges referencing this node
  graph.edges = graph.edges.filter((e) => e.from !== id && e.to !== id);
  return graph;
}

// ─── Analysis ────────────────────────────────────────────────────────────────

export function findGaps(graph: KnowledgeGraph): GraphNode[] {
  const requirementNodes = graph.nodes.filter((n) => n.type === "Requirement");
  return requirementNodes.filter((req) => {
    const hasScenario = graph.edges.some(
      (e) => e.type === "has_scenario" && e.from === req.id
    );
    return !hasScenario;
  });
}

export function computeCoverage(graph: KnowledgeGraph): number {
  const requirementNodes = graph.nodes.filter((n) => n.type === "Requirement");
  if (requirementNodes.length === 0) return 0;

  const fullySpecified = requirementNodes.filter((req) => {
    const hasConstraint = graph.edges.some(
      (e) => e.type === "has_constraint" && e.from === req.id
    );
    const hasScenario = graph.edges.some(
      (e) => e.type === "has_scenario" && e.from === req.id
    );
    return hasConstraint && hasScenario;
  });

  return fullySpecified.length / requirementNodes.length;
}

// ─── Export ──────────────────────────────────────────────────────────────────

export function exportSpec(graph: KnowledgeGraph): string {
  const requirements = graph.nodes.filter((n) => n.type === "Requirement");
  if (requirements.length === 0) return "# Requirements Spec\n\nNo requirements defined.\n";

  const lines: string[] = ["# Requirements Spec\n"];

  for (const req of requirements) {
    lines.push(`### Requirement: ${req.id}\n`);
    lines.push(`${req.description}\n`);

    // Constraints
    const constraints = graph.edges
      .filter((e) => e.type === "has_constraint" && e.from === req.id)
      .map((e) => graph.nodes.find((n) => n.id === e.to))
      .filter(Boolean) as GraphNode[];

    if (constraints.length > 0) {
      lines.push("**Constraints:**\n");
      for (const c of constraints) {
        lines.push(`- ${c.description}`);
      }
      lines.push("");
    }

    // Scenarios
    const scenarios = graph.edges
      .filter((e) => e.type === "has_scenario" && e.from === req.id)
      .map((e) => graph.nodes.find((n) => n.id === e.to))
      .filter(Boolean) as GraphNode[];

    if (scenarios.length > 0) {
      lines.push("**Scenarios:**\n");
      for (const s of scenarios) {
        lines.push(`- WHEN/THEN: ${s.description}`);
      }
      lines.push("");
    }

    // Dependencies
    const deps = graph.edges
      .filter((e) => e.type === "depends_on" && e.from === req.id)
      .map((e) => e.to);

    if (deps.length > 0) {
      lines.push(`**Dependencies:** ${deps.join(", ")}\n`);
    }

    lines.push("---\n");
  }

  return lines.join("\n");
}

// ─── CLI ─────────────────────────────────────────────────────────────────────

function cli(): void {
  const args = process.argv.slice(2);
  const command = args[0];

  try {
    switch (command) {
      case "add-node": {
        const [, type, id, ...descParts] = args;
        if (!type || !id || descParts.length === 0) {
          console.error("Usage: add-node <type> <id> <description>");
          process.exit(1);
        }
        const validTypes: NodeType[] = ["Requirement", "Constraint", "Scenario", "Dependency"];
        if (!validTypes.includes(type as NodeType)) {
          console.log(JSON.stringify({ error: `Invalid node type "${type}". Must be one of: ${validTypes.join(", ")}` }));
          process.exit(1);
        }
        const graph = loadGraph();
        addNode(graph, type as NodeType, id, descParts.join(" "));
        saveGraph(graph);
        console.log(JSON.stringify({ status: "added", nodeId: id, type }));
        break;
      }

      case "add-edge": {
        const [, type, fromId, toId] = args;
        if (!type || !fromId || !toId) {
          console.error("Usage: add-edge <type> <fromId> <toId>");
          process.exit(1);
        }
        const validEdgeTypes: EdgeType[] = ["has_constraint", "has_scenario", "depends_on", "conflicts_with"];
        if (!validEdgeTypes.includes(type as EdgeType)) {
          console.log(JSON.stringify({ error: `Invalid edge type "${type}". Must be one of: ${validEdgeTypes.join(", ")}` }));
          process.exit(1);
        }
        const graph = loadGraph();
        addEdge(graph, type as EdgeType, fromId, toId);
        saveGraph(graph);
        console.log(JSON.stringify({ status: "added", edge: { type, from: fromId, to: toId } }));
        break;
      }

      case "remove-node": {
        const [, id] = args;
        if (!id) {
          console.error("Usage: remove-node <id>");
          process.exit(1);
        }
        const graph = loadGraph();
        removeNode(graph, id);
        saveGraph(graph);
        console.log(JSON.stringify({ status: "removed", nodeId: id }));
        break;
      }

      case "gaps": {
        const graph = loadGraph();
        const gaps = findGaps(graph);
        console.log(JSON.stringify({
          count: gaps.length,
          gaps: gaps.map((n) => ({ id: n.id, description: n.description })),
        }));
        break;
      }

      case "coverage": {
        const graph = loadGraph();
        const coverage = computeCoverage(graph);
        console.log(JSON.stringify({
          coverage: Math.round(coverage * 100),
          total: graph.nodes.filter((n) => n.type === "Requirement").length,
          fullySpecified: Math.round(coverage * graph.nodes.filter((n) => n.type === "Requirement").length),
        }));
        break;
      }

      case "export-spec": {
        const graph = loadGraph();
        console.log(exportSpec(graph));
        break;
      }

      case "dump": {
        const graph = loadGraph();
        console.log(JSON.stringify(graph, null, 2));
        break;
      }

      default:
        console.log(JSON.stringify({
          error: `Unknown command "${command}"`,
          usage: "Commands: add-node, add-edge, remove-node, gaps, coverage, export-spec, dump",
        }));
        process.exit(1);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.log(JSON.stringify({ error: message }));
    process.exit(1);
  }
}

cli();
