import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { rmSync, existsSync } from "fs";
import { join } from "path";
import {
  loadGraph,
  saveGraph,
  addNode,
  addEdge,
  removeNode,
  findGaps,
  computeCoverage,
  exportSpec,
  type KnowledgeGraph,
} from "./knowledge-graph.js";

// The module uses join(process.cwd(), ".mavis", "knowledge-graph.json") as a constant
// captured at load time. We clean that file between tests to ensure isolation.
const GRAPH_FILE = join(process.cwd(), ".mavis", "knowledge-graph.json");

beforeEach(() => {
  if (existsSync(GRAPH_FILE)) {
    rmSync(GRAPH_FILE, { force: true });
  }
});

afterEach(() => {
  if (existsSync(GRAPH_FILE)) {
    rmSync(GRAPH_FILE, { force: true });
  }
});

function emptyGraph(): KnowledgeGraph {
  return { nodes: [], edges: [], updatedAt: new Date().toISOString() };
}

describe("knowledge-graph", () => {
  describe("addNode", () => {
    it("adds a Requirement node", () => {
      const graph = emptyGraph();
      addNode(graph, "Requirement", "REQ-001", "User authentication");
      expect(graph.nodes).toHaveLength(1);
      expect(graph.nodes[0]).toMatchObject({
        id: "REQ-001",
        type: "Requirement",
        description: "User authentication",
      });
    });

    it("adds a Constraint node", () => {
      const graph = emptyGraph();
      addNode(graph, "Constraint", "CON-001", "Must respond within 200ms");
      expect(graph.nodes).toHaveLength(1);
      expect(graph.nodes[0].type).toBe("Constraint");
    });

    it("adds a Scenario node", () => {
      const graph = emptyGraph();
      addNode(graph, "Scenario", "SCN-001", "User logs in with valid credentials");
      expect(graph.nodes).toHaveLength(1);
      expect(graph.nodes[0].type).toBe("Scenario");
    });

    it("adds a Dependency node", () => {
      const graph = emptyGraph();
      addNode(graph, "Dependency", "DEP-001", "Requires PostgreSQL 15+");
      expect(graph.nodes).toHaveLength(1);
      expect(graph.nodes[0].type).toBe("Dependency");
    });

    it("throws on duplicate node ID", () => {
      const graph = emptyGraph();
      addNode(graph, "Requirement", "REQ-001", "First");
      expect(() => addNode(graph, "Requirement", "REQ-001", "Second")).toThrow(
        'Node with id "REQ-001" already exists'
      );
    });
  });

  describe("addEdge", () => {
    it("adds a has_constraint edge", () => {
      const graph = emptyGraph();
      addNode(graph, "Requirement", "REQ-001", "Auth");
      addNode(graph, "Constraint", "CON-001", "200ms latency");
      addEdge(graph, "has_constraint", "REQ-001", "CON-001");
      expect(graph.edges).toHaveLength(1);
      expect(graph.edges[0]).toMatchObject({
        type: "has_constraint",
        from: "REQ-001",
        to: "CON-001",
      });
    });

    it("adds a has_scenario edge", () => {
      const graph = emptyGraph();
      addNode(graph, "Requirement", "REQ-001", "Auth");
      addNode(graph, "Scenario", "SCN-001", "Valid login");
      addEdge(graph, "has_scenario", "REQ-001", "SCN-001");
      expect(graph.edges[0].type).toBe("has_scenario");
    });

    it("adds a depends_on edge", () => {
      const graph = emptyGraph();
      addNode(graph, "Requirement", "REQ-001", "Auth");
      addNode(graph, "Dependency", "DEP-001", "DB ready");
      addEdge(graph, "depends_on", "REQ-001", "DEP-001");
      expect(graph.edges[0].type).toBe("depends_on");
    });

    it("adds a conflicts_with edge", () => {
      const graph = emptyGraph();
      addNode(graph, "Requirement", "REQ-001", "Auth");
      addNode(graph, "Requirement", "REQ-002", "No auth");
      addEdge(graph, "conflicts_with", "REQ-001", "REQ-002");
      expect(graph.edges[0].type).toBe("conflicts_with");
    });

    it("throws when source node not found", () => {
      const graph = emptyGraph();
      addNode(graph, "Requirement", "REQ-001", "Auth");
      expect(() => addEdge(graph, "has_constraint", "MISSING", "REQ-001")).toThrow(
        'Source node "MISSING" not found'
      );
    });

    it("throws when target node not found", () => {
      const graph = emptyGraph();
      addNode(graph, "Requirement", "REQ-001", "Auth");
      expect(() => addEdge(graph, "has_constraint", "REQ-001", "MISSING")).toThrow(
        'Target node "MISSING" not found'
      );
    });

    it("throws on duplicate edge", () => {
      const graph = emptyGraph();
      addNode(graph, "Requirement", "REQ-001", "Auth");
      addNode(graph, "Constraint", "CON-001", "Latency");
      addEdge(graph, "has_constraint", "REQ-001", "CON-001");
      expect(() => addEdge(graph, "has_constraint", "REQ-001", "CON-001")).toThrow(
        "already exists"
      );
    });
  });

  describe("removeNode", () => {
    it("removes a node by ID", () => {
      const graph = emptyGraph();
      addNode(graph, "Requirement", "REQ-001", "Auth");
      removeNode(graph, "REQ-001");
      expect(graph.nodes).toHaveLength(0);
    });

    it("cascades removal of edges referencing the node", () => {
      const graph = emptyGraph();
      addNode(graph, "Requirement", "REQ-001", "Auth");
      addNode(graph, "Constraint", "CON-001", "Latency");
      addNode(graph, "Scenario", "SCN-001", "Valid login");
      addEdge(graph, "has_constraint", "REQ-001", "CON-001");
      addEdge(graph, "has_scenario", "REQ-001", "SCN-001");

      removeNode(graph, "REQ-001");
      expect(graph.nodes).toHaveLength(2);
      expect(graph.edges).toHaveLength(0);
    });

    it("throws when node not found", () => {
      const graph = emptyGraph();
      expect(() => removeNode(graph, "MISSING")).toThrow('Node "MISSING" not found');
    });
  });

  describe("findGaps", () => {
    it("finds requirements without scenarios", () => {
      const graph = emptyGraph();
      addNode(graph, "Requirement", "REQ-001", "Auth");
      addNode(graph, "Requirement", "REQ-002", "Payments");
      addNode(graph, "Scenario", "SCN-001", "Valid login");
      addEdge(graph, "has_scenario", "REQ-001", "SCN-001");

      const gaps = findGaps(graph);
      expect(gaps).toHaveLength(1);
      expect(gaps[0].id).toBe("REQ-002");
    });

    it("returns empty array when all requirements have scenarios", () => {
      const graph = emptyGraph();
      addNode(graph, "Requirement", "REQ-001", "Auth");
      addNode(graph, "Scenario", "SCN-001", "Valid login");
      addEdge(graph, "has_scenario", "REQ-001", "SCN-001");

      const gaps = findGaps(graph);
      expect(gaps).toHaveLength(0);
    });

    it("returns empty array for graph with no requirements", () => {
      const graph = emptyGraph();
      addNode(graph, "Constraint", "CON-001", "Latency");
      const gaps = findGaps(graph);
      expect(gaps).toHaveLength(0);
    });
  });

  describe("computeCoverage", () => {
    it("returns 0 for empty graph", () => {
      const graph = emptyGraph();
      expect(computeCoverage(graph)).toBe(0);
    });

    it("returns 0 when no requirements are fully specified", () => {
      const graph = emptyGraph();
      addNode(graph, "Requirement", "REQ-001", "Auth");
      // No constraint, no scenario
      expect(computeCoverage(graph)).toBe(0);
    });

    it("returns correct ratio for partial coverage", () => {
      const graph = emptyGraph();
      addNode(graph, "Requirement", "REQ-001", "Auth");
      addNode(graph, "Requirement", "REQ-002", "Payments");
      addNode(graph, "Constraint", "CON-001", "Latency");
      addNode(graph, "Scenario", "SCN-001", "Login");
      // Only REQ-001 is fully specified
      addEdge(graph, "has_constraint", "REQ-001", "CON-001");
      addEdge(graph, "has_scenario", "REQ-001", "SCN-001");

      expect(computeCoverage(graph)).toBe(0.5);
    });

    it("returns 1 when all requirements are fully specified", () => {
      const graph = emptyGraph();
      addNode(graph, "Requirement", "REQ-001", "Auth");
      addNode(graph, "Constraint", "CON-001", "Latency");
      addNode(graph, "Scenario", "SCN-001", "Login");
      addEdge(graph, "has_constraint", "REQ-001", "CON-001");
      addEdge(graph, "has_scenario", "REQ-001", "SCN-001");

      expect(computeCoverage(graph)).toBe(1);
    });
  });

  describe("JSON round-trip (save/load)", () => {
    it("preserves data after save and load", () => {
      const graph = emptyGraph();
      addNode(graph, "Requirement", "REQ-001", "Auth feature");
      addNode(graph, "Scenario", "SCN-001", "Login test");
      addEdge(graph, "has_scenario", "REQ-001", "SCN-001");

      saveGraph(graph);

      const loaded = loadGraph();
      expect(loaded.nodes).toHaveLength(2);
      expect(loaded.edges).toHaveLength(1);
      expect(loaded.nodes[0].id).toBe("REQ-001");
      expect(loaded.edges[0].from).toBe("REQ-001");
      expect(loaded.edges[0].to).toBe("SCN-001");
    });

    it("returns empty graph when file does not exist", () => {
      const loaded = loadGraph();
      expect(loaded.nodes).toHaveLength(0);
      expect(loaded.edges).toHaveLength(0);
    });
  });

  describe("exportSpec", () => {
    it("exports empty graph message", () => {
      const graph = emptyGraph();
      const spec = exportSpec(graph);
      expect(spec).toContain("No requirements defined.");
    });

    it("exports requirements with constraints and scenarios", () => {
      const graph = emptyGraph();
      addNode(graph, "Requirement", "REQ-001", "User authentication via OAuth2");
      addNode(graph, "Constraint", "CON-001", "Must respond within 200ms");
      addNode(graph, "Scenario", "SCN-001", "User logs in with Google");
      addEdge(graph, "has_constraint", "REQ-001", "CON-001");
      addEdge(graph, "has_scenario", "REQ-001", "SCN-001");

      const spec = exportSpec(graph);
      expect(spec).toContain("### Requirement: REQ-001");
      expect(spec).toContain("User authentication via OAuth2");
      expect(spec).toContain("**Constraints:**");
      expect(spec).toContain("Must respond within 200ms");
      expect(spec).toContain("**Scenarios:**");
      expect(spec).toContain("User logs in with Google");
    });

    it("exports dependencies between requirements", () => {
      const graph = emptyGraph();
      addNode(graph, "Requirement", "REQ-001", "Auth");
      addNode(graph, "Requirement", "REQ-002", "Payments");
      addEdge(graph, "depends_on", "REQ-002", "REQ-001");

      const spec = exportSpec(graph);
      expect(spec).toContain("**Dependencies:** REQ-001");
    });
  });

  describe("edge cases", () => {
    it("handles graph with only non-Requirement nodes", () => {
      const graph = emptyGraph();
      addNode(graph, "Constraint", "CON-001", "Latency");
      addNode(graph, "Scenario", "SCN-001", "Test");

      expect(computeCoverage(graph)).toBe(0);
      expect(findGaps(graph)).toHaveLength(0);
      expect(exportSpec(graph)).toContain("No requirements defined.");
    });

    it("allows adding edges of different types between same nodes", () => {
      const graph = emptyGraph();
      addNode(graph, "Requirement", "REQ-001", "Auth");
      addNode(graph, "Requirement", "REQ-002", "Payments");
      addEdge(graph, "depends_on", "REQ-001", "REQ-002");
      addEdge(graph, "conflicts_with", "REQ-001", "REQ-002");
      expect(graph.edges).toHaveLength(2);
    });
  });
});
