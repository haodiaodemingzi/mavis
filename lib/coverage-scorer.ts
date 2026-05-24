import { existsSync, readFileSync } from "fs";
import { join } from "path";

import type { KnowledgeGraph } from "./knowledge-graph.js";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface Condition {
  name: string;
  met: boolean;
  detail: string;
}

export interface CoverageScore {
  score: number;
  conditions: Condition[];
  gaps: string[];
}

// ─── Scoring Logic ───────────────────────────────────────────────────────────

const ACTOR_KEYWORDS = ["user", "actor", "persona", "customer", "admin", "operator", "client", "developer"];

export function evaluateCoverage(graph: KnowledgeGraph): CoverageScore {
  const conditions: Condition[] = [];
  const gaps: string[] = [];

  const requirements = graph.nodes.filter((n) => n.type === "Requirement");

  // 1. what-clear: At least 1 Requirement node has a description > 20 chars
  const hasDetailedReq = requirements.some((r) => r.description.length > 20);
  conditions.push({
    name: "what-clear",
    met: hasDetailedReq,
    detail: hasDetailedReq
      ? "At least one requirement has a detailed description (>20 chars)"
      : "No requirement has a description longer than 20 characters",
  });
  if (!hasDetailedReq) {
    gaps.push("Add a detailed description (>20 chars) to at least one Requirement node");
  }

  // 2. who-clear: At least 1 node mentions user/actor/persona
  const allDescriptions = graph.nodes.map((n) => n.description.toLowerCase());
  const hasActorMention = allDescriptions.some((desc) =>
    ACTOR_KEYWORDS.some((keyword) => desc.includes(keyword))
  );
  conditions.push({
    name: "who-clear",
    met: hasActorMention,
    detail: hasActorMention
      ? "At least one node references a user/actor/persona"
      : "No node mentions a user, actor, or persona",
  });
  if (!hasActorMention) {
    gaps.push("Add at least one node that mentions the target user/actor/persona");
  }

  // 3. approaches-possible: At least 3 Requirement nodes exist
  const hasEnoughReqs = requirements.length >= 3;
  conditions.push({
    name: "approaches-possible",
    met: hasEnoughReqs,
    detail: hasEnoughReqs
      ? `${requirements.length} requirement nodes exist (>=3 needed for alternatives)`
      : `Only ${requirements.length} requirement(s) exist — need at least 3 to propose alternatives`,
  });
  if (!hasEnoughReqs) {
    gaps.push(`Add ${3 - requirements.length} more Requirement node(s) to enable alternative approaches`);
  }

  // 4. edges-covered: >=80% of Requirement nodes have at least 1 Scenario edge
  let scenarioCoverage = 0;
  if (requirements.length > 0) {
    const withScenario = requirements.filter((req) =>
      graph.edges.some((e) => e.type === "has_scenario" && e.from === req.id)
    );
    scenarioCoverage = withScenario.length / requirements.length;
  }
  const edgesCovered = scenarioCoverage >= 0.8;
  conditions.push({
    name: "edges-covered",
    met: edgesCovered,
    detail: edgesCovered
      ? `${Math.round(scenarioCoverage * 100)}% of requirements have scenarios (>=80% threshold)`
      : `Only ${Math.round(scenarioCoverage * 100)}% of requirements have scenarios (need >=80%)`,
  });
  if (!edgesCovered) {
    const missingScenarios = requirements.filter(
      (req) => !graph.edges.some((e) => e.type === "has_scenario" && e.from === req.id)
    );
    for (const req of missingScenarios) {
      gaps.push(`Add a Scenario edge for requirement "${req.id}"`);
    }
  }

  // Compute overall score as fraction of conditions met
  const metCount = conditions.filter((c) => c.met).length;
  const score = metCount / conditions.length;

  return { score, conditions, gaps };
}

// ─── CLI ─────────────────────────────────────────────────────────────────────

function cli(): void {
  const command = process.argv[2];

  try {
    switch (command) {
      case "score": {
        const graphPath = join(process.cwd(), ".mavis", "knowledge-graph.json");
        if (!existsSync(graphPath)) {
          console.log(JSON.stringify({ error: "Knowledge graph not found at .mavis/knowledge-graph.json" }));
          process.exit(1);
        }
        const graph: KnowledgeGraph = JSON.parse(readFileSync(graphPath, "utf-8"));
        const result = evaluateCoverage(graph);
        console.log(JSON.stringify(result, null, 2));
        break;
      }

      default:
        console.log(JSON.stringify({
          error: `Unknown command "${command}"`,
          usage: "Commands: score",
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
