#!/bin/bash

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
MAGENTA='\033[0;35m'
CYAN='\033[0;36m'
WHITE='\033[1;37m'
NC='\033[0m'

# Function to send JSON-RPC request to Rapala MCP
send_mcp_request() {
    local method=$1
    local args=$2
    local request="{
        \"jsonrpc\": \"2.0\",
        \"method\": \"tools/call\",
        \"params\": {
            \"name\": \"$method\",
            \"arguments\": $args
        },
        \"id\": 1
    }"
    
    echo "$request" | node src/mcp/rapala-mcp.mjs 2>/dev/null | jq -r '.result.content[0].text'
}

# Main menu
show_menu() {
    clear
    echo -e "${CYAN}╔══════════════════════════════════════════════╗${NC}"
    echo -e "${CYAN}║  ${WHITE}Rapala MCP Control Center${CYAN}                  ║${NC}"
    echo -e "${CYAN}╠══════════════════════════════════════════════╣${NC}"
    echo -e "${CYAN}║${NC}  1. ${GREEN}List MCP Servers${NC}                        ${CYAN}║${NC}"
    echo -e "${CYAN}║${NC}  2. ${YELLOW}Start MCP Server${NC}                        ${CYAN}║${NC}"
    echo -e "${CYAN}║${NC}  3. ${RED}Stop MCP Server${NC}                         ${CYAN}║${NC}"
    echo -e "${CYAN}║${NC}  4. ${BLUE}Quick Add Preset MCP${NC}                    ${CYAN}║${NC}"
    echo -e "${CYAN}║${NC}  5. ${MAGENTA}Add Custom MCP to Claude${NC}                ${CYAN}║${NC}"
    echo -e "${CYAN}║${NC}  6. ${RED}Remove MCP from Claude${NC}                  ${CYAN}║${NC}"
    echo -e "${CYAN}║${NC}  7. ${GREEN}Test Rapala Connection${NC}                  ${CYAN}║${NC}"
    echo -e "${CYAN}║${NC}  8. ${YELLOW}List Rapala Hooks${NC}                       ${CYAN}║${NC}"
    echo -e "${CYAN}║${NC}  9. ${WHITE}View Documentation${NC}                      ${CYAN}║${NC}"
    echo -e "${CYAN}║${NC}  0. ${RED}Exit${NC}                                    ${CYAN}║${NC}"
    echo -e "${CYAN}╚══════════════════════════════════════════════╝${NC}"
    echo ""
}

# List MCP servers
list_servers() {
    echo -e "${GREEN}Listing MCP Servers...${NC}"
    echo ""
    send_mcp_request "mcp-list" "{}"
    echo ""
    read -p "Press Enter to continue..."
}

# Start MCP server
start_server() {
    echo -e "${YELLOW}Start MCP Server${NC}"
    echo "================"
    echo ""
    echo "Quick start options:"
    echo "1. agent-mcp (HTTP on port 3001)"
    echo "2. Custom stdio server"
    echo "3. Custom HTTP server"
    echo ""
    read -p "Choice (1-3): " choice
    
    case $choice in
        1)
            echo ""
            echo "Starting agent-mcp..."
            send_mcp_request "mcp-start" '{
                "name": "agent-mcp",
                "transport": "http",
                "command": "agent-mcp",
                "args": ["--port", "3001"],
                "port": 3001
            }'
            ;;
        2)
            read -p "Server name: " name
            read -p "Command: " cmd
            read -p "Arguments (space-separated): " args
            args_json=$(echo "$args" | awk '{printf "["; for(i=1;i<=NF;i++) printf "\"%s\"%s", $i, (i<NF?",":""); printf "]"}')
            send_mcp_request "mcp-start" "{
                \"name\": \"$name\",
                \"transport\": \"stdio\",
                \"command\": \"$cmd\",
                \"args\": $args_json
            }"
            ;;
        3)
            read -p "Server name: " name
            read -p "Command: " cmd
            read -p "Port: " port
            send_mcp_request "mcp-start" "{
                \"name\": \"$name\",
                \"transport\": \"http\",
                \"command\": \"$cmd\",
                \"args\": [\"--port\", \"$port\"],
                \"port\": $port
            }"
            ;;
    esac
    
    echo ""
    read -p "Press Enter to continue..."
}

# Stop MCP server
stop_server() {
    echo -e "${RED}Stop MCP Server${NC}"
    echo "==============="
    echo ""
    read -p "Enter server name to stop: " name
    echo ""
    send_mcp_request "mcp-stop" "{\"name\": \"$name\"}"
    echo ""
    read -p "Press Enter to continue..."
}

