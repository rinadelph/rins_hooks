#!/bin/bash

echo "Testing Generic MCP Management System"
echo "======================================"
echo ""

# Test listing available MCPs
echo "1. Listing available MCP servers:"
echo '{"jsonrpc":"2.0","method":"tools/call","params":{"name":"mcp-list","arguments":{}},"id":1}' | node src/mcp/rapala-mcp.mjs 2>/dev/null | jq -r '.result.content[0].text' | head -30

echo ""
echo "2. Testing Rapala MCP connection:"
echo '{"jsonrpc":"2.0","method":"tools/call","params":{"name":"rapala-test","arguments":{}},"id":2}' | node src/mcp/rapala-mcp.mjs 2>/dev/null | jq -r '.result.content[0].text'

echo ""
echo "3. Listing Rapala hooks:"
echo '{"jsonrpc":"2.0","method":"tools/call","params":{"name":"rapala-hook-list","arguments":{}},"id":3}' | node src/mcp/rapala-mcp.mjs 2>/dev/null | jq -r '.result.content[0].text' | head -20

echo ""
echo "Test complete!"