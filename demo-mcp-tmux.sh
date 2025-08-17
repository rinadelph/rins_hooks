#!/bin/bash

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
MAGENTA='\033[0;35m'
CYAN='\033[0;36m'
WHITE='\033[1;37m'
NC='\033[0m' # No Color

echo -e "${CYAN}╔══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║     ${WHITE}Rapala Generic MCP Management System - Live Demo${CYAN}        ║${NC}"
echo -e "${CYAN}╚══════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Check if tmux is installed
if ! command -v tmux &> /dev/null; then
    echo -e "${RED}Error: tmux is not installed. Install it first:${NC}"
    echo "sudo apt-get install tmux  # Ubuntu/Debian"
    echo "brew install tmux          # macOS"
    exit 1
fi

# Check if Claude CLI is available
if ! command -v claude &> /dev/null; then
    echo -e "${YELLOW}Warning: Claude CLI not found. Some features will be simulated.${NC}"
    CLAUDE_AVAILABLE=false
else
    CLAUDE_AVAILABLE=true
fi

# Kill any existing demo session
tmux kill-session -t mcp-demo 2>/dev/null

echo -e "${GREEN}Starting tmux session 'mcp-demo'...${NC}"
echo -e "${YELLOW}Instructions:${NC}"
echo "  • Navigate panes: Ctrl+b then arrow keys"
echo "  • Scroll in pane: Ctrl+b then [ (q to exit scroll)"
echo "  • Exit demo: Type 'exit' or Ctrl+b then :kill-session"
echo ""
echo -e "${CYAN}Press Enter to start the demo...${NC}"
read

# Create tmux session with multiple panes
tmux new-session -d -s mcp-demo -n "MCP Management"

# Split window into 4 panes:
# +------------------+------------------+
# |                  |                  |
# |    Claude CLI    |   MCP Monitor    |
# |     (Pane 0)     |     (Pane 1)     |
# |                  |                  |
# +------------------+------------------+
# |                  |                  |
# |   MCP Control    |    Test Area     |
# |     (Pane 2)     |     (Pane 3)     |
# |                  |                  |
# +------------------+------------------+

# Create the layout
tmux split-window -h -t mcp-demo:0
tmux split-window -v -t mcp-demo:0.0
tmux split-window -v -t mcp-demo:0.1

# Pane 0 (top-left): Claude CLI with Rapala MCP
tmux send-keys -t mcp-demo:0.0 "clear" C-m
tmux send-keys -t mcp-demo:0.0 "echo -e '${CYAN}═══════════════════════════════════════${NC}'" C-m
tmux send-keys -t mcp-demo:0.0 "echo -e '${WHITE}    CLAUDE CLI WITH RAPALA MCP${NC}'" C-m
tmux send-keys -t mcp-demo:0.0 "echo -e '${CYAN}═══════════════════════════════════════${NC}'" C-m
tmux send-keys -t mcp-demo:0.0 "echo ''" C-m

if [ "$CLAUDE_AVAILABLE" = true ]; then
    tmux send-keys -t mcp-demo:0.0 "echo -e '${GREEN}Starting Claude with Rapala MCP...${NC}'" C-m
    tmux send-keys -t mcp-demo:0.0 "echo ''" C-m
    tmux send-keys -t mcp-demo:0.0 "# When ready, run: claude" C-m
    tmux send-keys -t mcp-demo:0.0 "# Then test with: /mcp rapala" C-m
else
    tmux send-keys -t mcp-demo:0.0 "echo -e '${YELLOW}Claude CLI not available${NC}'" C-m
    tmux send-keys -t mcp-demo:0.0 "echo 'Simulating MCP interaction...'" C-m
    tmux send-keys -t mcp-demo:0.0 "echo ''" C-m
    tmux send-keys -t mcp-demo:0.0 "# Simulated MCP commands:" C-m
    tmux send-keys -t mcp-demo:0.0 "# node src/mcp/rapala-mcp.mjs" C-m
fi

