#!/usr/bin/env node

const { spawn } = require('child_process');
const readline = require('readline');

// Colors
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  bold: '\x1b[1m'
};

// Call MCP tool
async function callTool(toolName, args = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn('node', ['src/mcp/rapala-mcp.mjs'], {
      stdio: ['pipe', 'pipe', 'pipe']
    });
    
    let output = '';
    
    child.stdout.on('data', (data) => {
      output += data.toString();
    });
    
    child.on('close', () => {
      try {
        const lines = output.trim().split('\n');
        for (const line of lines) {
          if (line.startsWith('{')) {
            const response = JSON.parse(line);
            if (response.result && response.result.content) {
              resolve(response.result.content[0].text);
              return;
            }
          }
        }
        resolve('No response');
      } catch (e) {
        resolve('Error: ' + e.message);
      }
    });
    
    // Send initialize
    child.stdin.write(JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: "1.0",
        capabilities: {},
        clientInfo: { name: "demo", version: "1.0" }
      }
    }) + '\n');
    
    // Send tool call
    setTimeout(() => {
      child.stdin.write(JSON.stringify({
        jsonrpc: "2.0",
        id: 2,
        method: "tools/call",
        params: {
          name: toolName,
          arguments: args
        }
      }) + '\n');
      
      setTimeout(() => {
        child.stdin.end();
      }, 100);
    }, 100);
  });
}

// Clear screen
function clear() {
  console.clear();
}

// Print header
function printHeader() {
  console.log(colors.cyan + '═'.repeat(65) + colors.reset);
  console.log(colors.cyan + '║' + colors.white + colors.bold + '     Rapala Generic MCP Management System - Live Demo' + ' '.repeat(8) + colors.reset + colors.cyan + '║' + colors.reset);
  console.log(colors.cyan + '═'.repeat(65) + colors.reset);
  console.log();
}

// Print menu
function printMenu() {
  console.log(colors.yellow + 'Select an option:' + colors.reset);
  console.log();
  console.log('  1. ' + colors.green + 'Test Rapala Connection' + colors.reset);
  console.log('  2. ' + colors.blue + 'List Available MCP Servers' + colors.reset);
  console.log('  3. ' + colors.magenta + 'List Rapala Hooks' + colors.reset);
  console.log('  4. ' + colors.yellow + 'View System Status' + colors.reset);
  console.log('  5. ' + colors.cyan + 'Start Agent-MCP Server' + colors.reset);
  console.log('  6. ' + colors.green + 'Quick Add MCP Preset' + colors.reset);
  console.log('  7. ' + colors.blue + 'Add Custom MCP Server' + colors.reset);
  console.log('  8. ' + colors.magenta + 'Stop MCP Server' + colors.reset);
  console.log('  9. ' + colors.white + 'Help & Documentation' + colors.reset);
  console.log('  0. ' + colors.red + 'Exit' + colors.reset);
  console.log();
}

// Create readline interface
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Ask question
function ask(question) {
  return new Promise(resolve => {
    rl.question(question, resolve);
  });
}

// Wait for enter
async function waitForEnter() {
  await ask('\nPress Enter to continue...');
}

