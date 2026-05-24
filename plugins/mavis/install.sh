#!/bin/bash
set -euo pipefail

# MAVIS Plugin Installer
# Usage: ./install.sh

BOLD="\033[1m"
GREEN="\033[32m"
YELLOW="\033[33m"
RED="\033[31m"
RESET="\033[0m"

PLUGIN_NAME="mavis-plugin"
PLUGIN_ID="mavis@local"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CLAUDE_DIR="${HOME}/.claude"
CLAUDE_PLUGINS_DIR="${CLAUDE_DIR}/plugins"
TARGET="${CLAUDE_PLUGINS_DIR}/${PLUGIN_NAME}"
INSTALLED_JSON="${CLAUDE_PLUGINS_DIR}/installed_plugins.json"

echo -e "${BOLD}🚀 MAVIS Plugin Installer${RESET}"
echo ""

# 1. Check prerequisites
echo -e "${BOLD}[1/6] Checking prerequisites...${RESET}"

if ! command -v node &>/dev/null; then
  echo -e "${RED}✗ Node.js not found. Install Node.js 20+ first.${RESET}"
  exit 1
fi

NODE_VERSION=$(node -v | sed 's/v//' | cut -d. -f1)
if [ "$NODE_VERSION" -lt 20 ]; then
  echo -e "${RED}✗ Node.js ${NODE_VERSION} detected. Need 20+.${RESET}"
  exit 1
fi
echo -e "  ${GREEN}✓${RESET} Node.js $(node -v)"

if ! command -v git &>/dev/null; then
  echo -e "${YELLOW}⚠ Git not found. Worktree isolation won't work.${RESET}"
else
  echo -e "  ${GREEN}✓${RESET} Git $(git --version | cut -d' ' -f3)"
fi

if command -v codex &>/dev/null; then
  echo -e "  ${GREEN}✓${RESET} Codex CLI available"
else
  echo -e "  ${YELLOW}⚠${RESET} Codex CLI not found (optional, for final verification)"
fi

# 2. Install lib dependencies
echo ""
echo -e "${BOLD}[2/6] Installing library dependencies...${RESET}"
cd "${SCRIPT_DIR}/lib"
npm install --silent 2>/dev/null
echo -e "  ${GREEN}✓${RESET} Dependencies installed"

# 3. Type check
echo ""
echo -e "${BOLD}[3/6] Verifying TypeScript...${RESET}"
if npx tsc --noEmit 2>/dev/null; then
  echo -e "  ${GREEN}✓${RESET} TypeScript compiles without errors"
else
  echo -e "${RED}✗ TypeScript errors detected. Check lib/ files.${RESET}"
  exit 1
fi

# 4. Create plugin symlink
echo ""
echo -e "${BOLD}[4/6] Installing plugin...${RESET}"
mkdir -p "${CLAUDE_PLUGINS_DIR}"

if [ -L "$TARGET" ]; then
  rm "$TARGET"
  echo -e "  ${YELLOW}↻${RESET} Removed existing symlink"
elif [ -d "$TARGET" ]; then
  echo -e "${RED}✗ ${TARGET} exists as a directory. Remove it manually first.${RESET}"
  exit 1
fi

ln -s "${SCRIPT_DIR}" "${TARGET}"
echo -e "  ${GREEN}✓${RESET} Symlinked to ${TARGET}"

# 5. Register in installed_plugins.json
echo ""
echo -e "${BOLD}[5/6] Registering plugin...${RESET}"

if [ ! -f "$INSTALLED_JSON" ]; then
  echo '{"version":2,"plugins":{}}' > "$INSTALLED_JSON"
fi

TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%S.000Z")

python3 -c "
import json, sys
with open('${INSTALLED_JSON}', 'r') as f:
    data = json.load(f)
data['plugins']['${PLUGIN_ID}'] = [{
    'scope': 'user',
    'installPath': '${TARGET}',
    'version': '0.1.0',
    'installedAt': '${TIMESTAMP}',
    'lastUpdated': '${TIMESTAMP}'
}]
with open('${INSTALLED_JSON}', 'w') as f:
    json.dump(data, f, indent=2)
"
echo -e "  ${GREEN}✓${RESET} Registered as ${PLUGIN_ID}"

# 6. Configure environment
echo ""
echo -e "${BOLD}[6/6] Configuring environment...${RESET}"

SETTINGS_FILE="${CLAUDE_DIR}/settings.json"
if [ -f "$SETTINGS_FILE" ]; then
  if grep -q "CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS" "$SETTINGS_FILE"; then
    echo -e "  ${GREEN}✓${RESET} Agent Teams already enabled"
  else
    echo -e "  ${YELLOW}⚠${RESET} Add to ${SETTINGS_FILE}:"
    echo -e "    ${BOLD}\"env\": { \"CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS\": \"1\" }${RESET}"
  fi
else
  mkdir -p "${CLAUDE_DIR}"
  cat > "$SETTINGS_FILE" << 'EOF'
{
  "env": {
    "CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS": "1"
  }
}
EOF
  echo -e "  ${GREEN}✓${RESET} Created settings.json with Agent Teams enabled"
fi

# Done
echo ""
echo -e "${BOLD}${GREEN}══════════════════════════════════════════${RESET}"
echo -e "${BOLD}${GREEN}  MAVIS installed successfully! ✨${RESET}"
echo -e "${BOLD}${GREEN}══════════════════════════════════════════${RESET}"
echo ""
echo -e "  Restart Claude Code, then use:"
echo ""
echo -e "    ${BOLD}/mavis:start${RESET} \"build a todo app\"   (Smart Router)"
echo -e "    ${BOLD}/mavis:quick${RESET} \"change color\"       (Quick Mode)"
echo -e "    ${BOLD}/mavis:bug${RESET} \"login returns 500\"    (Bug Mode)"
echo -e "    ${BOLD}/mavis:status${RESET}                      (Dashboard)"
echo ""
