#!/bin/bash

# Test script for MCP integration with Claude
# Tests the Rapala MCP server by launching Claude and verifying connection

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SESSION_NAME="claude-mcp-test"
MCP_SERVER_PATH="$SCRIPT_DIR/src/mcp/RapalaMCPServer.js"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${BLUE}🧪 Testing Rapala MCP Integration with Claude${NC}\n"

# Step 1: Check prerequisites
echo -e "${BLUE}Step 1: Checking prerequisites...${NC}"
if ! command -v tmux &> /dev/null; then
    echo -e "${RED}❌ tmux is not installed. Please install tmux first.${NC}"
    exit 1
fi

if ! command -v claude &> /dev/null; then
    echo -e "${RED}❌ Claude CLI is not installed. Please install Claude CLI first.${NC}"
    exit 1
fi

if [ ! -f "$MCP_SERVER_PATH" ]; then
    echo -e "${RED}❌ Rapala MCP Server not found at: $MCP_SERVER_PATH${NC}"
    exit 1
fi

echo -e "${GREEN}✓ All prerequisites met${NC}\n"

# Step 2: Kill any existing test session
echo -e "${BLUE}Step 2: Cleaning up any existing test sessions...${NC}"
tmux kill-session -t "$SESSION_NAME" 2>/dev/null || true
echo -e "${GREEN}✓ Cleanup complete${NC}\n"

# Step 3: Create new tmux session
echo -e "${BLUE}Step 3: Creating tmux session: $SESSION_NAME${NC}"
tmux new-session -d -s "$SESSION_NAME"
echo -e "${GREEN}✓ Tmux session created${NC}\n"

# Step 4: Add Rapala MCP to Claude
echo -e "${BLUE}Step 4: Adding Rapala MCP server to Claude...${NC}"
# First, we need to configure the MCP in Claude's settings
cat > /tmp/rapala-mcp-config.json << EOF
{
  "rapala": {
    "command": "node",
    "args": ["$MCP_SERVER_PATH"],
    "env": {}
  }
}
EOF

# Use claude mcp add command (if available) or directly modify settings
if claude mcp add 2>/dev/null | grep -q "Usage"; then
    # Claude has MCP add command
    tmux send-keys -t "$SESSION_NAME" "claude mcp add stdio rapala 'node $MCP_SERVER_PATH'" C-m
    sleep 2
else
    # Fallback: directly modify settings.json
    echo -e "${YELLOW}⚠ claude mcp add not available, modifying settings directly...${NC}"
    
    CLAUDE_SETTINGS="$HOME/.claude/settings.json"
    if [ -f "$CLAUDE_SETTINGS" ]; then
        # Backup existing settings
        cp "$CLAUDE_SETTINGS" "$CLAUDE_SETTINGS.bak"
    fi
    
    # Create or update settings with MCP server
    if [ -f "$CLAUDE_SETTINGS" ]; then
        # Update existing settings
        jq '.mcpServers.rapala = {
            "command": "node",
            "args": ["'$MCP_SERVER_PATH'"],
            "env": {}
        }' "$CLAUDE_SETTINGS" > /tmp/claude-settings-new.json
        mv /tmp/claude-settings-new.json "$CLAUDE_SETTINGS"
    else
        # Create new settings
        mkdir -p "$HOME/.claude"
        cat > "$CLAUDE_SETTINGS" << EOF
{
  "mcpServers": {
    "rapala": {
      "command": "node",
      "args": ["$MCP_SERVER_PATH"],
      "env": {}
    }
  }
}
EOF
    fi
fi
echo -e "${GREEN}✓ Rapala MCP configured${NC}\n"

# Step 5: Launch Claude with dangerous permissions
echo -e "${BLUE}Step 5: Launching Claude with --dangerously-skip-permissions...${NC}"
tmux send-keys -t "$SESSION_NAME" "claude --dangerously-skip-permissions" C-m
echo -e "${GREEN}✓ Claude launch command sent${NC}\n"

# Step 6: Wait for Claude to load
echo -e "${BLUE}Step 6: Waiting for Claude to fully load...${NC}"
echo -e "${YELLOW}Waiting 5 seconds for Claude to initialize...${NC}"
sleep 5
echo -e "${GREEN}✓ Claude should be loaded${NC}\n"

