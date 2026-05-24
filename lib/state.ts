import { existsSync, mkdirSync, readFileSync, writeFileSync, appendFileSync, renameSync } from "fs";
import { join, dirname } from "path";

export interface SessionState {
  phase: "idle" | "exploring" | "planning" | "executing" | "verifying" | "fixing" | "done" | "cancelled";
  mode: "full" | "quick" | "bug";
  startedAt: string;
  updatedAt: string;
  config: {
    maxExploreRounds: number;
    maxFixAttempts: number;
    maxPlanIterations: number;
    concurrencyLimit: number;
    budgetLimitTokens: number | null;
  };
}

export interface ExecutionEvent {
  timestamp: string;
  type:
    | "phase_transition"
    | "task_dispatched"
    | "task_completed"
    | "task_failed"
    | "agent_spawned"
    | "artifact_produced"
    | "wave_micro_verify"
    | "drift_detected"
    | "drift_fixed"
    | "fix_attempted"
    | "human_decision"
    | "context_hardened";
  metadata: Record<string, unknown>;
  summary?: string;
}

const MAVIS_DIR = ".mavis";

function mavisPath(...segments: string[]): string {
  return join(process.cwd(), MAVIS_DIR, ...segments);
}

function atomicWrite(filePath: string, content: string): void {
  const dir = dirname(filePath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  const tmpPath = `${filePath}.tmp-${Date.now()}`;
  writeFileSync(tmpPath, content, "utf-8");
  renameSync(tmpPath, filePath);
}

export function initMavisDir(mode: SessionState["mode"] = "full"): void {
  const dir = mavisPath();
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  const session: SessionState = {
    phase: "idle",
    mode,
    startedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    config: {
      maxExploreRounds: 12,
      maxFixAttempts: 3,
      maxPlanIterations: 3,
      concurrencyLimit: 4,
      budgetLimitTokens: null,
    },
  };

  atomicWrite(mavisPath("session.json"), JSON.stringify(session, null, 2));

  const logPath = mavisPath("execution-log.jsonl");
  if (!existsSync(logPath)) {
    writeFileSync(logPath, "", "utf-8");
  }
}

export function readSession(): SessionState | null {
  const path = mavisPath("session.json");
  if (!existsSync(path)) return null;
  return JSON.parse(readFileSync(path, "utf-8"));
}

export function updateSession(updates: Partial<SessionState>): void {
  const current = readSession();
  if (!current) throw new Error(".mavis/session.json not found. Run initMavisDir() first.");
  const updated = { ...current, ...updates, updatedAt: new Date().toISOString() };
  atomicWrite(mavisPath("session.json"), JSON.stringify(updated, null, 2));
}

export function transitionPhase(newPhase: SessionState["phase"]): void {
  updateSession({ phase: newPhase });
  appendEvent({
    type: "phase_transition",
    metadata: { newPhase },
    summary: `Transitioned to phase: ${newPhase}`,
  });
}

export function appendEvent(event: Omit<ExecutionEvent, "timestamp">): void {
  const entry: ExecutionEvent = { timestamp: new Date().toISOString(), ...event };
  const logPath = mavisPath("execution-log.jsonl");
  appendFileSync(logPath, JSON.stringify(entry) + "\n", "utf-8");
}

export function readEvents(): ExecutionEvent[] {
  const logPath = mavisPath("execution-log.jsonl");
  if (!existsSync(logPath)) return [];
  return readFileSync(logPath, "utf-8")
    .trim()
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

export function writeContextHardening(phase: string, wave: number, content: string): void {
  const contextDir = mavisPath("context");
  if (!existsSync(contextDir)) {
    mkdirSync(contextDir, { recursive: true });
  }
  atomicWrite(mavisPath("context", `${phase}-wave${wave}-summary.md`), content);
  appendEvent({
    type: "context_hardened",
    metadata: { phase, wave },
    summary: `Context hardened at ${phase} wave ${wave}`,
  });
}

export function sessionExists(): boolean {
  return existsSync(mavisPath("session.json"));
}

// CLI interface
const command = process.argv[2];
if (command === "init") {
  const mode = (process.argv[3] as SessionState["mode"]) || "full";
  initMavisDir(mode);
  console.log(JSON.stringify({ status: "initialized", mode }));
} else if (command === "get") {
  const session = readSession();
  console.log(JSON.stringify(session));
} else if (command === "transition") {
  const phase = process.argv[3] as SessionState["phase"];
  if (!phase) {
    console.error("Usage: state.ts transition <phase>");
    process.exit(1);
  }
  transitionPhase(phase);
  console.log(JSON.stringify({ status: "transitioned", phase }));
} else if (command === "exists") {
  console.log(JSON.stringify({ exists: sessionExists() }));
} else if (command === "events") {
  const events = readEvents();
  console.log(JSON.stringify(events));
}
