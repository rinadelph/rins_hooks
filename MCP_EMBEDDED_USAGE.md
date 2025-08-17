# 🎣 Rapala MCP Management - Now Embedded!

MCP (Model Context Protocol) management is now fully integrated into Rapala. No need for separate scripts or tools - everything is accessible through the `rapala` command.

## Quick Start

```bash
# Interactive MCP Manager (recommended)
rapala mcpm

# Or use the shorter alias
rapala mcp
```

## Command Line Usage

### List MCP Servers
```bash
rapala mcpm -l
# Shows running servers and available packages
```

### Start MCP Server
```bash
rapala mcpm -s agent-mcp
# Starts the specified MCP server
```

### Stop MCP Server
```bash
rapala mcpm -x agent-mcp
# Stops the running server
```

### Quick Add Preset MCP
```bash
rapala mcpm -a filesystem
# Adds filesystem MCP to Claude

# Available presets:
# - filesystem (file system access)
# - github (GitHub API)
# - memory (knowledge graph)
# - sqlite (SQLite database)
# - postgres (PostgreSQL)
```

### Add Custom MCP
```bash
rapala mcpm -c
# Interactive prompt to add custom MCP server
# Supports Python, Node.js, Go, any language
```

### Remove MCP from Claude
```bash
rapala mcpm -r server-name
# Removes MCP from Claude settings
```

### System Status
```bash
rapala mcpm --status
# Shows MCP system status
```

## Interactive Mode Features

When you run `rapala mcpm` without options, you get an interactive menu:

```
╔══════════════════════════════════════════════════════════════╗
║            MCP Manager - Model Context Protocol              ║
║            Manage ANY MCP server from Rapala                 ║
╚══════════════════════════════════════════════════════════════╝

? What would you like to do?
  📋 List MCP Servers
  🚀 Start MCP Server
  ⏹️  Stop MCP Server
  ➕ Quick Add Preset MCP
  🔧 Add Custom MCP Server
  🗑️  Remove MCP from Claude
  📊 System Status
  📚 Documentation
  ────────────
  Exit
```

## Examples

### Add Python MCP Server
```bash
rapala mcpm -c
# Select: stdio transport
# Enter: python
# Args: server.py
```

### Add agent-mcp and Start It
```bash
# Add to Claude
rapala mcpm -a agent-mcp

# Start the server
rapala mcpm -s agent-mcp

# Verify it's running
rapala mcpm -l
```

### Add GitHub MCP with Token
```bash
rapala mcpm
# Select: Quick Add Preset MCP
# Choose: github
# Enter your GitHub token when prompted
```

## Integration with Claude

After adding an MCP server:
1. Restart Claude for changes to take effect
2. Use `/mcp list` in Claude to see available servers
3. Use `/mcp <server-name>` to interact with specific MCP
4. Use `/mcp rapala` to access Rapala's MCP tools

## Key Benefits

✅ **Fully Embedded** - No separate commands needed
✅ **Universal Support** - Add ANY MCP server
✅ **Multi-Language** - Python, Node.js, Go, Rust, etc.
✅ **All Transports** - stdio, HTTP, SSE
✅ **Process Management** - Start/stop/monitor servers
✅ **Claude Integration** - Automatic settings updates

## Advanced Usage

### Custom HTTP Server
```bash
rapala mcpm -c
# Select: http transport
# Enter URL: http://localhost:8080/mcp
```

### Environment Variables
```bash
rapala mcpm -c
# After basic config, choose to add env vars
# Enter key-value pairs for API keys, tokens, etc.
```

### Working Directory
```bash
rapala mcpm
# In interactive mode, you can specify project directory
# Useful for project-specific MCPs
```

## Troubleshooting

### MCP Not Starting
- Check if command exists: `which <command>`
- Verify port availability for HTTP/SSE
- Check logs: MCP errors appear in stderr

### Claude Not Seeing MCP
- Restart Claude after adding
- Check `~/.claude/settings.json` has mcpServers
- Verify server is running: `rapala mcpm -l`

## Summary

MCP management is now a first-class citizen in Rapala. Simply use:
- `rapala mcpm` for interactive management
- `rapala mcpm -<option>` for quick CLI operations
- No need for separate scripts or tools!

The entire generic MCP management system is embedded and ready to use.