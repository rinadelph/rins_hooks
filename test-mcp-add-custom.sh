#!/bin/bash

echo "🔧 Adding Custom MCP Server to Claude..."
echo "========================================"
echo ""

# Menu for selecting MCP type
echo "Select an MCP server to add:"
echo "1. Filesystem MCP (access local files)"
echo "2. GitHub MCP (requires token)"
echo "3. Memory MCP (knowledge graph)"
echo "4. SQLite MCP (database access)"
echo "5. Custom Python MCP"
echo "6. Custom Node.js MCP"
echo ""
read -p "Enter choice (1-6): " choice

case $choice in
    1)
        echo ""
        echo "Adding Filesystem MCP..."
        REQUEST='{
          "jsonrpc": "2.0",
          "method": "tools/call",
          "params": {
            "name": "mcp-quick-add",
            "arguments": {
              "preset": "filesystem",
              "name": "fs-local"
            }
          },
          "id": 1
        }'
        ;;
    
    2)
        echo ""
        read -p "Enter GitHub Personal Access Token: " token
        REQUEST="{
          \"jsonrpc\": \"2.0\",
          \"method\": \"tools/call\",
          \"params\": {
            \"name\": \"mcp-quick-add\",
            \"arguments\": {
              \"preset\": \"github\",
              \"name\": \"github-api\",
              \"env\": {
                \"GITHUB_PERSONAL_ACCESS_TOKEN\": \"$token\"
              }
            }
          },
          \"id\": 1
        }"
        ;;
    
    3)
        echo ""
        echo "Adding Memory MCP..."
        REQUEST='{
          "jsonrpc": "2.0",
          "method": "tools/call",
          "params": {
            "name": "mcp-quick-add",
            "arguments": {
              "preset": "memory",
              "name": "knowledge-graph"
            }
          },
          "id": 1
        }'
        ;;
    
    4)
        echo ""
        read -p "Enter database path (e.g., /path/to/db.sqlite): " dbpath
        REQUEST="{
          \"jsonrpc\": \"2.0\",
          \"method\": \"tools/call\",
          \"params\": {
            \"name\": \"mcp-add-to-claude\",
            \"arguments\": {
              \"name\": \"sqlite-db\",
              \"transport\": \"stdio\",
              \"command\": \"npx\",
              \"args\": [\"-y\", \"@modelcontextprotocol/server-sqlite\", \"$dbpath\"]
            }
          },
          \"id\": 1
        }"
        ;;
    
    5)
        echo ""
        echo "Adding Custom Python MCP..."
        read -p "Enter Python script path: " script
        read -p "Enter MCP name: " name
        read -p "Enter any arguments (space-separated, or press Enter for none): " args
        
        # Convert args to JSON array
        if [ -z "$args" ]; then
            args_json="[]"
        else
            args_json=$(echo "$args" | awk '{printf "["; for(i=1;i<=NF;i++) printf "\"%s\"%s", $i, (i<NF?",":""); printf "]"}')
        fi
        
        REQUEST="{
          \"jsonrpc\": \"2.0\",
          \"method\": \"tools/call\",
          \"params\": {
            \"name\": \"mcp-add-to-claude\",
            \"arguments\": {
              \"name\": \"$name\",
              \"transport\": \"stdio\",
              \"command\": \"python\",
              \"args\": $args_json
            }
          },
          \"id\": 1
        }"
        ;;
    
    6)
        echo ""
        echo "Adding Custom Node.js MCP..."
        read -p "Enter Node.js script path: " script
        read -p "Enter MCP name: " name
        read -p "Use HTTP transport? (y/n): " use_http
        
        if [ "$use_http" = "y" ]; then
            read -p "Enter port number: " port
            REQUEST="{
              \"jsonrpc\": \"2.0\",
              \"method\": \"tools/call\",
              \"params\": {
                \"name\": \"mcp-add-to-claude\",
                \"arguments\": {
                  \"name\": \"$name\",
                  \"transport\": \"http\",
                  \"url\": \"http://localhost:$port/mcp\"
                }
              },
              \"id\": 1
            }"
        else
            REQUEST="{
              \"jsonrpc\": \"2.0\",
              \"method\": \"tools/call\",
              \"params\": {
                \"name\": \"mcp-add-to-claude\",
                \"arguments\": {
                  \"name\": \"$name\",
                  \"transport\": \"stdio\",
                  \"command\": \"node\",
                  \"args\": [\"$script\"]
                }
              },
              \"id\": 1
            }"
        fi
        ;;
    
    *)
        echo "Invalid choice!"
        exit 1
        ;;
esac

echo ""
echo "Sending request to Rapala MCP..."
echo ""

# Send request and display result
RESULT=$(echo "$REQUEST" | node src/mcp/rapala-mcp.mjs 2>/dev/null | jq -r '.result.content[0].text')
echo "$RESULT"

if echo "$RESULT" | grep -q "✅"; then
    echo ""
    echo "📝 Next steps:"
    echo "1. Restart Claude to load the new MCP server"
    echo "2. Test in Claude with: /mcp <server-name>"
    echo "3. Use /mcp list to see all available servers"
fi