// Main menu loop
async function main() {
  while (true) {
    clear();
    printHeader();
    printMenu();
    
    const choice = await ask('Enter choice (0-9): ');
    console.log();
    
    switch (choice) {
      case '1':
        console.log(colors.green + 'Testing Rapala Connection...' + colors.reset);
        console.log('─'.repeat(40));
        const testResult = await callTool('rapala-test');
        console.log(testResult);
        await waitForEnter();
        break;
        
      case '2':
        console.log(colors.blue + 'Listing MCP Servers...' + colors.reset);
        console.log('─'.repeat(40));
        const listResult = await callTool('mcp-list');
        console.log(listResult);
        await waitForEnter();
        break;
        
      case '3':
        console.log(colors.magenta + 'Listing Rapala Hooks...' + colors.reset);
        console.log('─'.repeat(40));
        const hooksResult = await callTool('rapala-hook-list');
        console.log(hooksResult);
        await waitForEnter();
        break;
        
      case '4':
        console.log(colors.yellow + 'System Status...' + colors.reset);
        console.log('─'.repeat(40));
        const statusResult = await callTool('rapala-status');
        console.log(statusResult);
        await waitForEnter();
        break;
        
      case '5':
        console.log(colors.cyan + 'Starting Agent-MCP Server...' + colors.reset);
        console.log('─'.repeat(40));
        const startResult = await callTool('mcp-start', {
          name: 'agent-mcp',
          transport: 'http',
          command: 'agent-mcp',
          args: ['--port', '3001'],
          port: 3001
        });
        console.log(startResult);
        await waitForEnter();
        break;
        
      case '6':
        console.log(colors.green + 'Quick Add MCP Preset' + colors.reset);
        console.log('─'.repeat(40));
        console.log('Available presets:');
        console.log('  1. filesystem');
        console.log('  2. github');
        console.log('  3. memory');
        console.log('  4. sqlite');
        const preset = await ask('Enter preset name: ');
        const name = await ask('Enter custom name (or press Enter): ');
        
        const quickAddArgs = { preset };
        if (name) quickAddArgs.name = name;
        
        const quickAddResult = await callTool('mcp-quick-add', quickAddArgs);
        console.log(quickAddResult);
        await waitForEnter();
        break;
        
      case '7':
        console.log(colors.blue + 'Add Custom MCP Server' + colors.reset);
        console.log('─'.repeat(40));
        const serverName = await ask('Server name: ');
        const transport = await ask('Transport (stdio/http/sse): ');
        
        if (transport === 'stdio') {
          const command = await ask('Command: ');
          const argsStr = await ask('Arguments (space-separated): ');
          const args = argsStr ? argsStr.split(' ') : [];
          
          const addResult = await callTool('mcp-add-to-claude', {
            name: serverName,
            transport,
            command,
            args
          });
          console.log(addResult);
        } else {
          const url = await ask('Server URL: ');
          const addResult = await callTool('mcp-add-to-claude', {
            name: serverName,
            transport,
            url
          });
          console.log(addResult);
        }
        await waitForEnter();
        break;
        
      case '8':
        console.log(colors.magenta + 'Stop MCP Server' + colors.reset);
        console.log('─'.repeat(40));
        const stopName = await ask('Enter server name to stop: ');
        const stopResult = await callTool('mcp-stop', { name: stopName });
        console.log(stopResult);
        await waitForEnter();
        break;
        
      case '9':
        console.log(colors.white + 'Help & Documentation' + colors.reset);
        console.log('─'.repeat(40));
        console.log(`
The Rapala Generic MCP Management System allows you to:

• Add ANY MCP server (Python, Node.js, Go, etc.)
• Support all transport types (stdio, HTTP, SSE)
• Automatically configure Claude settings
• Manage server lifecycles (start/stop/monitor)

Key Commands in Claude:
  /mcp rapala         - Access Rapala MCP tools
  /mcp list          - List available MCP servers
  /mcp <server-name> - Use specific MCP server

Examples:
  - Add Python MCP: command="python", args=["server.py"]
  - Add HTTP MCP: url="http://localhost:3000/mcp"
  - Quick presets: filesystem, github, memory, sqlite

Documentation: docs/GENERIC_MCP_MANAGEMENT.md
        `);
        await waitForEnter();
        break;
        
      case '0':
        console.log(colors.green + 'Goodbye!' + colors.reset);
        rl.close();
        process.exit(0);
        break;
        
      default:
        console.log(colors.red + 'Invalid choice!' + colors.reset);
        await waitForEnter();
    }
  }
}

// Start
console.log(colors.cyan + 'Starting Rapala MCP Demo...' + colors.reset);
main().catch(err => {
  console.error(colors.red + 'Error: ' + err.message + colors.reset);
  rl.close();
  process.exit(1);
});