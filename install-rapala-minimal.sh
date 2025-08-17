#!/bin/bash

# Minimal Rapala Installation Script
# Only installs router and command hooks for Claude

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${CYAN}╔══════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║  ${GREEN}Rapala Minimal Installation${CYAN}                ║${NC}"
echo -e "${CYAN}║  ${YELLOW}Router + Command Hooks Only${CYAN}                ║${NC}"
echo -e "${CYAN}╚══════════════════════════════════════════════╝${NC}"
echo ""

# Check Node.js
if ! command -v node &> /dev/null; then
    echo -e "${RED}Error: Node.js is not installed${NC}"
    exit 1
fi

# Get current directory
RAPALA_DIR="$(pwd)"

echo -e "${GREEN}Step 1: Installing dependencies...${NC}"
npm install

echo ""
echo -e "${GREEN}Step 2: Setting up Rapala for local use...${NC}"

# Make bin/rapala executable
chmod +x bin/rapala

echo ""
echo -e "${GREEN}Step 3: Enabling only router and command hooks...${NC}"

# Disable all hooks first
for hook_dir in hooks/*/; do
    if [ -f "$hook_dir/config.json" ]; then
        hook_name=$(basename "$hook_dir")
        node -e "
        const fs = require('fs-extra');
        const config = fs.readJsonSync('$hook_dir/config.json');
        config.disabled = true;
        fs.writeJsonSync('$hook_dir/config.json', config, {spaces: 2});
        console.log('  Disabled: $hook_name');
        " 2>/dev/null || true
    fi
done

# Enable only router and command hooks
echo ""
echo -e "${CYAN}Enabling essential hooks:${NC}"

# Enable router hook
if [ -f "hooks/claude-router/config.json" ]; then
    node -e "
    const fs = require('fs-extra');
    const config = fs.readJsonSync('hooks/claude-router/config.json');
    config.disabled = false;
    fs.writeJsonSync('hooks/claude-router/config.json', config, {spaces: 2});
    console.log('  ✅ Enabled: claude-router');
    " 2>/dev/null
fi

# Enable command hook
if [ -f "hooks/claude-command/config.json" ]; then
    node -e "
    const fs = require('fs-extra');
    const config = fs.readJsonSync('hooks/claude-command/config.json');
    config.disabled = false;
    fs.writeJsonSync('hooks/claude-command/config.json', config, {spaces: 2});
    console.log('  ✅ Enabled: claude-command');
    " 2>/dev/null
fi

echo ""
echo -e "${GREEN}Step 4: Setting up Claude integration...${NC}"

# Create claude alias that uses local rapala
CLAUDE_ALIAS="alias claude='$RAPALA_DIR/rapala claude'"

# Add to appropriate shell config
if [ -n "$ZSH_VERSION" ]; then
    SHELL_CONFIG="$HOME/.zshrc"
elif [ -n "$BASH_VERSION" ]; then
    SHELL_CONFIG="$HOME/.bashrc"
else
    SHELL_CONFIG="$HOME/.profile"
fi

# Check if alias already exists
if ! grep -q "alias claude=" "$SHELL_CONFIG" 2>/dev/null; then
    echo "" >> "$SHELL_CONFIG"
    echo "# Rapala Claude integration" >> "$SHELL_CONFIG"
    echo "$CLAUDE_ALIAS" >> "$SHELL_CONFIG"
    echo -e "  ${GREEN}✅ Added claude alias to $SHELL_CONFIG${NC}"
else
    echo -e "  ${YELLOW}⚠️  Claude alias already exists in $SHELL_CONFIG${NC}"
fi

echo ""
echo -e "${GREEN}Step 5: Setting up Rapala MCP server...${NC}"

# Check if MCP server is already in Claude settings
if [ -f "$HOME/.claude/settings.json" ]; then
    if grep -q "rapala" "$HOME/.claude/settings.json" 2>/dev/null; then
        echo -e "  ${YELLOW}⚠️  Rapala MCP already configured in Claude${NC}"
    else
        # Add Rapala MCP to Claude settings
        node -e "
        const fs = require('fs-extra');
        const settings = fs.readJsonSync('$HOME/.claude/settings.json');
        if (!settings.mcpServers) settings.mcpServers = {};
        settings.mcpServers.rapala = {
            command: 'node',
            args: ['$RAPALA_DIR/src/mcp/rapala-mcp.mjs'],
            env: {}
        };
        fs.writeJsonSync('$HOME/.claude/settings.json', settings, {spaces: 2});
        console.log('  ✅ Added Rapala MCP to Claude settings');
        " 2>/dev/null || echo -e "  ${RED}❌ Failed to add MCP to Claude settings${NC}"
    fi
else
    echo -e "  ${YELLOW}⚠️  Claude settings not found. Add manually later.${NC}"
fi

echo ""
echo -e "${CYAN}═══════════════════════════════════════════════${NC}"
echo -e "${GREEN}✅ Installation Complete!${NC}"
echo -e "${CYAN}═══════════════════════════════════════════════${NC}"
echo ""
echo -e "${YELLOW}Enabled hooks:${NC}"
echo "  • claude-router - Routes commands through Rapala"
echo "  • claude-command - Handles command execution"
echo ""
echo -e "${YELLOW}Next steps:${NC}"
echo "  1. Reload your shell or run: source $SHELL_CONFIG"
echo "  2. Test with: claude --version"
echo "  3. Use Claude normally - it will route through Rapala"
echo ""
echo -e "${YELLOW}To manage hooks:${NC}"
echo "  • List hooks: ./rapala hook list"
echo "  • Enable hook: ./rapala hook enable <name>"
echo "  • Disable hook: ./rapala hook disable <name>"
echo ""
echo -e "${YELLOW}To use MCP features:${NC}"
echo "  • Interactive control: ./mcp-control.sh"
echo "  • In Claude: /mcp rapala"
echo ""
echo -e "${CYAN}No global installation needed! Everything runs locally.${NC}"