# Step 7: Send /mcp command to test connection
echo -e "${BLUE}Step 7: Testing MCP connection...${NC}"
echo -e "${YELLOW}Sending '/mcp' command...${NC}"

# Send the /mcp command character by character to ensure it's typed correctly
tmux send-keys -t "$SESSION_NAME" "/" 
sleep 0.1
tmux send-keys -t "$SESSION_NAME" "m"
sleep 0.1
tmux send-keys -t "$SESSION_NAME" "c"
sleep 0.1
tmux send-keys -t "$SESSION_NAME" "p"
sleep 0.5

echo -e "${GREEN}✓ Command typed${NC}\n"

# Step 8: Send Enter key as separate command
echo -e "${BLUE}Step 8: Sending Enter key...${NC}"
tmux send-keys -t "$SESSION_NAME" Enter
echo -e "${GREEN}✓ Enter key sent${NC}\n"

# Step 9: Wait and capture output
echo -e "${BLUE}Step 9: Waiting for response and capturing output...${NC}"
sleep 3

# Capture the pane content
tmux capture-pane -t "$SESSION_NAME" -p > /tmp/claude-mcp-test-output.txt

# Step 10: Verify MCP connection
echo -e "${BLUE}Step 10: Verifying MCP connection...${NC}"

if grep -q "rapala" /tmp/claude-mcp-test-output.txt; then
    echo -e "${GREEN}✅ SUCCESS: Rapala MCP is connected!${NC}"
    echo -e "${GREEN}Found 'rapala' in Claude output${NC}"
elif grep -q "MCP" /tmp/claude-mcp-test-output.txt; then
    echo -e "${GREEN}✅ MCP command recognized${NC}"
    echo -e "${YELLOW}⚠ But 'rapala' not specifically mentioned. Check output:${NC}"
    tail -20 /tmp/claude-mcp-test-output.txt
elif grep -q "not connected" /tmp/claude-mcp-test-output.txt; then
    echo -e "${RED}❌ MCP not connected${NC}"
    echo -e "${YELLOW}Output:${NC}"
    tail -20 /tmp/claude-mcp-test-output.txt
else
    echo -e "${YELLOW}⚠ Could not determine MCP status. Full output:${NC}"
    cat /tmp/claude-mcp-test-output.txt
fi

# Step 11: Additional test - try using an MCP tool
echo -e "\n${BLUE}Step 11: Testing MCP tool usage...${NC}"
sleep 1

# Clear the line first
tmux send-keys -t "$SESSION_NAME" C-u
sleep 0.5

# Send a test command to list hooks
echo -e "${YELLOW}Sending test command to list hooks...${NC}"
tmux send-keys -t "$SESSION_NAME" "List all available Rapala hooks using the MCP tool"
sleep 0.5
tmux send-keys -t "$SESSION_NAME" Enter

# Wait for response
echo -e "${YELLOW}Waiting for tool execution...${NC}"
sleep 5

# Capture output again
tmux capture-pane -t "$SESSION_NAME" -p > /tmp/claude-mcp-tool-output.txt

if grep -q "rapala.hook.list" /tmp/claude-mcp-tool-output.txt; then
    echo -e "${GREEN}✅ MCP tool 'rapala.hook.list' is being used!${NC}"
elif grep -q "hook" /tmp/claude-mcp-tool-output.txt; then
    echo -e "${GREEN}✅ Hook-related response detected${NC}"
else
    echo -e "${YELLOW}⚠ Tool usage unclear. Check output manually.${NC}"
fi

# Step 12: Show session info
echo -e "\n${BLUE}Step 12: Test Complete${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}✅ Test session is running in tmux: $SESSION_NAME${NC}"
echo -e "${YELLOW}To view the session:${NC} tmux attach -t $SESSION_NAME"
echo -e "${YELLOW}To kill the session:${NC} tmux kill-session -t $SESSION_NAME"
echo -e "${YELLOW}Output saved to:${NC} /tmp/claude-mcp-test-output.txt"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

# Optional: Attach to session if running interactively
if [ -t 0 ]; then
    echo -e "\n${YELLOW}Would you like to attach to the tmux session now? (y/n)${NC}"
    read -r response
    if [[ "$response" =~ ^[Yy]$ ]]; then
        tmux attach -t "$SESSION_NAME"
    fi
fi