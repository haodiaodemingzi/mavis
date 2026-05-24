import { describe, it, expect } from "vitest";
import { evaluateCoverage, type CoverageScore } from "./coverage-scorer.js";
import type { KnowledgeGraph } from "./knowledge-graph.js";

function emptyGraph(): KnowledgeGraph {
  return { nodes: [], edges: [], updatedAt: new Date().toISOString() };
}

describe("coverage-scorer", () => {
  describe("evaluateCoverage", () => {
    it("returns score 0 for empty graph", () => {
      const graph = emptyGraph();
      const result = evaluateCoverage(graph);
      expect(result.score).toBe(0);
      expect(result.conditions.every((c) => !c.met)).toBe(true);
      expect(result.gaps.length).toBeGreaterThan(0);
    });

    it("evaluates what-clear condition (description > 20 chars)", () => {
      const graph = emptyGraph();
      graph.nodes.push({
        id: "REQ-001",
        type: "Requirement",
        description: "A very detailed requirement description for auth",
        createdAt: new Date().toISOString(),
      });

      const result = evaluateCoverage(graph);
      const whatClear = result.conditions.find((c) => c.name === "what-clear");
      expect(whatClear).toBeDefined();
      expect(whatClear!.met).toBe(true);
    });

    it("fails what-clear when description is too short", () => {
      const graph = emptyGraph();
      graph.nodes.push({
        id: "REQ-001",
        type: "Requirement",
        description: "Auth",
        createdAt: new Date().toISOString(),
      });

      const result = evaluateCoverage(graph);
      const whatClear = result.conditions.find((c) => c.name === "what-clear");
      expect(whatClear!.met).toBe(false);
    });

    it("evaluates who-clear condition (actor keyword present)", () => {
      const graph = emptyGraph();
      graph.nodes.push({
        id: "REQ-001",
        type: "Requirement",
        description: "The user must be able to log in with OAuth2 credentials",
        createdAt: new Date().toISOString(),
      });

      const result = evaluateCoverage(graph);
      const whoClear = result.conditions.find((c) => c.name === "who-clear");
      expect(whoClear!.met).toBe(true);
    });

    it("fails who-clear when no actor keyword is found", () => {
      const graph = emptyGraph();
      graph.nodes.push({
        id: "REQ-001",
        type: "Requirement",
        description: "The system shall process requests in under 200ms",
        createdAt: new Date().toISOString(),
      });

      const result = evaluateCoverage(graph);
      const whoClear = result.conditions.find((c) => c.name === "who-clear");
      expect(whoClear!.met).toBe(false);
    });

    it("evaluates approaches-possible condition (>= 3 requirements)", () => {
      const graph = emptyGraph();
      for (let i = 1; i <= 3; i++) {
        graph.nodes.push({
          id: `REQ-00${i}`,
          type: "Requirement",
          description: `Requirement ${i} with enough detail to pass what-clear check`,
          createdAt: new Date().toISOString(),
        });
      }

      const result = evaluateCoverage(graph);
      const approaches = result.conditions.find((c) => c.name === "approaches-possible");
      expect(approaches!.met).toBe(true);
    });

    it("fails approaches-possible with fewer than 3 requirements", () => {
      const graph = emptyGraph();
      graph.nodes.push({
        id: "REQ-001",
        type: "Requirement",
        description: "Single requirement here",
        createdAt: new Date().toISOString(),
      });

      const result = evaluateCoverage(graph);
      const approaches = result.conditions.find((c) => c.name === "approaches-possible");
      expect(approaches!.met).toBe(false);
    });

    it("evaluates edges-covered condition (>=80% requirements have scenarios)", () => {
      const graph = emptyGraph();
      // 5 requirements, 4 with scenarios = 80%
      for (let i = 1; i <= 5; i++) {
        graph.nodes.push({
          id: `REQ-00${i}`,
          type: "Requirement",
          description: `Requirement ${i}`,
          createdAt: new Date().toISOString(),
        });
        graph.nodes.push({
          id: `SCN-00${i}`,
          type: "Scenario",
          description: `Scenario for requirement ${i}`,
          createdAt: new Date().toISOString(),
        });
      }
      // Add scenario edges for 4 out of 5
      for (let i = 1; i <= 4; i++) {
        graph.edges.push({
          type: "has_scenario",
          from: `REQ-00${i}`,
          to: `SCN-00${i}`,
          createdAt: new Date().toISOString(),
        });
      }

      const result = evaluateCoverage(graph);
      const edgesCovered = result.conditions.find((c) => c.name === "edges-covered");
      expect(edgesCovered!.met).toBe(true);
    });

    it("fails edges-covered when below 80%", () => {
      const graph = emptyGraph();
      // 5 requirements, only 3 with scenarios = 60%
      for (let i = 1; i <= 5; i++) {
        graph.nodes.push({
          id: `REQ-00${i}`,
          type: "Requirement",
          description: `Requirement ${i}`,
          createdAt: new Date().toISOString(),
        });
        graph.nodes.push({
          id: `SCN-00${i}`,
          type: "Scenario",
          description: `Scenario for req ${i}`,
          createdAt: new Date().toISOString(),
        });
      }
      for (let i = 1; i <= 3; i++) {
        graph.edges.push({
          type: "has_scenario",
          from: `REQ-00${i}`,
          to: `SCN-00${i}`,
          createdAt: new Date().toISOString(),
        });
      }

      const result = evaluateCoverage(graph);
      const edgesCovered = result.conditions.find((c) => c.name === "edges-covered");
      expect(edgesCovered!.met).toBe(false);
    });

    it("returns score near 1.0 for full coverage", () => {
      const graph = emptyGraph();
      // 3 requirements with user mention, detailed descriptions, and all with scenarios
      for (let i = 1; i <= 3; i++) {
        graph.nodes.push({
          id: `REQ-00${i}`,
          type: "Requirement",
          description: `The user must be able to perform action ${i} with full support`,
          createdAt: new Date().toISOString(),
        });
        graph.nodes.push({
          id: `SCN-00${i}`,
          type: "Scenario",
          description: `When the user does X then Y happens (${i})`,
          createdAt: new Date().toISOString(),
        });
        graph.edges.push({
          type: "has_scenario",
          from: `REQ-00${i}`,
          to: `SCN-00${i}`,
          createdAt: new Date().toISOString(),
        });
      }

      const result = evaluateCoverage(graph);
      expect(result.score).toBe(1.0);
      expect(result.conditions.every((c) => c.met)).toBe(true);
      expect(result.gaps).toHaveLength(0);
    });

    it("calculates partial score correctly", () => {
      const graph = emptyGraph();
      // 1 requirement with user keyword and long desc -> what-clear + who-clear met
      // but only 1 req (need 3 for approaches) and no scenario edge
      graph.nodes.push({
        id: "REQ-001",
        type: "Requirement",
        description: "The user must authenticate via OAuth2 with Google or GitHub",
        createdAt: new Date().toISOString(),
      });

      const result = evaluateCoverage(graph);
      // what-clear: met, who-clear: met, approaches-possible: not met, edges-covered: not met
      expect(result.score).toBe(0.5);
      expect(result.conditions.filter((c) => c.met)).toHaveLength(2);
    });

    it("gap list identifies specific missing items", () => {
      const graph = emptyGraph();
      graph.nodes.push({
        id: "REQ-001",
        type: "Requirement",
        description: "Short",
        createdAt: new Date().toISOString(),
      });

      const result = evaluateCoverage(graph);
      // Should have gaps for: what-clear, who-clear, approaches-possible, edges-covered
      expect(result.gaps.length).toBeGreaterThanOrEqual(3);
      expect(result.gaps.some((g) => g.includes("description"))).toBe(true);
      expect(result.gaps.some((g) => g.includes("user/actor/persona"))).toBe(true);
      expect(result.gaps.some((g) => g.includes("Requirement node"))).toBe(true);
    });
  });
});
