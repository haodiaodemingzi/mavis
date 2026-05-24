---
name: start
description: "Smart router — analyzes input, detects mode, orchestrates MAVIS workflow"
---

# MAVIS Smart Router + Full Mode Orchestrator

<!--
State Machine (DOT graph for LLM clarity):

digraph MAVIS {
  rankdir=LR;
  idle -> mode_detection [label="user input"];
  mode_detection -> quick_mode [label="quick signals"];
  mode_detection -> bug_mode [label="bug signals"];
  mode_detection -> exploring [label="full signals"];
  exploring -> planning [label="spec approved"];
  planning -> executing [label="plan approved"];
  executing -> verifying [label="all tasks done"];
  verifying -> done [label="all PASS"];
  verifying -> fixing [label="any FAIL"];
  fixing -> verifying [label="fixes applied"];
  fixing -> done [label="escalated to human"];
}
-->

## Step 1: Check for Existing Session

Run: `npx tsx ${CLAUDE_PLUGIN_ROOT}/lib/state.ts exists`

- If `{"exists": true}`: Read session with `npx tsx ${CLAUDE_PLUGIN_ROOT}/lib/state.ts get`
  - If phase is NOT "done" or "cancelled": Ask user via AskUserQuestion:
    - "I found an existing MAVIS session (mode: {mode}, phase: {phase}). Resume it or start fresh?"
    - Options: ["Resume existing session", "Start fresh (will archive old session)"]
  - If "Resume": jump to the current phase handler below
  - If "Start fresh": rename `.mavis/` to `.mavis-archived-{timestamp}/` then continue

## Step 2: Analyze Input for Mode Signals

Scan the user's requirement text for these signal patterns:

**Bug signals** (any match = suggest Bug Mode):
- Error messages or stack traces (lines with `at ...`, `Error:`, `Exception`)
- Keywords: "broken", "crash", "500", "404", "doesn't work", "null", "undefined is not", "segfault", "timeout", "regression", "used to work"
- Exception patterns: `TypeError`, `NullPointerException`, `ENOENT`, `SIGKILL`

**Quick signals** (most matches = suggest Quick Mode):
- Single-file scope: mentions one specific file or component
- Clear action verbs: "change", "rename", "add button", "update color", "move", "delete", "toggle", "swap"
- Fewer than 3 components mentioned
- Trivial scope: "typo", "wording", "padding", "margin", "icon"

**Full signals** (any match = suggest Full Mode):
- Multiple components or files referenced (3+)
- Architecture words: "system", "service", "module", "integration", "pipeline", "workflow"
- Ambiguous scope: unclear how many files are affected
- Creation words: "build", "create", "implement", "design", "architect", "new feature"
- Cross-cutting: "auth", "permissions", "database schema", "API", "migration"

## Step 3: Recommend Mode

Use AskUserQuestion to present the detection result:

```
I've analyzed your request and detected these signals:
[list the specific signals found]

Recommended mode: **{MODE}**

Modes available:
- Full Mode: Deep exploration → validated plan → agent team execution → verification
- Quick Mode: 0-3 questions → single agent → fast delivery
- Bug Mode: Scientific debugging protocol (reproduce → hypothesize → isolate → fix → verify)
```

Options: ["Full Mode", "Quick Mode", "Bug Mode"]

## Step 4: Dispatch to Mode

- If **Quick Mode**: Invoke the `mavis-quick` skill with the requirement
- If **Bug Mode**: Invoke the `mavis-bug` skill with the requirement
- If **Full Mode**: Continue to Step 5

## Step 5: Full Mode Orchestration

Manage the phase state machine:

### Phase: Exploring
Invoke the `mavis-explore` skill with the requirement.
Wait for it to complete (spec approved by user).

### Phase: Planning
Invoke the `mavis-plan` skill.
Wait for it to complete (plan approved by user).

### Phase: Executing
Invoke the `mavis-execute` skill.
Wait for it to complete (all tasks done).

### Phase: Verifying
Invoke the `mavis-verify` skill.
Check result:
- If all PASS → transition to "done", report success
- If any FAIL → transition to "fixing"

### Phase: Fixing
Invoke the `mavis-fix` skill.
After fixes applied → transition back to "verifying" (re-verify affected requirements only).
If escalated to human → transition to "done" with partial completion note.

### Phase: Done
Display final summary:
- Total requirements satisfied
- Time elapsed (from session.json startedAt)
- Files modified (git diff --stat)
- Offer: "Shall I commit these changes?"
