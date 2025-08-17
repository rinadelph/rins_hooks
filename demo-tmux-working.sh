#!/bin/bash

# Kill any existing session
tmux kill-session -t mcp-demo 2>/dev/null

echo "Starting MCP Demo in tmux..."
echo "Commands:"
echo "  • Switch panes: Ctrl+b + arrow keys"
echo "  • Exit: Ctrl+b + :kill-session"
echo ""
echo "Press Enter to start..."
read

# Create new session
tmux new-session -d -s mcp-demo

# Create 3 panes layout
tmux split-window -h -t mcp-demo
tmux split-window -v -t mcp-demo:0.1

# Pane 0 (left): Main control
tmux send-keys -t mcp-demo:0.0 "cd /home/alejandro/Code/MCP/Hooks/Git/rins_hooks" C-m
tmux send-keys -t mcp-demo:0.0 "clear" C-m
tmux send-keys -t mcp-demo:0.0 "echo '==== MCP CONTROL PANEL ====' " C-m
tmux send-keys -t mcp-demo:0.0 "echo 'Ready to run MCP commands'" C-m
tmux send-keys -t mcp-demo:0.0 "echo ''" C-m
tmux send-keys -t mcp-demo:0.0 "echo 'Try these commands:'" C-m
tmux send-keys -t mcp-demo:0.0 "echo '  ./demo-simple.sh'" C-m
tmux send-keys -t mcp-demo:0.0 "echo '  ./mcp-control.sh'" C-m
tmux send-keys -t mcp-demo:0.0 "echo ''" C-m

# Pane 1 (top-right): MCP server running
tmux send-keys -t mcp-demo:0.1 "cd /home/alejandro/Code/MCP/Hooks/Git/rins_hooks" C-m
tmux send-keys -t mcp-demo:0.1 "clear" C-m
tmux send-keys -t mcp-demo:0.1 "echo '==== MCP SERVER STATUS ====' " C-m
tmux send-keys -t mcp-demo:0.1 "echo 'Testing Rapala MCP...'" C-m
tmux send-keys -t mcp-demo:0.1 "echo ''" C-m
tmux send-keys -t mcp-demo:0.1 'echo '"'"'{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"1.0","capabilities":{},"clientInfo":{"name":"test","version":"1.0"}}}'"'"' | node src/mcp/rapala-mcp.mjs 2>/dev/null | jq -r ".result.serverInfo"' C-m

# Pane 2 (bottom-right): Process monitor  
tmux send-keys -t mcp-demo:0.2 "cd /home/alejandro/Code/MCP/Hooks/Git/rins_hooks" C-m
tmux send-keys -t mcp-demo:0.2 "clear" C-m
tmux send-keys -t mcp-demo:0.2 "echo '==== PROCESS MONITOR ====' " C-m
tmux send-keys -t mcp-demo:0.2 "watch -n 2 'ps aux | grep -E \"(mcp|agent)\" | grep -v grep | head -5'" C-m

# Attach to session
tmux attach-session -t mcp-demo