# MAVIS Plugin Installation

## Prerequisites

- Claude Code v2.1.32+
- Node.js 20+
- Git (required for worktree isolation)
- Codex CLI (optional, for final verification)

## Install

```bash
# Clone or download the plugin
git clone <repo-url> ~/.claude/plugins/mavis-plugin

# Or symlink from local dev
ln -s /path/to/mavis-plugin ~/.claude/plugins/mavis-plugin

# Install lib dependencies
cd ~/.claude/plugins/mavis-plugin/lib && npm install
```

## Required Environment Variable

Agent Teams must be enabled for Full Mode execution:

```bash
# Add to your shell profile or Claude Code settings.json
export CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1
```

Or in `~/.claude/settings.json`:
```json
{
  "env": {
    "CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS": "1"
  }
}
```

## Worktree Support

If your project uses `.env` or other gitignored files that agents need, create a `.worktreeinclude` in your repo root:

```
.env
.env.local
```

This ensures worktree-isolated agents can access these files.

## Usage

```bash
# Smart router (recommends mode)
/mavis "build a user authentication system"

# Direct mode invocation
/mavis-quick "change button color to blue"
/mavis-bug "clicking login returns 500 error"

# Check progress
/mavis-status
```

## Verify Installation

After installing, run `/mavis-status` in any project. If the plugin is loaded correctly, it will display "No active MAVIS session."
