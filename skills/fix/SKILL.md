---
name: fix
description: "Full Mode Phase 5 — Targeted fix loop with convergence monitoring"
---

# MAVIS Fix Phase (Full Mode Phase 5)

Targeted fixes for verification failures with convergence monitoring.

## Step 1: Confirm Phase Entry

Run: `npx tsx ${CLAUDE_PLUGIN_ROOT}/lib/state.ts get`

Verify phase is "fixing". If not:
```bash
npx tsx ${CLAUDE_PLUGIN_ROOT}/lib/state.ts transition fixing
```

Display:
```
MAVIS Full Mode — Phase 5: Fix Loop
=====================================
Targeted fixes for failed requirements. Max 3 attempts per item.
```

## Step 2: Read Failure Report

Read `.mavis/verification-report.md` and extract all FAIL and PARTIAL items.

For each failure, gather:
- Requirement ID and description
- What's wrong (from verification evidence)
- Affected files (from the task plan traceability matrix)
- Which agent role originally owned this task

## Step 3: Route Fixes to Responsible Agents

For each failure, determine the responsible agent:

| Failure Domain | Agent |
|---|---|
| Frontend code, UI, components, styling | mavis-fe |
| Backend code, API, database, middleware | mavis-be |
| Test failures, missing tests | mavis-test |
| Architecture, integration, config | mavis-arch |
| UI/UX issues | mavis-ui |

## Step 4: Create Fix Tasks

For each failure, spawn the responsible agent as a teammate:

```
FIX TASK for {requirement-id}

REQUIREMENT (verbatim from spec):
"{requirement text}"

WHAT'S WRONG:
{verification failure evidence}

AFFECTED FILES:
{file list}

INSTRUCTIONS:
1. Read the current state of the affected files
2. Identify exactly what's missing or incorrect
3. Apply the minimal fix to satisfy the requirement
4. Do NOT change unrelated code
5. Ensure the fix doesn't break other requirements

VERIFICATION: After fixing, run:
- npm run build (must pass)
- npm test (related tests must pass)

Report back with: what you changed, why, and verification results.
```

## Step 5: Track Convergence

Maintain an internal fix attempt tracker:

```
{requirement-id}: attempt {N}/3 — {status}
```

After each fix attempt, evaluate:
- **Converging**: The fix moved closer to passing (e.g., went from FAIL to PARTIAL, or fixed the primary issue)
- **Static**: No improvement — same failure
- **Diverging**: Fix introduced new problems or made things worse
- **Oscillating**: Fix A breaks B, fixing B breaks A

## Step 6: Re-Verify Affected Requirements Only

After fixes are applied, do a targeted re-verification (NOT full verification):

Spawn `mavis-qa` as a teammate:
```
TARGETED RE-VERIFICATION

Only verify these specific requirements that were just fixed:
{list of fixed requirement IDs with their criteria}

Check:
1. Does the fix satisfy the requirement?
2. Did the fix break anything else? (run full build + tests)
3. Is the fix clean? (no hacks, no TODO placeholders)

For each: PASS or STILL_FAILING with details.
```

## Step 7: Convergence Decision

After re-verification:

**If all fixed requirements now PASS:**
```bash
npx tsx ${CLAUDE_PLUGIN_ROOT}/lib/state.ts transition verifying
```
Signal: return to verify phase for full re-verification.

**If some still failing AND attempts < 3:**
- Increment attempt counter
- Analyze what went wrong with the fix
- Create a new fix task with additional context (what was tried, why it didn't work)
- Go back to Step 4

**If attempts >= 3 for any requirement:**
Go to Step 8 (escalation).

**If diverging or oscillating detected:**
Go to Step 8 immediately (don't waste more attempts).

## Step 8: Human Escalation

Via AskUserQuestion:

```
Fix Loop Status — Escalation Needed
=====================================

These requirements could not be fixed automatically after {N} attempts:

{for each stuck requirement:}
- {requirement-id}: {what's wrong}
  - Attempt 1: {what was tried, result}
  - Attempt 2: {what was tried, result}
  - Attempt 3: {what was tried, result}
  - Pattern: {converging|static|diverging|oscillating}

What would you like to do?
```

Options:
- "Let me fix these manually — mark as done with caveats"
- "Try a different approach — here's my suggestion: ..."
- "Skip these requirements — accept partial completion"
- "Go back to planning — the architecture may need rework"

Handle each choice:
- Manual: transition to done with notes about unresolved items
- Different approach: feed user's suggestion to agents, retry once more
- Skip: transition to done, document skipped requirements
- Replan: transition back to planning phase
