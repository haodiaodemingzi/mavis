---
name: plan
description: "Full Mode Phase 2 — Architecture planning with validation triad"
---

# MAVIS Plan Phase (Full Mode Phase 2)

Generate architecture plan and validate it through a triad of critics before execution.

## Step 1: Confirm Phase Entry

Run: `npx tsx ${CLAUDE_PLUGIN_ROOT}/lib/state.ts get`

Verify phase is "planning". If not, run:
```bash
npx tsx ${CLAUDE_PLUGIN_ROOT}/lib/state.ts transition planning
```

Display:
```
MAVIS Full Mode — Phase 2: Planning
=====================================
Architecture → Gap Analysis → Critic Review → User Approval
```

## Step 2: Architecture Generation

Spawn the `mavis-arch` agent as a teammate with this prompt:

```
Read the requirements spec at .mavis/requirements-spec.md

Produce three artifacts:

1. .mavis/architecture.md — System architecture document including:
   - Component diagram (ASCII)
   - Data flow between components
   - Technology choices with rationale
   - File/directory structure plan
   - API boundaries

2. .mavis/api-contract.yaml — OpenAPI-style contract for any APIs (or interface definitions if not an API project):
   - Endpoints/functions with input/output types
   - Error responses
   - Authentication requirements

3. .mavis/task-plan.md — Ordered task list with:
   - Each task has: ID, title, description, assigned agent role, estimated complexity (S/M/L), dependencies (list of task IDs), files to create/modify
   - Tasks are grouped into waves (tasks in same wave can execute in parallel)
   - Wave ordering respects dependencies
   - Format each task as: `- [ ] TASK-{N}: {title} [agent:{role}] [size:{S|M|L}] [deps:{IDs}]`

Ensure every requirement from the spec maps to at least one task.
Add a traceability matrix at the end: requirement-id → task-ids.
```

Wait for the agent to complete and produce all three files.

## Step 3: Gap Analysis

Spawn the `mavis-gap` agent as a teammate:

```
Review these artifacts for gaps:
- .mavis/requirements-spec.md (requirements)
- .mavis/architecture.md (architecture)
- .mavis/task-plan.md (task plan)

Check for:
1. COVERAGE GAPS: Requirements without corresponding tasks
2. DEPENDENCY GAPS: Tasks referencing non-existent dependencies
3. INTERFACE GAPS: Components that communicate without defined contracts
4. ERROR HANDLING GAPS: Failure modes not addressed
5. TESTING GAPS: No test tasks for critical paths

Produce: .mavis/gap-analysis.md with findings categorized as CRITICAL / WARNING / INFO
```

## Step 4: Critic Review

Spawn the `mavis-critic` agent as a teammate:

```
You are a ruthless technical reviewer. Your job is to find flaws.

Review:
- .mavis/architecture.md
- .mavis/task-plan.md
- .mavis/gap-analysis.md

Evaluate on these axes:
1. FEASIBILITY: Can this actually be built as specified?
2. COHERENCE: Do all parts fit together without contradictions?
3. COMPLETENESS: Are there missing pieces that will block execution?
4. RISK: What could go wrong? What's the biggest risk?
5. OVER-ENGINEERING: Is anything unnecessarily complex?

Final verdict: PASS or FAIL

If FAIL: list specific items that MUST be fixed before proceeding.
Produce: .mavis/critic-review.md
```

## Step 5: Iteration Loop (max 3 rounds)

Read `.mavis/critic-review.md`.

If verdict is **FAIL**:
1. Feed the critic's feedback + gap analysis back to `mavis-arch`:
   ```
   Your plan received a FAIL from the critic. Fix these issues:
   {critic feedback items}
   
   Also address these gaps:
   {gap analysis CRITICAL items}
   
   Update architecture.md, api-contract.yaml, and task-plan.md.
   ```
2. After update: re-run Step 3 (gap analysis) and Step 4 (critic review)
3. Track iteration count. After 3 FAILs, escalate to user:
   - "The plan has failed critic review 3 times. Remaining issues: {list}. Shall I proceed anyway or would you like to adjust requirements?"

If verdict is **PASS**: proceed to Step 6.

## Step 6: Present Plan for User Approval

Via AskUserQuestion:

```
Plan Ready (Critic: PASS)
==========================

Architecture: .mavis/architecture.md
Tasks: {N} tasks in {M} waves
Estimated agents: {list of roles needed}
Key decisions:
- {decision 1}
- {decision 2}
- {decision 3}

Shall I proceed with execution?
```

Options: ["Approve — start execution", "I want to review the full plan first", "Needs changes", "Reject — go back to exploration"]

- If "Approve": run `npx tsx ${CLAUDE_PLUGIN_ROOT}/lib/state.ts transition executing` and signal completion
- If "Review": display full task-plan.md content, then re-ask
- If "Needs changes": ask what to change, update artifacts, re-run critic
- If "Reject": run `npx tsx ${CLAUDE_PLUGIN_ROOT}/lib/state.ts transition exploring` and signal to re-enter explore phase
