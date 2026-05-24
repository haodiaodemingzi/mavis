# MAVIS — Multi-Agent Verified Implementation System

A Claude Code plugin that orchestrates a team of specialized AI agents to autonomously develop, verify, and deliver production-ready code from natural language requirements.

## Three Execution Modes

```
/mavis "build X"          → Full Mode (complex features)
/mavis-quick "change Y"   → Quick Mode (simple changes)  
/mavis-bug "error Z"      → Bug Mode (scientific debugging)
```

The `/mavis` entry point auto-detects task complexity and recommends the appropriate mode.

## Architecture

```
┌─────────── PLANNING LAYER ────────────┐
│ mavis-pm     (Socratic explorer)      │
│ mavis-gap    (Gap analyzer)           │
│ mavis-critic (Ruthless reviewer)      │
├─────────── ORCHESTRATION LAYER ───────┤
│ mavis-lead   (Workflow orchestrator)  │
│ mavis-atlas  (Task distributor)       │
├─────────── EXECUTION LAYER ───────────┤
│ mavis-arch   mavis-fe   mavis-be     │
│ mavis-ui     mavis-test  mavis-qa    │
├─────────── STANDALONE ────────────────┤
│ mavis-debug  (Scientific debugger)    │
└───────────────────────────────────────┘
```

## Full Mode Pipeline

```
Explore → Plan → Execute → Verify → Done
  │         │        │         │
  │         │        │         └─ Codex 3D verification
  │         │        └─ Agent Team parallel execution
  │         └─ Validation triad (arch→gap→critic)
  └─ Socratic questioning + knowledge graph
```

## Key Features

- **Superpowers-style questioning**: One question per message, HARD-GATE before code
- **oh-my-opencode orchestration**: Three-layer architecture, anti-loop guards, Ralph Loop auto-continuation
- **Claude Code Agent Teams**: Shared task list, worktree isolation, P2P messaging
- **Four-layer drift defense**: Requirement anchoring → Wave micro-verification → Context hardening → Codex final check
- **Zero tolerance completion**: All tasks must be [x] before declaring done

## Installation

See [INSTALL.md](./INSTALL.md) for setup instructions.

## Prerequisites

- Claude Code v2.1.32+
- Node.js 20+
- Git (for worktree isolation)
- `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1` environment variable

## Project Structure

```
mavis-plugin/
├── plugin.json          # Plugin manifest
├── agents/              # 12 agent definitions (AGENT.md)
│   ├── planning/        # mavis-pm, mavis-gap, mavis-critic
│   ├── orchestration/   # mavis-lead, mavis-atlas
│   ├── execution/       # mavis-arch/fe/be/ui/test/qa
│   └── standalone/      # mavis-debug
├── skills/              # 9 workflow skills
├── commands/            # 3 CLI entry points
├── hooks/               # Quality gate scripts
└── lib/                 # Core TypeScript library
    ├── knowledge-graph.ts
    ├── coverage-scorer.ts
    ├── self-review.ts
    ├── requirement-anchor.ts
    ├── convergence-monitor.ts
    └── state.ts
```

## State Directory

MAVIS persists session state in `.mavis/` within your project:

```
.mavis/
├── session.json            # Current phase + config
├── knowledge-graph.json    # Requirements graph
├── requirements-spec.md    # Generated spec
├── architecture.md         # System design
├── api-contract.yaml       # Frontend/backend contract
├── task-plan.md            # Execution plan
├── execution-log.jsonl     # Audit trail
├── verification-report.md  # Codex results
├── fix-tracker.json        # Fix attempt counts
└── context/                # Context hardening snapshots
```

## Inspired By

| Project | Contribution |
|---------|-------------|
| [Superpowers](https://github.com/obra/superpowers) | Questioning discipline, HARD-GATE |
| [oh-my-opencode](https://github.com/code-yeongyu/oh-my-openagent) | Three-layer architecture, anti-loop guards |
| Claude Code Agent Teams | Native parallel execution runtime |
| OpenSpec | Spec-driven development, WHEN/THEN contracts |

## License

MIT
