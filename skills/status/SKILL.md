---
name: status
description: "Progress dashboard — shows current MAVIS session state and metrics"
---

# MAVIS Status Dashboard

Display the current state of the MAVIS session with relevant metrics.

## Step 1: Check for Active Session

Run: `npx tsx ${CLAUDE_PLUGIN_ROOT}/lib/state.ts exists`

If `{"exists": false}`:
Display:
```
MAVIS Status: No active session
================================
Start a new session with /mavis, /mavis-quick, or /mavis-bug
```
Stop here.

## Step 2: Read Session State

Run: `npx tsx ${CLAUDE_PLUGIN_ROOT}/lib/state.ts get`

Extract: mode, phase, startedAt, updatedAt, config.

## Step 3: Mode-Specific Dashboard

### If Full Mode:

Read `.mavis/execution-log.jsonl` (if exists) and compute stats.

Display:
```
MAVIS Status Dashboard
=======================
Mode: Full | Phase: {phase}
Started: {startedAt} | Elapsed: {duration}

Phase Progress:
  [✓] Explore    — requirements spec complete
  [✓] Plan       — architecture validated
  [>] Execute    — wave 2/4, tasks 5/12 done
  [ ] Verify
  [ ] Fix

{If in Execute phase:}
Execution Stats:
  - Tasks completed: {N}/{total}
  - Current wave: {wave_number}
  - Agents active: {count}
  - Drift corrections: {count}
  - Context checkpoints: {count}

{If in Verify phase:}
Verification:
  - Requirements checked: {N}/{total}
  - PASS: {count} | PARTIAL: {count} | FAIL: {count}
  - Confidence: {HIGH|MEDIUM|LOW}

{If in Fix phase:}
Fix Loop:
  - Items to fix: {count}
  - Attempts used: {current}/{max}
  - Convergence: {converging|static|diverging}

Recent Events (last 5):
{formatted recent events from execution-log.jsonl}
```

### If Quick Mode:

Read `.mavis/quick-log.jsonl` (if exists).

Display:
```
MAVIS Status Dashboard
=======================
Mode: Quick | Phase: {phase}
Started: {startedAt}

{If currently executing:}
Current Task: {task description}
Agent: {agent name}
Status: In progress...

{If completed:}
Quick Mode History:
{last 5 entries from quick-log.jsonl:}
  - {timestamp}: {task} → {agent} → {PASS|FAIL}
```

### If Bug Mode:

Read `.mavis/bug-session.json` (if exists).

Display:
```
MAVIS Status Dashboard
=======================
Mode: Bug | Phase: {phase}
Started: {startedAt}

Protocol Progress:
  [{status}] REPRODUCE
  [{status}] HYPOTHESIZE
  [{status}] ISOLATE
  [{status}] FIX
  [{status}] VERIFY

{If root cause identified:}
Root Cause: {summary}
Category: {category}
Confidence: {confidence}

{If resolved:}
Resolution: {fix description}
Files Modified: {list}
```

## Step 4: Show Configuration

```
Configuration:
  - Max explore rounds: {config.maxExploreRounds}
  - Max fix attempts: {config.maxFixAttempts}
  - Max plan iterations: {config.maxPlanIterations}
  - Concurrency limit: {config.concurrencyLimit}
  - Budget limit: {config.budgetLimitTokens || "unlimited"}
```
