import { existsSync, readFileSync } from "fs";

// ─── Types ───────────────────────────────────────────────────────────────────

export type Severity = "HIGH" | "MEDIUM";

export interface ReviewIssue {
  check: string;
  severity: Severity;
  location: string;
  suggestion: string;
}

export interface ReviewResult {
  pass: boolean;
  issues: ReviewIssue[];
}

// ─── Checks ──────────────────────────────────────────────────────────────────

const PLACEHOLDER_PATTERNS = [
  /\bTBD\b/gi,
  /\bTODO\b/gi,
  /\bFIXME\b/gi,
  /\bTBA\b/gi,
  /\bto be determined\b/gi,
  /\bsomehow\b/gi,
  /\bmaybe\b/gi,
  /\bprobably\b/gi,
];

const AMBIGUOUS_QUANTIFIERS = [
  /\bsome\b/gi,
  /\bfew\b/gi,
  /\bmany\b/gi,
  /\bfast\b/gi,
  /\befficient\b/gi,
  /\bquickly\b/gi,
  /\bseveral\b/gi,
];

/**
 * Check 1: Scan for placeholder/vague words
 */
export function checkPlaceholders(content: string, lines: string[]): ReviewIssue[] {
  const issues: ReviewIssue[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    for (const pattern of PLACEHOLDER_PATTERNS) {
      // Reset regex lastIndex for global patterns
      pattern.lastIndex = 0;
      const match = pattern.exec(line);
      if (match) {
        issues.push({
          check: "placeholder-scan",
          severity: "HIGH",
          location: `Line ${i + 1}: "${line.trim()}"`,
          suggestion: `Remove or replace placeholder "${match[0]}" with a concrete specification`,
        });
      }
    }
  }

  return issues;
}

/**
 * Check 2: Basic consistency check — detect "must" and "must not" on same topic
 */
export function checkConsistency(content: string, lines: string[]): ReviewIssue[] {
  const issues: ReviewIssue[] = [];

  // Parse sections (split by headings)
  const sections: { heading: string; startLine: number; lines: string[] }[] = [];
  let currentSection: { heading: string; startLine: number; lines: string[] } = {
    heading: "(top)",
    startLine: 0,
    lines: [],
  };

  for (let i = 0; i < lines.length; i++) {
    if (lines[i].match(/^#{1,6}\s+/)) {
      if (currentSection.lines.length > 0) {
        sections.push(currentSection);
      }
      currentSection = { heading: lines[i].trim(), startLine: i, lines: [] };
    } else {
      currentSection.lines.push(lines[i]);
    }
  }
  if (currentSection.lines.length > 0) {
    sections.push(currentSection);
  }

  // Within each section, find contradictions
  for (const section of sections) {
    const mustStatements: { subject: string; lineNum: number; text: string }[] = [];
    const mustNotStatements: { subject: string; lineNum: number; text: string }[] = [];

    for (let i = 0; i < section.lines.length; i++) {
      const line = section.lines[i].toLowerCase();
      const lineNum = section.startLine + i + 1;

      // Extract "must not" statements
      const mustNotMatch = line.match(/(.{3,30})\s+must\s+not\s+(.{3,})/);
      if (mustNotMatch) {
        mustNotStatements.push({
          subject: mustNotMatch[1].trim(),
          lineNum,
          text: section.lines[i].trim(),
        });
        continue;
      }

      // Extract "must" statements
      const mustMatch = line.match(/(.{3,30})\s+must\s+(.{3,})/);
      if (mustMatch) {
        mustStatements.push({
          subject: mustMatch[1].trim(),
          lineNum,
          text: section.lines[i].trim(),
        });
      }
    }

    // Find subjects that appear in both must and must-not
    for (const pos of mustStatements) {
      for (const neg of mustNotStatements) {
        // Check if subjects are similar enough (share >50% words)
        const posWords = pos.subject.split(/\s+/);
        const negWords = neg.subject.split(/\s+/);
        const shared = posWords.filter((w) => negWords.includes(w));
        if (shared.length > 0 && shared.length >= Math.min(posWords.length, negWords.length) * 0.5) {
          issues.push({
            check: "consistency",
            severity: "HIGH",
            location: `Section "${section.heading}", lines ${pos.lineNum} and ${neg.lineNum}`,
            suggestion: `Potential contradiction: "${pos.text}" vs "${neg.text}" — clarify intended behavior`,
          });
        }
      }
    }
  }

  return issues;
}

/**
 * Check 3: Scope check — if document covers too many unrelated feature areas
 */
export function checkScope(content: string, lines: string[]): ReviewIssue[] {
  const issues: ReviewIssue[] = [];

  // Find top-level requirement headings (### Requirement: ...)
  const reqHeadings: string[] = [];
  for (const line of lines) {
    const match = line.match(/^###\s+(?:Requirement:\s*)?(.+)/i);
    if (match) {
      reqHeadings.push(match[1].trim());
    }
  }

  if (reqHeadings.length <= 3) return issues;

  // Check if requirements share dependencies (look for "depends_on" or cross-references)
  const hasSharedDependency = content.includes("depends_on") ||
    content.includes("Dependencies:") ||
    content.toLowerCase().includes("shared");

  if (!hasSharedDependency && reqHeadings.length > 3) {
    issues.push({
      check: "scope",
      severity: "MEDIUM",
      location: `Document has ${reqHeadings.length} top-level requirements with no apparent shared dependencies`,
      suggestion: "Consider decomposing into separate specs — each spec should cover one cohesive feature area",
    });
  }

  return issues;
}

/**
 * Check 4: Ambiguity check — find vague quantifiers without concrete values
 */
export function checkAmbiguity(content: string, lines: string[]): ReviewIssue[] {
  const issues: ReviewIssue[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // Skip headings and empty lines
    if (line.match(/^#/) || line.trim() === "") continue;

    for (const pattern of AMBIGUOUS_QUANTIFIERS) {
      pattern.lastIndex = 0;
      const match = pattern.exec(line);
      if (match) {
        // Check if the line also contains a number (concrete value)
        const hasNumber = /\d+/.test(line);
        if (!hasNumber) {
          issues.push({
            check: "ambiguity",
            severity: "MEDIUM",
            location: `Line ${i + 1}: "${line.trim()}"`,
            suggestion: `Replace ambiguous word "${match[0]}" with a specific measurable value (e.g., "< 200ms" instead of "fast")`,
          });
        }
      }
    }
  }

  return issues;
}

/**
 * Run all checks on a file
 */
export function runReview(filePath: string): ReviewResult {
  if (!existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }

  const content = readFileSync(filePath, "utf-8");
  const lines = content.split("\n");

  const issues: ReviewIssue[] = [
    ...checkPlaceholders(content, lines),
    ...checkConsistency(content, lines),
    ...checkScope(content, lines),
    ...checkAmbiguity(content, lines),
  ];

  const hasHighIssues = issues.some((i) => i.severity === "HIGH");

  return {
    pass: !hasHighIssues,
    issues,
  };
}

// ─── CLI ─────────────────────────────────────────────────────────────────────

function cli(): void {
  const args = process.argv.slice(2);
  const command = args[0];

  try {
    switch (command) {
      case "check": {
        const filePath = args[1];
        if (!filePath) {
          console.error("Usage: self-review.ts check <filepath>");
          process.exit(1);
        }
        const result = runReview(filePath);
        console.log(JSON.stringify(result, null, 2));
        break;
      }

      default:
        console.log(JSON.stringify({
          error: `Unknown command "${command}"`,
          usage: "Commands: check <filepath>",
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
