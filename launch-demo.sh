#!/bin/bash

echo "🚀 Rapala MCP Demo Launcher"
echo "==========================="
echo ""
echo "Choose demo type:"
echo ""
echo "1. Interactive Node.js Demo (Recommended)"
echo "   Full menu-driven interface with all features"
echo ""
echo "2. Simple Bash Demo" 
echo "   Step-by-step walkthrough"
echo ""
echo "3. Tmux Multi-pane Demo"
echo "   Split-screen with monitoring"
echo ""
echo "4. Control Panel"
echo "   Bash menu system"
echo ""
read -p "Enter choice (1-4): " choice

case $choice in
    1)
        echo "Starting Interactive Demo..."
        node mcp-demo.js
        ;;
    2)
        echo "Starting Simple Demo..."
        ./demo-simple.sh
        ;;
    3)
        echo "Starting Tmux Demo..."
        ./demo-tmux-working.sh
        ;;
    4)
        echo "Starting Control Panel..."
        ./mcp-control.sh
        ;;
    *)
        echo "Invalid choice!"
        exit 1
        ;;
esac