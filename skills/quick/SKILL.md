---
name: quick
description: "Quick Mode — fast single-agent execution for simple changes"
---

# MAVIS Quick Mode

Fast path for simple, well-scoped changes. Single agent, minimal ceremony.

## Step 1: Initialize Session

Run: `npx tsx ${CLAUDE_PLUGIN_ROOT}/lib/state.ts init quick`

## Step 2: Clarification (0-3 questions max)

Analyze the task. Determine if any critical information is missing:
- Is the target file/component clear?
- Is the desired behavior unambiguous?
- Are there obvious edge cases that need a decision?

If everything is clear: skip to Step 3.
If clarification needed: ask via AskUserQuestion (max 3 questions total, ask them all at once if possible using a numbered list with options).

## Step 3: Echo-Back Confirmation

Print: "Got it. I'll do: [1-2 sentence summary of what will be done]. Proceeding..."

This is NOT a question — just confirmation. Proceed immediately.

## Step 4: Select Agent by Domain

Analyze the task domain and select ONE agent:

| Domain Signals | Agent |
|---|---|
| CSS, styling, React components, UI layout, animations, HTML | mavis-fe |
| API routes, database, middleware, server logic, ORM, queries | mavis-be |
| Test files, coverage, mocking, assertions, test utils | mavis-test |
| Config, infra, Docker, CI/CD, build system, architecture | mavis-arch |
| Unclear / multiple domains | mavis-fe or mavis-be (pick dominant) |

## Step 5: Execute via Agent

Spawn the selected agent as a teammate with the task.

Provide in the prompt:
- The exact task description
- Target file(s) if known
- Any constraints from clarification answers
- Instruction: "Complete this task. Report back when done with: files modified, changes made, any concerns."

## Step 6: Verification

After agent completes, run verification commands:

```bash
# Run lint if available
npm run lint 2>&1 || echo "NO_LINT_SCRIPT"

# Run typecheck if available  
npm run typecheck 2>&1 || npx tsc --noEmit 2>&1 || echo "NO_TYPECHECK"

# Run tests if available
npm test 2>&1 || echo "NO_TEST_SCRIPT"
```

Evaluate results:
- If all pass: proceed to Step 7
- If failures: attempt auto-fix (one retry), then report issues if still failing

## Step 7: Report & Log

Display result summary:
```
[MAVIS Quick] Complete
- Task: {summary}
- Agent: {agent_name}
- Files: {list of modified files}
- Verification: {PASS/FAIL with details}
- Duration: {time from session start}
```

Append to `.mavis/quick-log.jsonl`:
```json
{"timestamp": "...", "task": "...", "agent": "...", "files": [...], "verification": "PASS|FAIL", "duration": "..."}
```

## Step 8: Complexity Check

If during execution ANY of these occurred:
- Agent reported needing to modify 5+ files
- Agent reported architectural concerns
- Verification revealed cascading failures
- Task turned out to involve 3+ components

Then offer escalation via AskUserQuestion:
"This task turned out more complex than expected ({reason}). Want to escalate to Full Mode for proper planning?"
Options: ["Escalate to Full Mode", "Keep the quick result as-is"]

If escalate: invoke the `mavis` skill with the original task (it will route to Full Mode).
