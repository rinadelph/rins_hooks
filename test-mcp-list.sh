#!/bin/bash

echo "📊 Listing MCP Servers..."
echo "========================="
echo ""

# Create the JSON-RPC request
REQUEST='{
  "jsonrpc": "2.0",
  "method": "tools/call",
  "params": {
    "name": "mcp-list",
    "arguments": {}
  },
  "id": 1
}'

# Send request to Rapala MCP server and extract the result
echo "$REQUEST" | node src/mcp/rapala-mcp.mjs 2>/dev/null | jq -r '.result.content[0].text'

echo ""
echo "✅ Done!"