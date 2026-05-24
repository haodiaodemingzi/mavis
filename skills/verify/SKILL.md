---
name: verify
description: "Full Mode Phase 4 — Three-dimensional verification with optional Codex"
---

# MAVIS Verify Phase (Full Mode Phase 4)

Verify the implementation against requirements across three dimensions: completeness, correctness, coherence.

## Step 1: Confirm Phase Entry

Run: `npx tsx ${CLAUDE_PLUGIN_ROOT}/lib/state.ts get`

Verify phase is "verifying". If not:
```bash
npx tsx ${CLAUDE_PLUGIN_ROOT}/lib/state.ts transition verifying
```

Display:
```
MAVIS Full Mode — Phase 4: Verification
=========================================
Three-dimensional check: Completeness × Correctness × Coherence
```

## Step 2: Generate Verification Checklist

Read `.mavis/requirements-spec.md` and generate a checklist:

For each requirement, create verification items:
```markdown
## Verification Checklist

### REQ: {requirement-id} — {title}
- [ ] COMPLETENESS: All acceptance criteria are implemented
- [ ] CORRECTNESS: Implementation matches the specified behavior
- [ ] COHERENCE: Integrates properly with other components

Evidence needed: {what to check — specific files, test output, behavior}
```

Save to `.mavis/verification-checklist.md`.

## Step 3: Check for Codex CLI

```bash
which codex 2>/dev/null && echo "CODEX_AVAILABLE" || echo "CODEX_UNAVAILABLE"
```

## Step 4a: Codex Verification (if available)

If Codex is available:

```bash
codex --quiet "Review the codebase changes for this project. Here is the verification checklist:

$(cat .mavis/verification-checklist.md)

For each item, determine:
- PASS: Requirement is fully satisfied with evidence
- FAIL: Requirement is not satisfied, explain what's missing
- PARTIAL: Partially satisfied, explain what's done and what remains

Also check:
- Are there any regressions? (existing functionality broken)
- Are there security issues? (injection, auth bypass, data exposure)
- Are there performance concerns? (O(n^2), memory leaks, missing indexes)

Output structured results."
```

Parse Codex output into results.

## Step 4b: Agent Verification (fallback if no Codex)

If Codex is unavailable, spawn `mavis-qa` as a teammate:

```
VERIFICATION TASK

Read the verification checklist at .mavis/verification-checklist.md

For each requirement, verify:

1. COMPLETENESS — Does the implementation cover all specified behaviors?
   - Check that every acceptance criterion has corresponding code
   - Run tests if available: npm test
   - Check for TODO/FIXME/HACK comments that indicate incomplete work

2. CORRECTNESS — Does it work correctly?
   - Trace the happy path through the code
   - Check edge cases mentioned in the spec
   - Run: npm run build (or equivalent)
   - Run: npm run lint (if available)
   - Look for obvious logic errors

3. COHERENCE — Does it fit together?
   - Check that components communicate as specified in architecture.md
   - Verify API contracts match between caller and callee
   - Check that shared types/interfaces are consistent
   - Verify no circular dependencies introduced

For each requirement, report: PASS / FAIL / PARTIAL with evidence.
```

## Step 5: Compile Results

Create `.mavis/verification-report.md`:

```markdown
# Verification Report

Generated: {timestamp}
Method: {Codex | Agent Review}

## Summary
- Total requirements: {N}
- PASS: {count} ({percentage}%)
- PARTIAL: {count}
- FAIL: {count}

## Overall Confidence: {HIGH | MEDIUM | LOW}

## Details

### {requirement-id}: {PASS|PARTIAL|FAIL}
**Completeness:** {status} — {evidence}
**Correctness:** {status} — {evidence}
**Coherence:** {status} — {evidence}
{If FAIL: **Fix needed:** {description of what's wrong}}

---
{repeat for each requirement}

## Build Status
{output of npm run build}

## Test Status
{output of npm test}

## Additional Findings
- Regressions: {any found}
- Security: {any concerns}
- Performance: {any concerns}
```

## Step 6: Confidence Scoring

Assign overall confidence:
- **HIGH**: All requirements PASS, build passes, tests pass
- **MEDIUM**: All PASS but some checks couldn't be run (no tests, no lint), OR all PASS but with caveats
- **LOW**: Any PARTIAL or FAIL results

## Step 7: Decision

If ALL requirements are PASS and confidence is HIGH or MEDIUM:
```bash
npx tsx ${CLAUDE_PLUGIN_ROOT}/lib/state.ts transition done
```
Signal: proceed to done phase (back in mavis.md orchestrator).

If ANY requirements are FAIL or PARTIAL:
```bash
npx tsx ${CLAUDE_PLUGIN_ROOT}/lib/state.ts transition fixing
```
Signal: proceed to fix phase.

Display result:
```
Verification Result: {PASS / NEEDS FIXES}
==========================================
{summary stats}
{if needs fixes: list of failing requirements}
```
