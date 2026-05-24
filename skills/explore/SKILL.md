---
name: explore
description: "Full Mode Phase 1 — Socratic exploration with knowledge graph building"
---

# MAVIS Explore Phase (Full Mode Phase 1)

Socratic exploration to fully understand the requirement before any code is written.

## HARD-GATE DECLARATION

**NO CODE WILL BE WRITTEN IN THIS PHASE.**
This phase produces ONLY a requirements specification document.
Code generation begins in the Execute phase, AFTER planning and user approval.
Violating this gate is a protocol error.

## Step 1: Initialize

Run: `npx tsx ${CLAUDE_PLUGIN_ROOT}/lib/state.ts transition exploring`

Display:
```
MAVIS Full Mode — Phase 1: Exploration
=======================================
Building understanding through targeted questions.
No code until spec is approved (Hard Gate).
```

## Step 2: Seed the Knowledge Graph

From the user's initial requirement, extract obvious elements:

For each identifiable requirement, run:
```bash
npx tsx ${CLAUDE_PLUGIN_ROOT}/lib/knowledge-graph.ts add-node Requirement "{id}" "{description}"
```

Use kebab-case IDs like `user-auth`, `data-export`, `error-handling`.

## Step 3: Exploration Loop (max 12 rounds)

For each round:

### 3a. Check Coverage

Run: `npx tsx ${CLAUDE_PLUGIN_ROOT}/lib/knowledge-graph.ts coverage`

Parse the result. If coverage >= 80% AND at least 3 requirements have scenarios: go to Step 4.

### 3b. Identify Knowledge Gaps

Run: `npx tsx ${CLAUDE_PLUGIN_ROOT}/lib/knowledge-graph.ts gaps`

This returns requirements that lack scenarios (WHEN/THEN).

### 3c. Generate Next Question

Based on gaps and the current graph state, generate ONE focused question per round.

Question strategy priority:
1. **Scope boundaries**: "What should NOT be included?"
2. **User flows**: "Walk me through what happens when a user does X"
3. **Edge cases**: "What happens if Y is empty/null/huge/concurrent?"
4. **Constraints**: "Are there performance/security/compatibility requirements?"
5. **Dependencies**: "Does this interact with any existing system?"
6. **Priority**: "If we must cut scope, which parts are essential vs nice-to-have?"

Present via AskUserQuestion with multiple-choice options when possible:
```
Question {N}/12 (Coverage: {coverage}%):

{question text}
```

Provide 3-5 options plus an "Other (I'll explain)" option.

### 3d. Process Answer

From the user's answer, extract new knowledge:
- Add new nodes (Requirements, Constraints, Scenarios) to the graph
- Add edges linking them to existing nodes
- Update descriptions if the answer refines understanding

```bash
npx tsx ${CLAUDE_PLUGIN_ROOT}/lib/knowledge-graph.ts add-node {type} "{id}" "{description}"
npx tsx ${CLAUDE_PLUGIN_ROOT}/lib/knowledge-graph.ts add-edge {edge_type} "{from_id}" "{to_id}"
```

### 3e. Loop

Return to 3a. If round count reaches 12, proceed to Step 4 regardless.

## Step 4: Generate Requirements Spec

Run: `npx tsx ${CLAUDE_PLUGIN_ROOT}/lib/knowledge-graph.ts export-spec`

Save the output to `.mavis/requirements-spec.md`.

Additionally, append a "Summary" section at the top with:
- Total requirements count
- Coverage percentage
- Key constraints
- Open questions (gaps remaining)

## Step 5: Self-Review

Review the generated spec yourself for:
- Internal contradictions (requirement A conflicts with requirement B)
- Missing acceptance criteria (requirements without clear WHEN/THEN)
- Scope creep (requirements that weren't in the original input)
- Feasibility concerns (requirements that may be technically impossible)

If issues found: fix them in the spec and note the corrections.

## Step 6: Present Spec for Approval (HARD-GATE)

Present the complete spec to the user via AskUserQuestion:

```
Requirements Spec Complete (Coverage: {coverage}%)
===================================================

{spec content — abbreviated if very long, full file path reference}

Saved to: .mavis/requirements-spec.md
```

Options: ["Approve — proceed to planning", "Needs changes — let me edit", "Add more requirements", "Start over"]

- If "Approve": run `npx tsx ${CLAUDE_PLUGIN_ROOT}/lib/state.ts transition planning` and signal completion
- If "Needs changes": ask what to change, update spec, re-present
- If "Add more": re-enter exploration loop with additional context
- If "Start over": reset knowledge graph and restart from Step 2