# Pane 1 (top-right): MCP Server Monitor
tmux send-keys -t mcp-demo:0.1 "clear" C-m
tmux send-keys -t mcp-demo:0.1 "echo -e '${MAGENTA}═══════════════════════════════════════${NC}'" C-m
tmux send-keys -t mcp-demo:0.1 "echo -e '${WHITE}        MCP SERVER MONITOR${NC}'" C-m
tmux send-keys -t mcp-demo:0.1 "echo -e '${MAGENTA}═══════════════════════════════════════${NC}'" C-m
tmux send-keys -t mcp-demo:0.1 "echo ''" C-m
tmux send-keys -t mcp-demo:0.1 "echo -e '${GREEN}Monitoring MCP servers...${NC}'" C-m
tmux send-keys -t mcp-demo:0.1 "echo ''" C-m
tmux send-keys -t mcp-demo:0.1 "# Watch for running MCP servers" C-m
tmux send-keys -t mcp-demo:0.1 "watch -n 2 'echo \"Active MCP Processes:\"; ps aux | grep -E \"(mcp|agent-mcp|rapala-mcp)\" | grep -v grep | head -5; echo \"\"; echo \"Port Status:\"; netstat -tuln 2>/dev/null | grep -E \":(3000|3001|8080)\" || ss -tuln | grep -E \":(3000|3001|8080)\"'" C-m

# Pane 2 (bottom-left): MCP Control Panel
tmux send-keys -t mcp-demo:0.2 "clear" C-m
tmux send-keys -t mcp-demo:0.2 "echo -e '${BLUE}═══════════════════════════════════════${NC}'" C-m
tmux send-keys -t mcp-demo:0.2 "echo -e '${WHITE}      MCP CONTROL PANEL${NC}'" C-m
tmux send-keys -t mcp-demo:0.2 "echo -e '${BLUE}═══════════════════════════════════════${NC}'" C-m
tmux send-keys -t mcp-demo:0.2 "echo ''" C-m
tmux send-keys -t mcp-demo:0.2 "cd /home/alejandro/Code/MCP/Hooks/Git/rins_hooks" C-m
tmux send-keys -t mcp-demo:0.2 "echo -e '${GREEN}Ready to control MCP servers${NC}'" C-m
tmux send-keys -t mcp-demo:0.2 "echo ''" C-m
tmux send-keys -t mcp-demo:0.2 "echo '# Example commands:'" C-m
tmux send-keys -t mcp-demo:0.2 "echo '# 1. List available MCPs:'" C-m
tmux send-keys -t mcp-demo:0.2 "echo '#    ./test-mcp-list.sh'" C-m
tmux send-keys -t mcp-demo:0.2 "echo ''" C-m
tmux send-keys -t mcp-demo:0.2 "echo '# 2. Start agent-mcp:'" C-m
tmux send-keys -t mcp-demo:0.2 "echo '#    ./test-mcp-start-agent.sh'" C-m
tmux send-keys -t mcp-demo:0.2 "echo ''" C-m
tmux send-keys -t mcp-demo:0.2 "echo '# 3. Add custom MCP:'" C-m
tmux send-keys -t mcp-demo:0.2 "echo '#    ./test-mcp-add-custom.sh'" C-m
tmux send-keys -t mcp-demo:0.2 "echo ''" C-m

# Pane 3 (bottom-right): Test Area
tmux send-keys -t mcp-demo:0.3 "clear" C-m
tmux send-keys -t mcp-demo:0.3 "echo -e '${YELLOW}═══════════════════════════════════════${NC}'" C-m
tmux send-keys -t mcp-demo:0.3 "echo -e '${WHITE}         TEST AREA${NC}'" C-m
tmux send-keys -t mcp-demo:0.3 "echo -e '${YELLOW}═══════════════════════════════════════${NC}'" C-m
tmux send-keys -t mcp-demo:0.3 "echo ''" C-m
tmux send-keys -t mcp-demo:0.3 "cd /home/alejandro/Code/MCP/Hooks/Git/rins_hooks" C-m
tmux send-keys -t mcp-demo:0.3 "echo -e '${GREEN}Testing MCP tools directly...${NC}'" C-m
tmux send-keys -t mcp-demo:0.3 "echo ''" C-m
tmux send-keys -t mcp-demo:0.3 "# Test the Rapala MCP server" C-m
tmux send-keys -t mcp-demo:0.3 "node -e \"console.log('{\\\"jsonrpc\\\":\\\"2.0\\\",\\\"method\\\":\\\"tools/list\\\",\\\"params\\\":{},\\\"id\\\":1}')\" | node src/mcp/rapala-mcp.mjs 2>/dev/null | jq '.result.tools[] | .name'" C-m

# Attach to the session
tmux attach-session -t mcp-demo