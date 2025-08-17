# Generic MCP Management System

The Rapala MCP server now includes a comprehensive generic MCP management system that allows you to add, configure, and manage ANY MCP server - not just predefined ones.

## Available Tools

### 1. `mcp-start` - Start ANY MCP Server
Start any MCP server with custom configuration:

```json
{
  "name": "my-server",          // Unique identifier
  "transport": "stdio",         // Transport type: stdio, http, or sse
  "command": "python",          // Command to execute
  "args": ["server.py"],        // Command arguments
  "env": {"API_KEY": "xxx"},    // Environment variables
  "port": 3000,                 // Port for HTTP/SSE servers
  "projectDir": "/path/to/dir"  // Working directory
}
```

Examples:
- **stdio server**: `command: "npx", args: ["-y", "@modelcontextprotocol/server-filesystem", "/"]`
- **HTTP server**: `command: "agent-mcp", args: ["--port", "3001"], port: 3001`
- **Python server**: `command: "python", args: ["my_mcp_server.py"]`

### 2. `mcp-stop` - Stop Running MCP Server
Stop any running MCP server by name:

```json
{
  "name": "my-server"
}
```

### 3. `mcp-list` - List MCP Servers
Lists all:
- Currently running MCP servers with their status
- Available/installed MCP packages
- Discovered MCP servers from registry

### 4. `mcp-add-to-claude` - Add to Claude Configuration
Add any MCP server to Claude's settings.json:

```json
{
  "name": "custom-server",
  "transport": "stdio",
  "command": "node",
  "args": ["server.js"],
  "env": {"TOKEN": "xxx"}
}
```

Or for HTTP/SSE:
```json
{
  "name": "http-server",
  "transport": "http",
  "url": "http://localhost:3000/mcp",
  "env": {"API_KEY": "xxx"}
}
```

### 5. `mcp-remove-from-claude` - Remove from Claude
Remove an MCP server from Claude's configuration:

```json
{
  "name": "custom-server"
}
```

### 6. `mcp-quick-add` - Quick Add Known Servers
Quickly add known MCP servers with presets:

```json
{
  "preset": "filesystem",  // or github, sqlite, memory, etc.
  "name": "my-fs",        // Optional custom name
  "env": {}               // Required environment variables
}
```

Available presets:
- `agent-mcp` - Multi-agent collaboration
- `filesystem` - File system access
- `github` - GitHub API (requires GITHUB_PERSONAL_ACCESS_TOKEN)
- `gitlab` - GitLab API
- `google-drive` - Google Drive access
- `postgres` - PostgreSQL database
- `sqlite` - SQLite database
- `google-maps` - Google Maps API
- `slack` - Slack workspace
- `memory` - Knowledge graph memory
- `puppeteer` - Browser automation
- `brave-search` - Brave search API
- `fetch` - Web content fetching

## Usage Examples

### Add Custom Python MCP Server

```bash
# 1. Start the server
mcp-start with:
- name: "my-python-mcp"
- transport: "stdio"
- command: "python"
- args: ["/path/to/my_server.py"]
- env: {"OPENAI_API_KEY": "sk-..."}

# 2. Add to Claude
mcp-add-to-claude with same configuration

# 3. Restart Claude to load the new server
```

### Add Custom Node.js HTTP Server

```bash
# 1. Start HTTP server
mcp-start with:
- name: "my-http-mcp"
- transport: "http"
- command: "node"
- args: ["server.js", "--port", "8080"]
- port: 8080

# 2. Add to Claude with URL
mcp-add-to-claude with:
- name: "my-http-mcp"
- transport: "http"
- url: "http://localhost:8080/mcp"
```

### Quick Add Official MCP Servers

```bash
# Add filesystem MCP
mcp-quick-add with preset: "filesystem"

# Add GitHub MCP with token
mcp-quick-add with:
- preset: "github"
- env: {"GITHUB_PERSONAL_ACCESS_TOKEN": "ghp_..."}

# Add SQLite MCP with custom database
mcp-quick-add with:
- preset: "sqlite"
- name: "my-database"
```

## Transport Types

### stdio (Standard I/O)
- Communication via stdin/stdout
- Most common for local servers
- Example: filesystem, github MCPs

### HTTP
- RESTful or streaming HTTP endpoints
- Good for remote servers
- Example: agent-mcp

### SSE (Server-Sent Events)
- Real-time streaming over HTTP
- Good for event-driven servers
- Example: monitoring MCPs

## Integration with Existing Infrastructure

The generic MCP management integrates with:

1. **MCPRegistry** - Discovers and catalogs MCP servers
2. **MCPConnectionManager** - Handles multi-transport connections
3. **MCPProcessManager** - Manages server lifecycles
4. **Claude Settings** - Automatic configuration updates

## Advanced Features

### Dynamic Discovery
The system can discover MCP servers from:
- npm global packages
- Local node_modules
- System PATH
- Custom registries

### Environment Variable Management
- Pass any environment variables to MCP servers
- Support for API keys, tokens, configurations
- Secure handling of sensitive data

### Process Management
- Automatic restart on failure
- Graceful shutdown
- Resource monitoring
- Multiple instance support

## Troubleshooting

### Server Won't Start
- Check command exists in PATH
- Verify required environment variables
- Check port availability for HTTP/SSE
- Review server logs in stderr

### Claude Doesn't See Server
- Restart Claude after adding configuration
- Verify server is running (`mcp-list`)
- Check transport type matches configuration
- Validate URL format for HTTP/SSE

### Connection Issues
- stdio: Check process is running
- HTTP: Verify port and firewall
- SSE: Check CORS configuration

## Creating Your Own MCP Server

To create a custom MCP server that works with this system:

1. Implement the MCP protocol (tools, resources, prompts)
2. Choose transport type (stdio recommended for simplicity)
3. Handle initialization and capability negotiation
4. Register with Rapala using `mcp-add-to-claude`

Example minimal Node.js stdio server:
```javascript
#!/usr/bin/env node
const { McpServer } = require("@modelcontextprotocol/sdk/server/mcp.js");
const { StdioServerTransport } = require("@modelcontextprotocol/sdk/server/stdio.js");

const server = new McpServer({
  name: "my-custom-mcp",
  version: "1.0.0"
});

// Add your tools here
server.tool("my-tool", "Description", schema, handler);

const transport = new StdioServerTransport();
server.connect(transport);
```

## Summary

The generic MCP management system in Rapala provides complete flexibility to:
- Add ANY MCP server (not just predefined ones)
- Support all transport types (stdio, HTTP, SSE)
- Manage server lifecycles
- Configure Claude automatically
- Pass custom environment variables
- Work with any programming language

This makes Rapala a universal MCP hub that can integrate with any Model Context Protocol server, regardless of implementation language, transport type, or functionality.