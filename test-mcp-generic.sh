#!/bin/bash

echo "Testing Generic MCP Management System"
echo "======================================"
echo ""

# Test listing available MCPs
echo "1. Listing available MCP servers:"
echo '{"jsonrpc":"2.0","method":"tools/call","params":{"name":"mcp-list","arguments":{}},"id":1}' | node src/mcp/rapala-mcp.mjs 2>/dev/null | jq -r '.result.content[0].text' | head -30

echo ""
echo "2. Quick-add filesystem MCP to Claude:"
echo '{"jsonrpc":"2.0","method":"tools/call","params":{"name":"mcp-quick-add","arguments":{"preset":"filesystem","name":"fs-test"}},"id":2}' | node src/mcp/rapala-mcp.mjs 2>/dev/null | jq -r '.result.content[0].text'

echo ""
echo "3. Starting agent-mcp server via generic interface:"
echo '{"jsonrpc":"2.0","method":"tools/call","params":{"name":"mcp-start","arguments":{"name":"agent-mcp","transport":"http","command":"agent-mcp","args":["--port","3001"],"port":3001}},"id":3}' | node src/mcp/rapala-mcp.mjs 2>/dev/null | jq -r '.result.content[0].text' | head -20

echo ""
echo "Test complete!"