#!/bin/bash

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
WHITE='\033[1;37m'
NC='\033[0m'

clear
echo -e "${CYAN}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${WHITE}      Rapala Generic MCP Management - Live Demo${NC}"
echo -e "${CYAN}═══════════════════════════════════════════════════════════════${NC}"
echo ""

# Function to call MCP tool
call_mcp_tool() {
    local tool_name=$1
    local args=${2:-"{}"}
    
    local request="{
        \"jsonrpc\": \"2.0\",
        \"id\": 1,
        \"method\": \"initialize\",
        \"params\": {
            \"protocolVersion\": \"1.0\",
            \"capabilities\": {},
            \"clientInfo\": {\"name\": \"demo\", \"version\": \"1.0\"}
        }
    }"
    
    # Initialize first
    echo "$request" | node src/mcp/rapala-mcp.mjs 2>/dev/null > /dev/null
    
    # Now call the tool
    request="{
        \"jsonrpc\": \"2.0\",
        \"id\": 2,
        \"method\": \"tools/call\",
        \"params\": {
            \"name\": \"$tool_name\",
            \"arguments\": $args
        }
    }"
    
    echo "$request" | node src/mcp/rapala-mcp.mjs 2>/dev/null | jq -r '.result.content[0].text' 2>/dev/null || echo "Error calling tool"
}

# Demo 1: Test Connection
echo -e "${GREEN}1. Testing Rapala MCP Connection${NC}"
echo "================================="
call_mcp_tool "rapala-test"
echo ""
read -p "Press Enter to continue..."
echo ""

# Demo 2: List Available MCPs
echo -e "${YELLOW}2. Listing Available MCP Servers${NC}"
echo "================================="
call_mcp_tool "mcp-list" | head -30
echo ""
read -p "Press Enter to continue..."
echo ""

# Demo 3: List Hooks
echo -e "${BLUE}3. Listing Rapala Hooks${NC}"
echo "======================="
call_mcp_tool "rapala-hook-list"
echo ""
read -p "Press Enter to continue..."
echo ""

# Demo 4: Show how to add MCPs
echo -e "${CYAN}4. How to Add MCP Servers${NC}"
echo "========================="
echo ""
echo "You can add ANY MCP server to Claude using these tools:"
echo ""
echo -e "${GREEN}Quick Add Presets:${NC}"
echo "  • filesystem - File system access"
echo "  • github - GitHub API (needs token)"
echo "  • memory - Knowledge graph"
echo "  • sqlite - Database access"
echo ""
echo -e "${YELLOW}Example: Add filesystem MCP${NC}"
echo '  Tool: mcp-quick-add'
echo '  Args: {"preset": "filesystem", "name": "my-fs"}'
echo ""
echo -e "${BLUE}Custom MCP Servers:${NC}"
echo "  • Python: {\"command\": \"python\", \"args\": [\"server.py\"]}"
echo "  • Node.js: {\"command\": \"node\", \"args\": [\"server.js\"]}"
echo "  • HTTP: {\"url\": \"http://localhost:3001/mcp\"}"
echo ""
read -p "Press Enter to continue..."
echo ""

# Demo 5: Interactive Menu
echo -e "${WHITE}5. Interactive Options${NC}"
echo "======================"
echo ""
echo "What would you like to try?"
echo "1. Start agent-mcp server"
echo "2. Add filesystem MCP to Claude"
echo "3. View MCP system status"
echo "4. Exit demo"
echo ""
read -p "Enter choice (1-4): " choice

case $choice in
    1)
        echo ""
        echo -e "${GREEN}Starting agent-mcp server...${NC}"
        if command -v agent-mcp &> /dev/null; then
            call_mcp_tool "mcp-start" '{
                "name": "agent-mcp",
                "transport": "http",
                "command": "agent-mcp",
                "args": ["--port", "3001"],
                "port": 3001
            }'
        else
            echo -e "${RED}agent-mcp not installed. Install with: npm install -g agent-mcp-node${NC}"
        fi
        ;;
    2)
        echo ""
        echo -e "${GREEN}Adding filesystem MCP to Claude...${NC}"
        call_mcp_tool "mcp-quick-add" '{"preset": "filesystem", "name": "fs-demo"}'
        ;;
    3)
        echo ""
        echo -e "${GREEN}MCP System Status:${NC}"
        call_mcp_tool "rapala-status"
        ;;
    4)
        echo -e "${GREEN}Exiting demo...${NC}"
        ;;
esac

echo ""
echo -e "${CYAN}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${WHITE}Demo Complete!${NC}"
echo ""
echo "Next steps:"
echo "  • Run ${GREEN}./mcp-control.sh${NC} for full control panel"
echo "  • Check ${YELLOW}docs/GENERIC_MCP_MANAGEMENT.md${NC} for documentation"
echo "  • Restart Claude to load any new MCP servers"
echo -e "${CYAN}═══════════════════════════════════════════════════════════════${NC}"