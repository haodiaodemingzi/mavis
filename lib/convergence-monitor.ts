import { existsSync, mkdirSync, readFileSync, writeFileSync, renameSync } from "fs";
import { join, dirname } from "path";

// ─── Types ───────────────────────────────────────────────────────────────────

export type AttemptResult = "pass" | "fail";
export type Trend = "converging" | "diverging" | "oscillating" | "unknown";

export interface RequirementTrack {
  attempts: number;
  history: AttemptResult[];
  lastAgent: string;
  escalated: boolean;
}

export interface FixTracker {
  requirements: Record<string, RequirementTrack>;
  cycles: number;
  trend: Trend;
}

export interface EscalationCheck {
  shouldEscalate: boolean;
  reason: string;
  attempts: number;
  pattern: Trend;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const TRACKER_PATH = join(process.cwd(), ".mavis", "fix-tracker.json");
const MAX_ATTEMPTS_DEFAULT = 3;
const OSCILLATION_WINDOW = 4;

// ─── File I/O ────────────────────────────────────────────────────────────────

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

export function loadTracker(): FixTracker {
  if (!existsSync(TRACKER_PATH)) {
    return { requirements: {}, cycles: 0, trend: "unknown" };
  }
  return JSON.parse(readFileSync(TRACKER_PATH, "utf-8"));
}

export function saveTracker(tracker: FixTracker): void {
  atomicWrite(TRACKER_PATH, JSON.stringify(tracker, null, 2));
}

// ─── Trend Detection ─────────────────────────────────────────────────────────

/**
 * Detect oscillation: same requirement alternates pass/fail in last 4 entries
 */
function isOscillating(history: AttemptResult[]): boolean {
  if (history.length < OSCILLATION_WINDOW) return false;
  const recent = history.slice(-OSCILLATION_WINDOW);
  // Pattern: alternating pass/fail (e.g. pass,fail,pass,fail or fail,pass,fail,pass)
  for (let i = 1; i < recent.length; i++) {
    if (recent[i] === recent[i - 1]) return false;
  }
  return true;
}

/**
 * Compute global trend based on failure counts across cycles.
 * Groups history entries into chunks representing cycles and compares failure rates.
 */
function computeTrend(tracker: FixTracker): Trend {
  const allReqs = Object.values(tracker.requirements);
  if (allReqs.length === 0) return "unknown";

  // Check if any requirement is oscillating
  const hasOscillation = allReqs.some((r) => isOscillating(r.history));
  if (hasOscillation) return "oscillating";

  // Compare recent failures vs earlier failures
  // Use the last 2 entries across all requirements as "recent" vs "earlier"
  let recentFailures = 0;
  let earlierFailures = 0;
  let hasEnoughData = false;

  for (const req of allReqs) {
    if (req.history.length >= 2) {
      hasEnoughData = true;
      const last = req.history[req.history.length - 1];
      const secondLast = req.history[req.history.length - 2];
      if (last === "fail") recentFailures++;
      if (secondLast === "fail") earlierFailures++;
    }
  }

  if (!hasEnoughData) return "unknown";

  if (recentFailures < earlierFailures) return "converging";
  if (recentFailures > earlierFailures) return "diverging";
  return "unknown";
}

// ─── Core Operations ─────────────────────────────────────────────────────────

export function trackAttempt(reqId: string, result: AttemptResult, agentRole: string): FixTracker {
  const tracker = loadTracker();

  if (!tracker.requirements[reqId]) {
    tracker.requirements[reqId] = {
      attempts: 0,
      history: [],
      lastAgent: "",
      escalated: false,
    };
  }

  const req = tracker.requirements[reqId];
  req.attempts++;
  req.history.push(result);
  req.lastAgent = agentRole;
  tracker.cycles++;

  // Recompute trend
  tracker.trend = computeTrend(tracker);

  saveTracker(tracker);
  return tracker;
}

export function shouldEscalate(reqId: string, maxAttempts: number = MAX_ATTEMPTS_DEFAULT): EscalationCheck {
  const tracker = loadTracker();
  const req = tracker.requirements[reqId];

  if (!req) {
    return {
      shouldEscalate: false,
      reason: `Requirement "${reqId}" has no tracked attempts`,
      attempts: 0,
      pattern: "unknown",
    };
  }

  const oscillating = isOscillating(req.history);
  const maxReached = req.attempts >= maxAttempts;

  if (oscillating) {
    return {
      shouldEscalate: true,
      reason: `Requirement "${reqId}" is oscillating (alternating pass/fail) — needs human review or different approach`,
      attempts: req.attempts,
      pattern: "oscillating",
    };
  }

  if (maxReached) {
    return {
      shouldEscalate: true,
      reason: `Requirement "${reqId}" has reached max attempts (${req.attempts}/${maxAttempts})`,
      attempts: req.attempts,
      pattern: computeTrend(tracker),
    };
  }

  return {
    shouldEscalate: false,
    reason: `Requirement "${reqId}" at ${req.attempts}/${maxAttempts} attempts, no oscillation detected`,
    attempts: req.attempts,
    pattern: computeTrend(tracker),
  };
}

// ─── CLI ─────────────────────────────────────────────────────────────────────

function cli(): void {
  const args = process.argv.slice(2);
  const command = args[0];

  try {
    switch (command) {
      case "track": {
        const [, reqId, result, agentRole] = args;
        if (!reqId || !result || !agentRole) {
          console.error("Usage: convergence-monitor.ts track <reqId> <pass|fail> <agentRole>");
          process.exit(1);
        }
        if (result !== "pass" && result !== "fail") {
          console.log(JSON.stringify({ error: `Result must be "pass" or "fail", got "${result}"` }));
          process.exit(1);
        }
        const tracker = trackAttempt(reqId, result as AttemptResult, agentRole);
        console.log(JSON.stringify({
          status: "tracked",
          reqId,
          result,
          agentRole,
          totalAttempts: tracker.requirements[reqId].attempts,
          trend: tracker.trend,
        }));
        break;
      }

      case "status": {
        const tracker = loadTracker();
        console.log(JSON.stringify(tracker, null, 2));
        break;
      }

      case "should-escalate": {
        const [, reqId] = args;
        if (!reqId) {
          console.error("Usage: convergence-monitor.ts should-escalate <reqId>");
          process.exit(1);
        }
        const check = shouldEscalate(reqId);
        console.log(JSON.stringify(check, null, 2));
        break;
      }

      default:
        console.log(JSON.stringify({
          error: `Unknown command "${command}"`,
          usage: "Commands: track, status, should-escalate",
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
