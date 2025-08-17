# 🚀 Rapala MCP Integration System

Complete Model Context Protocol (MCP) integration for Claude, supporting stdio, SSE, and HTTP transports.

## 📋 Overview

The Rapala MCP system provides:
- **MCP Registry**: Catalog of available MCP servers
- **Connection Manager**: Multi-transport support (stdio, SSE, HTTP)
- **Process Manager**: Lifecycle management with health monitoring
- **Rapala MCP Server**: Exposes hooks as MCP tools via stdio
- **MCP Launcher**: Manages multiple MCPs for Claude

## 🎯 Quick Start

### 1. Setup Claude Integration

```bash
# One-command setup
./bin/rapala-mcp setup-claude

# This will:
# - Configure Claude settings.json
# - Setup Rapala MCP server
# - Optionally add other MCP servers
```

### 2. Restart Claude Code

After setup, restart Claude Code to load the MCP servers.

### 3. Use MCP Tools

In Claude, you can now use tools like:
- `rapala.hook.list` - List all hooks
- `rapala.mcp.start` - Start an MCP server
- `rapala.statusline.apply` - Apply status line template

## 📡 Available MCP Servers

### Built-in MCPs

| Name | Description | Transport | Requirements |
|------|-------------|-----------|--------------|
| `rapala` | Rapala Hooks System | stdio | None |
| `filesystem` | File operations | stdio | npx |
| `github` | GitHub API | stdio | Token required |
| `postgres` | PostgreSQL | stdio | Connection string |
| `sqlite` | SQLite database | stdio | Database path |
| `memory` | Knowledge graph | stdio | None |
| `time` | Time operations | stdio | None |
| `fetch` | HTTP client | stdio | None |

## 🛠️ CLI Commands

### Basic Operations

```bash
# List all MCPs
./bin/rapala-mcp list

# Start an MCP
./bin/rapala-mcp start filesystem

# Stop an MCP
./bin/rapala-mcp stop filesystem

# Get status
./bin/rapala-mcp status

# Install new MCP
./bin/rapala-mcp install
```

### Configuration

```bash
# Configure an MCP
./bin/rapala-mcp configure github

# Create a profile (group of MCPs)
./bin/rapala-mcp profile-create development

# Start a profile
./bin/rapala-mcp profile-start development
```

### Discovery

```bash
# Discover MCP capabilities
./bin/rapala-mcp discover filesystem
```

## 🏗️ Architecture

### Component Structure

```
src/mcp/
├── MCPRegistry.js         # MCP catalog and metadata
├── MCPConnectionManager.js # Transport handling
├── MCPProcessManager.js   # Lifecycle management
├── MCPManager.js          # Main interface
├── MCPLauncher.js         # Claude launcher
└── RapalaMCPServer.js     # Rapala stdio server
```

### Transport Types

#### stdio (Standard I/O)
- Most common transport
- Process-based communication
- JSON-RPC over stdin/stdout

```javascript
{
  name: 'my-mcp',
  transport: 'stdio',
  command: 'node',
  args: ['server.js'],
  env: { API_KEY: '$MY_API_KEY' }
}
```

#### HTTP
- REST-based communication
- Stateless requests
- Good for remote servers

```javascript
{
  name: 'my-api',
  transport: 'http',
  url: 'https://api.example.com/mcp',
  headers: { 'Authorization': 'Bearer $TOKEN' }
}
```

#### SSE (Server-Sent Events)
- One-way server push
- Real-time updates
- Event streaming

```javascript
{
  name: 'events',
  transport: 'sse',
  url: 'https://events.example.com/stream'
}
```

## 🎣 Rapala MCP Server

The Rapala MCP Server exposes the entire hooks system as MCP tools.

### Available Tools

| Tool | Description |
|------|-------------|
| `rapala.hook.list` | List all hooks |
| `rapala.hook.enable` | Enable a hook |
| `rapala.hook.disable` | Disable a hook |
| `rapala.statusline.templates` | List status line templates |
| `rapala.statusline.apply` | Apply a template |
| `rapala.mcp.list` | List MCP servers |
| `rapala.mcp.start` | Start an MCP |
| `rapala.mcp.stop` | Stop an MCP |
| `rapala.mcp.status` | Get MCP status |
| `rapala.mcp.discover` | Discover capabilities |

### Available Resources

| Resource | Description |
|----------|-------------|
| `rapala://hooks` | Hook configurations |
| `rapala://statusline/templates` | Status line templates |
| `rapala://statusline/components` | Components list |
| `rapala://mcp/registry` | MCP registry |
| `rapala://mcp/status` | Current statuses |
| `rapala://config` | Rapala configuration |