# Quick add preset
quick_add_preset() {
    echo -e "${BLUE}Quick Add Preset MCP${NC}"
    echo "===================="
    echo ""
    echo "Available presets:"
    echo "1. filesystem    - File system access"
    echo "2. github        - GitHub API"
    echo "3. memory        - Knowledge graph"
    echo "4. sqlite        - SQLite database"
    echo "5. puppeteer     - Browser automation"
    echo "6. fetch         - Web content fetching"
    echo ""
    read -p "Select preset (1-6): " choice
    
    case $choice in
        1) preset="filesystem" ;;
        2) preset="github" ;;
        3) preset="memory" ;;
        4) preset="sqlite" ;;
        5) preset="puppeteer" ;;
        6) preset="fetch" ;;
        *) echo "Invalid choice!"; return ;;
    esac
    
    read -p "Custom name (or press Enter for default): " name
    
    if [ -z "$name" ]; then
        name_arg=""
    else
        name_arg=", \"name\": \"$name\""
    fi
    
    # Check if preset needs environment variables
    env_arg=""
    if [ "$preset" = "github" ]; then
        read -p "GitHub Personal Access Token: " token
        env_arg=", \"env\": {\"GITHUB_PERSONAL_ACCESS_TOKEN\": \"$token\"}"
    fi
    
    echo ""
    send_mcp_request "mcp-quick-add" "{
        \"preset\": \"$preset\"
        $name_arg
        $env_arg
    }"
    
    echo ""
    read -p "Press Enter to continue..."
}

# Add custom MCP
add_custom_mcp() {
    echo -e "${MAGENTA}Add Custom MCP to Claude${NC}"
    echo "========================"
    echo ""
    read -p "Server name: " name
    echo "Transport type:"
    echo "1. stdio"
    echo "2. http"
    echo "3. sse"
    read -p "Choice (1-3): " transport_choice
    
    case $transport_choice in
        1)
            transport="stdio"
            read -p "Command: " cmd
            read -p "Arguments (space-separated): " args
            args_json=$(echo "$args" | awk '{printf "["; for(i=1;i<=NF;i++) printf "\"%s\"%s", $i, (i<NF?",":""); printf "]"}')
            send_mcp_request "mcp-add-to-claude" "{
                \"name\": \"$name\",
                \"transport\": \"$transport\",
                \"command\": \"$cmd\",
                \"args\": $args_json
            }"
            ;;
        2|3)
            [ "$transport_choice" = "2" ] && transport="http" || transport="sse"
            read -p "Server URL: " url
            send_mcp_request "mcp-add-to-claude" "{
                \"name\": \"$name\",
                \"transport\": \"$transport\",
                \"url\": \"$url\"
            }"
            ;;
    esac
    
    echo ""
    read -p "Press Enter to continue..."
}

# Remove MCP from Claude
remove_mcp() {
    echo -e "${RED}Remove MCP from Claude${NC}"
    echo "======================"
    echo ""
    read -p "Enter server name to remove: " name
    echo ""
    send_mcp_request "mcp-remove-from-claude" "{\"name\": \"$name\"}"
    echo ""
    read -p "Press Enter to continue..."
}

# Test Rapala connection
test_rapala() {
    echo -e "${GREEN}Testing Rapala Connection${NC}"
    echo "========================="
    echo ""
    send_mcp_request "rapala-test" "{}"
    echo ""
    read -p "Press Enter to continue..."
}

# List hooks
list_hooks() {
    echo -e "${YELLOW}Listing Rapala Hooks${NC}"
    echo "===================="
    echo ""
    send_mcp_request "rapala-hook-list" "{}"
    echo ""
    read -p "Press Enter to continue..."
}

# View documentation
view_docs() {
    echo -e "${WHITE}MCP Management Documentation${NC}"
    echo "============================="
    echo ""
    if [ -f "docs/GENERIC_MCP_MANAGEMENT.md" ]; then
        less docs/GENERIC_MCP_MANAGEMENT.md
    else
        echo "Documentation not found!"
        echo ""
        echo "Key concepts:"
        echo "• Generic MCP management allows adding ANY MCP server"
        echo "• Supports stdio, HTTP, and SSE transports"
        echo "• Works with Python, Node.js, Go, Rust, etc."
        echo "• Automatic Claude settings integration"
        echo ""
        read -p "Press Enter to continue..."
    fi
}

# Main loop
while true; do
    show_menu
    read -p "Enter choice: " choice
    
    case $choice in
        1) list_servers ;;
        2) start_server ;;
        3) stop_server ;;
        4) quick_add_preset ;;
        5) add_custom_mcp ;;
        6) remove_mcp ;;
        7) test_rapala ;;
        8) list_hooks ;;
        9) view_docs ;;
        0) 
            echo -e "${GREEN}Goodbye!${NC}"
            exit 0
            ;;
        *)
            echo -e "${RED}Invalid choice!${NC}"
            sleep 1
            ;;
    esac
done