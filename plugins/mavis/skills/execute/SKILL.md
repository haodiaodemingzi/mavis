---
name: execute
description: "Full Mode Phase 3 — Agent team execution with wave-based parallelism"
---

# MAVIS Execute Phase (Full Mode Phase 3)

Orchestrate the agent team to execute the task plan with wave-based parallelism.

## Step 1: Confirm Phase Entry

Run: `npx tsx ${CLAUDE_PLUGIN_ROOT}/lib/state.ts get`

Verify phase is "executing". If not:
```bash
npx tsx ${CLAUDE_PLUGIN_ROOT}/lib/state.ts transition executing
```

Display:
```
MAVIS Full Mode — Phase 3: Execution
======================================
Wave-based parallel execution with micro-verification.
```

## Step 2: Parse Task Plan

Read `.mavis/task-plan.md` and extract:
- All tasks with their IDs, descriptions, agent assignments, dependencies
- Wave groupings (tasks with all dependencies satisfied run in the same wave)

Build an internal tracking structure:
```
Wave 1: [TASK-1, TASK-2, TASK-3] — no dependencies
Wave 2: [TASK-4, TASK-5] — depends on Wave 1
Wave 3: [TASK-6] — depends on TASK-4 and TASK-5
...
```

## Step 3: Read Requirement Anchors

Read `.mavis/requirements-spec.md` to have the verbatim requirement text available.
For each task, identify which requirement(s) it satisfies (from the traceability matrix in task-plan.md).

## Step 4: Execute Waves

For each wave (in order):

### 4a. Create Tasks for Wave

For each task in the current wave, prepare a prompt for its assigned agent:

```
TASK: {task_id} — {task_title}

REQUIREMENT ANCHOR (verbatim from spec — this is what we're satisfying):
"{requirement text}"

DESCRIPTION:
{task description}

FILES TO CREATE/MODIFY:
{file list from task plan}

DEPENDENCIES COMPLETED:
{list of predecessor tasks and their outcomes}

CONSTRAINTS:
- Follow existing code style in the project
- Do not modify files outside your scope unless absolutely necessary
- Report back with: files modified, key decisions made, any blockers

DEFINITION OF DONE:
- The code compiles/builds without errors
- The specific requirement this task addresses is functionally complete
- No TODO placeholders — real implementations only
```

### 4b. Spawn Agents

Create an Agent Team with teammates for the current wave.

Map agent roles to agent names:
- `arch` → `mavis-arch`
- `fe` / `frontend` → `mavis-fe`
- `be` / `backend` → `mavis-be`
- `ui` → `mavis-ui`
- `test` → `mavis-test`

Spawn all tasks in the wave as parallel teammates.

Log each dispatch:
```bash
npx tsx ${CLAUDE_PLUGIN_ROOT}/lib/state.ts transition executing  # ensure still in executing
```

### 4c. Wait for Wave Completion

Wait for all teammates in the wave to complete their tasks.

For each completed task, log the event:
- Record: task ID, agent, files modified, duration, success/failure

### 4d. Context Hardening (every 3rd task)

After every 3rd completed task (cumulative across waves), write a context summary:

Create a summary of completed work so far:
```
# Context Checkpoint — Wave {N}, Task {M} completed

## Completed Tasks:
{list of done tasks with brief outcomes}

## Current State:
- Files created: {list}
- Key decisions made: {list}
- Remaining tasks: {count}

## Important Context for Remaining Work:
{any cross-task decisions or patterns established}
```

Save to `.mavis/context/wave-{N}-checkpoint.md`

### 4e. Wave Micro-Verification

After each wave completes, spawn `mavis-qa` as a teammate:

```
MICRO-VERIFICATION for Wave {N}

Tasks just completed:
{list of tasks in this wave with descriptions}

Check:
1. Do the outputs of these tasks integrate correctly?
2. Are there any obvious conflicts between tasks that ran in parallel?
3. Run: npm run build (or equivalent) — does it pass?
4. Are there any drift indicators (implementation doesn't match plan)?

Report: PASS, WARN (minor issues), or DRIFT_DETECTED (significant deviation from plan)
```

### 4f. Handle Drift

If micro-verification reports DRIFT_DETECTED:
1. Log drift event
2. Identify the drifting task and what's wrong
3. Create a fix task for the responsible agent
4. Execute the fix before proceeding to next wave
5. Re-run micro-verification for the affected area

## Step 5: Ralph Loop (Auto-Continue)

After all planned waves complete, check: are ALL tasks marked as done?

- If yes: proceed to Step 6
- If any are incomplete or blocked:
  - Identify blockers
  - If blocker is a missing dependency: create and execute the missing task
  - If blocker is unclear requirements: escalate to user via AskUserQuestion
  - Continue until all tasks are done or user says stop

## Step 6: Completion

ZERO TOLERANCE CHECK: Read task-plan.md. Every `- [ ]` must now be `- [x]`.
If any remain unchecked: do NOT proceed. Go back and complete them.

When all tasks are done:
```bash
npx tsx ${CLAUDE_PLUGIN_ROOT}/lib/state.ts transition verifying
```

Display:
```
Execution Complete
==================
- Tasks completed: {N}/{N}
- Waves executed: {M}
- Drift corrections: {count}
- Total agents spawned: {count}

Proceeding to verification...
```

Signal completion to trigger the verify phase.
