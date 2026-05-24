---
name: bug
description: "Bug Mode — scientific debugging protocol with phase tracking"
---

# MAVIS Bug Mode

Scientific debugging protocol: reproduce, hypothesize, isolate, fix, verify.

## Step 1: Initialize Session

Run: `npx tsx ${CLAUDE_PLUGIN_ROOT}/lib/state.ts init bug`

Display the protocol tracker:

```
MAVIS Bug Protocol
==================
[>REPRODUCE] → [HYPOTHESIZE] → [ISOLATE] → [FIX] → [VERIFY]
```

## Step 2: Spawn Debug Agent

Spawn the `mavis-debug` agent as a teammate with the following prompt:

```
BUG REPORT:
{user's bug description}

Follow the scientific debugging protocol strictly:

PHASE 1 - REPRODUCE:
- Find or create a minimal reproduction
- Document exact steps, inputs, expected vs actual output
- If cannot reproduce, report that immediately

PHASE 2 - HYPOTHESIZE:
- Based on reproduction, list 2-5 possible root causes ranked by likelihood
- For each hypothesis, identify what evidence would confirm/refute it

PHASE 3 - ISOLATE:
- Test hypotheses systematically starting from most likely
- Use binary search on the codebase (narrow to file → function → line)
- Document which hypotheses were eliminated and why
- Identify the single root cause with evidence

Report back after ISOLATE with:
- Root cause (file, line, explanation)
- Category: [logic error | race condition | missing validation | wrong assumption | config issue | dependency bug | design flaw]
- Confidence: [HIGH | MEDIUM | LOW]
- Proposed fix approach
```

## Step 3: Update Tracker at Each Phase

As the debug agent reports progress, update the display:

```
[REPRODUCE ✓] → [>HYPOTHESIZE] → [ISOLATE] → [FIX] → [VERIFY]
```

## Step 4: Root Cause Confirmation Gate

After the debug agent reports its findings from ISOLATE, present to user via AskUserQuestion:

```
Root Cause Identified:
- File: {file}
- Line: {line}
- Cause: {explanation}
- Category: {category}
- Confidence: {confidence}

Proposed fix: {approach}
```

Options: ["Approve fix — proceed", "I disagree — let me explain", "Need more investigation"]

- If "Approve": proceed to Step 5
- If "Disagree": ask user for their insight, feed it back to debug agent for re-analysis
- If "Need more": ask debug agent to dig deeper with specific direction from user

## Step 5: Fix Phase

Update tracker:
```
[REPRODUCE ✓] → [HYPOTHESIZE ✓] → [ISOLATE ✓] → [>FIX] → [VERIFY]
```

Instruct the debug agent to apply the fix:
- Make the minimal change to fix the root cause
- Do NOT refactor unrelated code
- Add inline comment explaining why this fix is correct

## Step 6: Verify Phase

Update tracker:
```
[REPRODUCE ✓] → [HYPOTHESIZE ✓] → [ISOLATE ✓] → [FIX ✓] → [>VERIFY]
```

Run verification:

```bash
# Run the reproduction case again — should now pass
# Run related tests
npm test 2>&1 || echo "NO_TESTS"

# Lint check
npm run lint 2>&1 || echo "NO_LINT"

# Typecheck
npm run typecheck 2>&1 || npx tsc --noEmit 2>&1 || echo "NO_TYPECHECK"
```

## Step 7: Report & Offer Regression Test

Display final result:
```
[REPRODUCE ✓] → [HYPOTHESIZE ✓] → [ISOLATE ✓] → [FIX ✓] → [VERIFY ✓]

Bug Fixed!
- Root Cause: {summary}
- Fix: {what was changed}
- Files Modified: {list}
- Tests: {PASS/FAIL}
```

Ask via AskUserQuestion:
"Want me to generate a regression test to prevent this bug from recurring?"
Options: ["Yes, generate regression test", "No, the fix is sufficient"]

If yes: spawn `mavis-test` agent to write a test that would have caught this bug.

## Step 8: Save State & Detect Design Flaws

Save investigation to `.mavis/bug-session.json`:
```json
{
  "bug": "{original description}",
  "rootCause": "{cause}",
  "category": "{category}",
  "fix": "{description}",
  "filesModified": [...],
  "hypothesesTested": [...],
  "resolvedAt": "{timestamp}"
}
```

If the root cause category is "design flaw" or if the fix feels like a band-aid (agent says so, or it's a workaround):

Ask via AskUserQuestion:
"This looks like a design-level issue rather than a simple bug. Want to escalate to Full Mode for a proper architectural fix?"
Options: ["Escalate to Full Mode", "Keep the targeted fix"]

If escalate: invoke the `mavis` skill with a re-framed requirement describing the design issue.
