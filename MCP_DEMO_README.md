# 🚀 Rapala Generic MCP Management - Interactive Demo

## Quick Start

```bash
# Launch the full tmux demo
./demo-mcp-tmux.sh

# Or use the interactive control center
./mcp-control.sh
```

## What You'll See in the Tmux Demo

The demo creates a 4-pane tmux session showing:

```
┌──────────────────┬──────────────────┐
│  Claude CLI      │  MCP Monitor     │
│  with Rapala     │  (live processes)│
├──────────────────┼──────────────────┤
│  MCP Control     │  Test Area       │
│  (commands)      │  (direct tests)  │
└──────────────────┴──────────────────┘
```

### Pane 1: Claude CLI (Top-Left)
- Shows how to use Claude with Rapala MCP
- Test commands: `/mcp rapala`, `/mcp list`

### Pane 2: MCP Monitor (Top-Right)
- Live monitoring of MCP processes
- Shows active ports (3000, 3001, 8080)
- Updates every 2 seconds

### Pane 3: MCP Control (Bottom-Left)
- Ready-to-run commands for MCP management
- List, start, stop, add servers

### Pane 4: Test Area (Bottom-Right)
- Direct JSON-RPC testing
- Shows available tools
- Live interaction with Rapala MCP

## Tmux Navigation

- **Switch panes**: `Ctrl+b` then arrow keys
- **Scroll in pane**: `Ctrl+b` then `[` (press `q` to exit scroll)
- **Exit demo**: Type `exit` or `Ctrl+b` then `:kill-session`

## Test Scripts

### 1. List Available MCPs
```bash
./test-mcp-list.sh
```
Shows:
- Running MCP servers
- Installed MCP packages
- Available presets

### 2. Start Agent-MCP
```bash
./test-mcp-start-agent.sh
```
- Starts agent-mcp on port 3001
- Shows connection info
- Provides Claude integration commands

### 3. Add Custom MCP
```bash
./test-mcp-add-custom.sh
```
Interactive menu to add:
- Filesystem MCP
- GitHub MCP (with token)
- Memory MCP
- SQLite MCP
- Custom Python/Node.js MCPs

### 4. Interactive Control Center
```bash
./mcp-control.sh
```
Full menu-driven interface for:
- Managing MCP servers
- Adding to Claude
- Testing connections
- Viewing documentation

## Live Demo Workflow

### Step 1: Launch Tmux Session
```bash
./demo-mcp-tmux.sh
```

### Step 2: In Control Pane (Bottom-Left)
```bash
# List available MCPs
./test-mcp-list.sh

# Start agent-mcp
./test-mcp-start-agent.sh
```

### Step 3: In Test Pane (Bottom-Right)
```bash
# Test direct JSON-RPC
echo '{"jsonrpc":"2.0","method":"tools/call","params":{"name":"mcp-list","arguments":{}},"id":1}' | \
  node src/mcp/rapala-mcp.mjs 2>/dev/null | jq '.result.content[0].text'
```

### Step 4: In Claude Pane (Top-Left)
```bash
# Start Claude with Rapala
claude

# In Claude, test MCP
/mcp rapala
```

## Example: Adding Custom Python MCP

### 1. Create Python MCP Server
```python
#!/usr/bin/env python3
# my_mcp.py
import sys
import json

def handle_request(request):
    method = request.get('method')
    if method == 'initialize':
        return {
            'protocolVersion': '1.0',
            'serverInfo': {'name': 'my-python-mcp'}
        }
    # Add more handlers...

while True:
    line = sys.stdin.readline()
    if not line:
        break
    request = json.loads(line)
    response = handle_request(request)
    print(json.dumps(response))
```

### 2. Add to Claude via Rapala
```bash
# In the control center
./mcp-control.sh
# Select option 5 (Add Custom MCP)
# Choose Python, enter path to my_mcp.py
```

### 3. Test in Claude
```bash
claude
/mcp my-python-mcp
```

## Example: Quick Add Presets

### Add Filesystem MCP
```bash
echo '{"jsonrpc":"2.0","method":"tools/call","params":{"name":"mcp-quick-add","arguments":{"preset":"filesystem"}},"id":1}' | \
  node src/mcp/rapala-mcp.mjs
```

### Add GitHub MCP with Token
```bash
echo '{"jsonrpc":"2.0","method":"tools/call","params":{"name":"mcp-quick-add","arguments":{"preset":"github","env":{"GITHUB_PERSONAL_ACCESS_TOKEN":"ghp_xxxx"}}},"id":1}' | \
  node src/mcp/rapala-mcp.mjs
```

## Advanced: Custom HTTP Server

### 1. Start HTTP MCP
```json
{
  "name": "my-http-mcp",
  "transport": "http",
  "command": "node",
  "args": ["server.js", "--port", "8080"],
  "port": 8080
}
```

### 2. Add to Claude
```json
{
  "name": "my-http-mcp",
  "transport": "http",  
  "url": "http://localhost:8080/mcp"
}
```

## Monitoring & Debugging

### Check Running Servers
```bash
# Via Rapala
./test-mcp-list.sh

# Via system
ps aux | grep mcp
netstat -tuln | grep -E ":(3000|3001|8080)"
```

### View Claude Settings
```bash
cat ~/.claude/settings.json | jq '.mcpServers'
```

### Test MCP Connection
```bash
# Test Rapala itself
echo '{"jsonrpc":"2.0","method":"tools/call","params":{"name":"rapala-test","arguments":{}},"id":1}' | \
  node src/mcp/rapala-mcp.mjs
```

## Troubleshooting

### MCP Not Starting
- Check if command exists: `which <command>`
- Check port availability: `lsof -i :3001`
- View errors: Run command manually

### Claude Not Seeing MCP
- Restart Claude after adding
- Check settings.json format
- Verify server is running

### Connection Issues
- stdio: Check process is alive
- HTTP: Test with curl: `curl http://localhost:3001/health`
- Check firewall/permissions

## Key Features Demonstrated

✅ **Universal MCP Support** - Add ANY server, any language
✅ **Multi-Transport** - stdio, HTTP, SSE
✅ **Process Management** - Start, stop, monitor
✅ **Claude Integration** - Automatic config updates
✅ **Environment Variables** - API keys, custom config
✅ **Quick Presets** - One-command setup for known MCPs
✅ **Live Monitoring** - See processes and ports
✅ **Interactive Testing** - Direct JSON-RPC interaction

## Next Steps

1. **Try the demo**: `./demo-mcp-tmux.sh`
2. **Add your first MCP**: `./mcp-control.sh`
3. **Test in Claude**: `/mcp rapala`
4. **Create custom MCP**: Follow examples above
5. **Read full docs**: `docs/GENERIC_MCP_MANAGEMENT.md`

## Summary

This demo shows how Rapala's generic MCP management system provides complete flexibility to add and manage ANY MCP server - not just predefined ones. It's a universal hub for Model Context Protocol servers in Claude!