### Available Prompts

| Prompt | Description |
|--------|-------------|
| `hook-creation` | Generate new hook code |
| `mcp-integration` | MCP integration guide |
| `statusline-design` | Design custom status line |

## 🔧 Custom MCP Development

### Creating a Custom MCP

1. **Create server file**:

```javascript
// my-mcp-server.js
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: false
});

rl.on('line', async (line) => {
  const message = JSON.parse(line);
  
  if (message.method === 'initialize') {
    process.stdout.write(JSON.stringify({
      jsonrpc: '2.0',
      id: message.id,
      result: {
        protocolVersion: '1.0.0',
        capabilities: { tools: true }
      }
    }) + '\n');
  }
  // Handle other methods...
});
```

2. **Register with Rapala**:

```javascript
{
  name: 'my-mcp',
  displayName: 'My Custom MCP',
  transport: 'stdio',
  command: 'node',
  args: ['my-mcp-server.js'],
  category: 'custom'
}
```

3. **Add to Claude**:

```bash
./bin/rapala-mcp install
# Select "Add custom MCP..."
# Follow prompts
```

## 🏃 Launch Configuration

### Default Launch Config

Located at `~/.rapala/mcp-launch.json`:

```json
{
  "version": "1.0",
  "servers": [
    {
      "name": "rapala",
      "enabled": true,
      "autoRestart": true
    },
    {
      "name": "filesystem",
      "enabled": true,
      "configurable": {
        "allowedDirectories": ["$CWD"]
      }
    }
  ],
  "monitoring": {
    "enabled": true,
    "interval": 30000,
    "healthCheck": true
  }
}
```

### Project Overrides

Create `.rapala/mcp-config.json` in your project:

```json
{
  "projectOverrides": {
    "/path/to/project": {
      "filesystem": {
        "allowedDirectories": ["./src", "./docs"]
      }
    }
  }
}
```

## 🔍 Health Monitoring

The system includes automatic health monitoring:

- Health checks every 30 seconds
- Auto-restart on failure (configurable)
- Maximum 3 restart attempts
- Metrics tracking (requests, responses, errors)

## 🚨 Troubleshooting

### MCP Won't Start

```bash
# Check status
./bin/rapala-mcp status my-mcp

# View logs
tail -f ~/.rapala/logs/mcp.log

# Try manual start
./bin/rapala-mcp start my-mcp --debug
```

### Connection Issues

```bash
# Test connection
./bin/rapala-mcp discover my-mcp

# Reconfigure
./bin/rapala-mcp configure my-mcp
```

### Claude Not Finding MCPs

1. Check settings.json:
```bash
cat ~/.claude/settings.json | jq .mcpServers
```

2. Verify launcher:
```bash
node src/mcp/MCPLauncher.js --launch
```

3. Restart Claude Code

## 📝 Examples

### Add GitHub MCP

```bash
# Configure GitHub token
./bin/rapala-mcp configure github
# Enter your GitHub Personal Access Token

# Start GitHub MCP
./bin/rapala-mcp start github

# Use in Claude
# Tool: github.repos.list
```

### Create Development Profile

```bash
# Create profile with multiple MCPs
./bin/rapala-mcp profile-create dev
# Select: filesystem, github, sqlite

# Start all at once
./bin/rapala-mcp profile-start dev
```

### Custom Database MCP

```javascript
// Register custom database MCP
await manager.add({
  name: 'mydb',
  displayName: 'My Database',
  transport: 'stdio',
  command: 'python',
  args: ['db-mcp.py'],
  configurable: {
    connectionString: {
      type: 'string',
      required: true,
      secure: true
    }
  }
});
```

## 🎉 Complete Integration Example

```bash
# 1. Setup Claude integration
./bin/rapala-mcp setup-claude

# 2. Configure MCPs
./bin/rapala-mcp configure github
./bin/rapala-mcp configure postgres

# 3. Create profiles
./bin/rapala-mcp profile-create backend
./bin/rapala-mcp profile-create frontend

# 4. Start profile
./bin/rapala-mcp profile-start backend

# 5. Restart Claude Code
# Now you can use all MCP tools in Claude!
```

## 🔗 Related Documentation

- [MCP Specification](https://modelcontextprotocol.io)
- [Rapala Hooks Documentation](./HOOKS.md)
- [Status Line Documentation](./STATUSLINE.md)