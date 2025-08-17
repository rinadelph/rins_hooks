#!/bin/bash

echo "🚀 Starting agent-mcp Server..."
echo "==============================="
echo ""

# Check if agent-mcp is installed
if ! command -v agent-mcp &> /dev/null; then
    echo "❌ agent-mcp is not installed!"
    echo ""
    echo "Install it with:"
    echo "  npm install -g agent-mcp-node"
    exit 1
fi

# Create the JSON-RPC request to start agent-mcp
REQUEST='{
  "jsonrpc": "2.0",
  "method": "tools/call",
  "params": {
    "name": "mcp-start",
    "arguments": {
      "name": "agent-mcp",
      "transport": "http",
      "command": "agent-mcp",
      "args": ["--port", "3001"],
      "port": 3001
    }
  },
  "id": 1
}'

echo "Starting agent-mcp on port 3001..."
echo ""

# Send request to Rapala MCP server
RESULT=$(echo "$REQUEST" | node src/mcp/rapala-mcp.mjs 2>/dev/null | jq -r '.result.content[0].text')

echo "$RESULT"
echo ""

# Check if it started successfully
if echo "$RESULT" | grep -q "✅"; then
    echo "📝 Next steps:"
    echo "1. Add to Claude: claude mcp add agent-mcp http://localhost:3001/mcp"
    echo "2. Restart Claude to load the new MCP server"
    echo "3. Test in Claude with: /mcp agent-mcp"
else
    echo "⚠️  Server may already be running or failed to start"
fi