import { existsSync, readFileSync } from "fs";
import { join } from "path";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface RequirementBlock {
  id: string;
  heading: string;
  body: string;
  fullText: string;
}

export interface AnchorResult {
  matchedRequirements: string[];
  anchoredText: string;
}

// ─── Parsing ─────────────────────────────────────────────────────────────────

const SPEC_PATH = join(process.cwd(), "requirements-spec.md");

/**
 * Parse requirements-spec.md to extract requirement blocks.
 * Each block starts with ### Requirement: <name> and ends at next ### or EOF.
 */
export function parseRequirements(content: string): RequirementBlock[] {
  const lines = content.split("\n");
  const blocks: RequirementBlock[] = [];
  let currentBlock: { id: string; heading: string; startIdx: number } | null = null;

  for (let i = 0; i <= lines.length; i++) {
    const line = i < lines.length ? lines[i] : "";
    const isHeading = line.match(/^###\s+(?:Requirement:\s*)(.+)/i);
    const isOtherHeading = !isHeading && line.match(/^###\s+/);
    const isEOF = i === lines.length;

    if ((isHeading || isOtherHeading || isEOF) && currentBlock) {
      // Close current block
      const bodyLines = lines.slice(currentBlock.startIdx + 1, i);
      const body = bodyLines.join("\n").trim();
      const fullText = `### Requirement: ${currentBlock.id}\n${body}`;
      blocks.push({
        id: currentBlock.id,
        heading: currentBlock.heading,
        body,
        fullText,
      });
      currentBlock = null;
    }

    if (isHeading) {
      const id = isHeading[1].trim();
      currentBlock = { id, heading: line, startIdx: i };
    }
  }

  return blocks;
}

/**
 * Load and parse the spec file
 */
export function loadRequirements(): RequirementBlock[] {
  if (!existsSync(SPEC_PATH)) {
    throw new Error(`Requirements spec not found at: ${SPEC_PATH}`);
  }
  const content = readFileSync(SPEC_PATH, "utf-8");
  return parseRequirements(content);
}

// ─── Fuzzy Matching ──────────────────────────────────────────────────────────

/**
 * Compute similarity between two strings based on shared words.
 * Returns a score between 0 and 1.
 */
function wordSimilarity(a: string, b: string): number {
  const wordsA = new Set(
    a.toLowerCase().split(/\s+/).filter((w) => w.length > 2)
  );
  const wordsB = new Set(
    b.toLowerCase().split(/\s+/).filter((w) => w.length > 2)
  );

  if (wordsA.size === 0 || wordsB.size === 0) return 0;

  let shared = 0;
  for (const w of wordsA) {
    if (wordsB.has(w)) shared++;
  }

  // Jaccard-like similarity
  return shared / Math.min(wordsA.size, wordsB.size);
}

/**
 * Find requirements that match a task description.
 * Uses fuzzy matching based on shared keywords.
 */
export function matchRequirements(taskDescription: string, requirements: RequirementBlock[]): RequirementBlock[] {
  const THRESHOLD = 0.3;

  const scored = requirements.map((req) => {
    // Match against both ID and body
    const idScore = wordSimilarity(taskDescription, req.id.replace(/[-_]/g, " "));
    const bodyScore = wordSimilarity(taskDescription, req.body);
    const score = Math.max(idScore, bodyScore);
    return { req, score };
  });

  return scored
    .filter((s) => s.score >= THRESHOLD)
    .sort((a, b) => b.score - a.score)
    .map((s) => s.req);
}

// ─── Output Formatting ───────────────────────────────────────────────────────

/**
 * Format matched requirements into the anchor block for prompt injection.
 */
export function formatAnchor(matchedReqs: RequirementBlock[]): string {
  if (matchedReqs.length === 0) {
    return "## No Matching Requirements Found\n\nNo requirements matched the task description.";
  }

  const parts: string[] = [
    "## Requirement You Must Satisfy (VERBATIM — do not deviate)\n",
  ];

  for (const req of matchedReqs) {
    parts.push(req.fullText);
    parts.push("");
  }

  parts.push("## Acceptance Criteria");
  parts.push("Your implementation PASSES if and only if the above scenarios work exactly as described.");

  return parts.join("\n");
}

// ─── CLI ─────────────────────────────────────────────────────────────────────

function cli(): void {
  const args = process.argv.slice(2);
  const command = args[0];

  try {
    switch (command) {
      case "list": {
        const reqs = loadRequirements();
        console.log(JSON.stringify({
          count: reqs.length,
          requirements: reqs.map((r) => ({ id: r.id, preview: r.body.slice(0, 80) })),
        }, null, 2));
        break;
      }

      case "get": {
        const reqId = args[1];
        if (!reqId) {
          console.error("Usage: requirement-anchor.ts get <reqId>");
          process.exit(1);
        }
        const reqs = loadRequirements();
        const found = reqs.find((r) => r.id.toLowerCase() === reqId.toLowerCase());
        if (!found) {
          console.log(JSON.stringify({ error: `Requirement "${reqId}" not found` }));
          process.exit(1);
        }
        console.log(found.fullText);
        break;
      }

      case "anchor": {
        const taskDesc = args.slice(1).join(" ");
        if (!taskDesc) {
          console.error("Usage: requirement-anchor.ts anchor <taskDescription>");
          process.exit(1);
        }
        const reqs = loadRequirements();
        const matched = matchRequirements(taskDesc, reqs);
        const output: AnchorResult = {
          matchedRequirements: matched.map((r) => r.id),
          anchoredText: formatAnchor(matched),
        };
        console.log(JSON.stringify({ matchedRequirements: output.matchedRequirements }, null, 2));
        console.log("\n---\n");
        console.log(output.anchoredText);
        break;
      }

      default:
        console.log(JSON.stringify({
          error: `Unknown command "${command}"`,
          usage: "Commands: list, get <reqId>, anchor <taskDescription>",
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
