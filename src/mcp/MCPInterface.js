const chalk = require('chalk');
const inquirer = require('inquirer');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs-extra');
const os = require('os');

/**
 * Interactive MCP Management Interface
 * Embedded into Rapala for seamless MCP control
 */
class MCPInterface {
  constructor(mcpManager) {
    this.manager = mcpManager || null;
    this.runningServers = new Map();
  }

  /**
   * Show interactive MCP management menu
   */
  async showInteractive() {
    console.clear();
    console.log(chalk.cyan('╔══════════════════════════════════════════════════════════════╗'));
    console.log(chalk.cyan('║') + chalk.white.bold('            MCP Manager - Model Context Protocol') + '             ' + chalk.cyan('║'));
    console.log(chalk.cyan('║') + chalk.gray('            Manage ANY MCP server from Rapala') + '                ' + chalk.cyan('║'));
    console.log(chalk.cyan('╚══════════════════════════════════════════════════════════════╝'));
    console.log();

    let exit = false;
    while (!exit) {
      const { action } = await inquirer.prompt([
        {
          type: 'list',
          name: 'action',
          message: 'What would you like to do?',
          choices: [
            { name: chalk.green('📋 List MCP Servers'), value: 'list' },
            { name: chalk.cyan('🚀 Start MCP Server'), value: 'start' },
            { name: chalk.yellow('⏹️  Stop MCP Server'), value: 'stop' },
            { name: chalk.blue('➕ Quick Add Preset MCP'), value: 'preset' },
            { name: chalk.magenta('🔧 Add Custom MCP Server'), value: 'custom' },
            { name: chalk.red('🗑️  Remove MCP from Claude'), value: 'remove' },
            { name: chalk.white('📊 System Status'), value: 'status' },
            { name: chalk.gray('📚 Documentation'), value: 'docs' },
            new inquirer.Separator(),
            { name: chalk.red('Exit'), value: 'exit' }
          ]
        }
      ]);

      switch (action) {
        case 'list':
          await this.listServers();
          break;
        case 'start':
          await this.startServer();
          break;
        case 'stop':
          await this.stopServer();
          break;
        case 'preset':
          await this.addPresetMCP();
          break;
        case 'custom':
          await this.addCustomMCP();
          break;
        case 'remove':
          await this.removeMCP();
          break;
        case 'status':
          await this.showStatus();
          break;
        case 'docs':
          await this.showDocs();
          break;
        case 'exit':
          exit = true;
          break;
      }

      if (!exit) {
        console.log();
        await this.waitForEnter();
      }
    }

    console.log(chalk.green('\n✨ Thank you for using Rapala MCP Manager!'));
  }

  /**
   * List all MCP servers
   */
  async listServers() {
    console.log(chalk.blue('\n📦 MCP Servers\n'));
    
    // Call Rapala MCP tool to list servers
    const result = await this.callRapalaTool('mcp-list', {});
    if (result) {
      console.log(result);
    } else {
      console.log(chalk.yellow('No response from MCP server'));
    }
  }

  /**
   * Start an MCP server
   */
  async startServer() {
    const choices = [
      { name: 'agent-mcp (Multi-agent collaboration)', value: 'agent-mcp' },
      { name: 'Custom stdio server', value: 'custom-stdio' },
      { name: 'Custom HTTP server', value: 'custom-http' },
      { name: 'Back', value: 'back' }
    ];

    const { server } = await inquirer.prompt([
      {
        type: 'list',
        name: 'server',
        message: 'Which MCP server to start?',
        choices
      }
    ]);

    if (server === 'back') return;

    let args = {};
    
    if (server === 'agent-mcp') {
      args = {
        name: 'agent-mcp',
        transport: 'http',
        command: 'agent-mcp',
        args: ['--port', '3001'],
        port: 3001
      };
    } else if (server === 'custom-stdio') {
      const answers = await inquirer.prompt([
        { name: 'name', message: 'Server name:' },
        { name: 'command', message: 'Command to execute:' },
        { name: 'args', message: 'Arguments (space-separated):' }
      ]);
      
      args = {
        name: answers.name,
        transport: 'stdio',
        command: answers.command,
        args: answers.args ? answers.args.split(' ') : []
      };
    } else if (server === 'custom-http') {
      const answers = await inquirer.prompt([
        { name: 'name', message: 'Server name:' },
        { name: 'command', message: 'Command to execute:' },
        { name: 'port', message: 'Port number:', validate: (v) => !isNaN(v) }
      ]);
      
      args = {
        name: answers.name,
        transport: 'http',
        command: answers.command,
        args: ['--port', answers.port],
        port: parseInt(answers.port)
      };
    }

    console.log(chalk.cyan('\nStarting MCP server...'));
    const result = await this.callRapalaTool('mcp-start', args);
    console.log(result || chalk.red('Failed to start server'));
  }

  /**
   * Stop an MCP server
   */
  async stopServer() {
    const { name } = await inquirer.prompt([
      {
        name: 'name',
        message: 'Enter server name to stop:'
      }
    ]);

    console.log(chalk.yellow('\nStopping MCP server...'));
    const result = await this.callRapalaTool('mcp-stop', { name });
    console.log(result || chalk.red('Failed to stop server'));
  }

  /**
   * Add preset MCP
   */
  async addPresetMCP() {
    const presets = [
      { name: 'filesystem - File system access', value: 'filesystem' },
      { name: 'github - GitHub API (requires token)', value: 'github' },
      { name: 'memory - Knowledge graph memory', value: 'memory' },
      { name: 'sqlite - SQLite database', value: 'sqlite' },
      { name: 'postgres - PostgreSQL database', value: 'postgres' },
      { name: 'puppeteer - Browser automation', value: 'puppeteer' },
      { name: 'brave-search - Brave search API', value: 'brave-search' },
      { name: 'fetch - Web content fetching', value: 'fetch' },
      { name: 'Back', value: 'back' }
    ];

    const { preset } = await inquirer.prompt([
      {
        type: 'list',
        name: 'preset',
        message: 'Select preset MCP:',
        choices: presets
      }
    ]);

    if (preset === 'back') return;

    const { customName } = await inquirer.prompt([
      {
        name: 'customName',
        message: 'Custom name (press Enter for default):'
      }
    ]);

    let env = {};
    
    // Check for required environment variables
    if (preset === 'github') {
      const { token } = await inquirer.prompt([
        {
          name: 'token',
          message: 'GitHub Personal Access Token:',
          type: 'password'
        }
      ]);
      env.GITHUB_PERSONAL_ACCESS_TOKEN = token;
    } else if (preset === 'brave-search') {
      const { apiKey } = await inquirer.prompt([
        {
          name: 'apiKey',
          message: 'Brave API Key:',
          type: 'password'
        }
      ]);
      env.BRAVE_API_KEY = apiKey;
    }

    console.log(chalk.cyan('\nAdding preset MCP to Claude...'));
    
    const args = { preset };
    if (customName) args.name = customName;
    if (Object.keys(env).length > 0) args.env = env;
    
    const result = await this.callRapalaTool('mcp-quick-add', args);
    console.log(result || chalk.red('Failed to add preset'));
  }

  /**
   * Add custom MCP server
   */
  async addCustomMCP() {
    const { transport } = await inquirer.prompt([
      {
        type: 'list',
        name: 'transport',
        message: 'Select transport type:',
        choices: [
          { name: 'stdio - Standard I/O', value: 'stdio' },
          { name: 'http - HTTP endpoint', value: 'http' },
          { name: 'sse - Server-Sent Events', value: 'sse' }
        ]
      }
    ]);

    const { name } = await inquirer.prompt([
      {
        name: 'name',
        message: 'MCP server name:',
        validate: (v) => v.length > 0
      }
    ]);

    let args = { name, transport };

    if (transport === 'stdio') {
      const answers = await inquirer.prompt([
        { name: 'command', message: 'Command to execute:' },
        { name: 'argsStr', message: 'Arguments (space-separated):' }
      ]);
      
      args.command = answers.command;
      args.args = answers.argsStr ? answers.argsStr.split(' ') : [];
    } else {
      const { url } = await inquirer.prompt([
        {
          name: 'url',
          message: 'Server URL:',
          validate: (v) => v.startsWith('http')
        }
      ]);
      args.url = url;
    }

    // Optional environment variables
    const { hasEnv } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'hasEnv',
        message: 'Add environment variables?',
        default: false
      }
    ]);

    if (hasEnv) {
      const env = {};
      let addMore = true;
      
      while (addMore) {
        const { key, value, more } = await inquirer.prompt([
          { name: 'key', message: 'Environment variable name:' },
          { name: 'value', message: 'Value:', type: 'password' },
          { type: 'confirm', name: 'more', message: 'Add another?', default: false }
        ]);
        
        env[key] = value;
        addMore = more;
      }
      
      args.env = env;
    }

    console.log(chalk.cyan('\nAdding custom MCP to Claude...'));
    const result = await this.callRapalaTool('mcp-add-to-claude', args);
    console.log(result || chalk.red('Failed to add custom MCP'));
  }

  /**
   * Remove MCP from Claude
   */
  async removeMCP() {
    const { name } = await inquirer.prompt([
      {
        name: 'name',
        message: 'Enter MCP server name to remove:'
      }
    ]);

    const { confirm } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'confirm',
        message: `Are you sure you want to remove "${name}" from Claude?`,
        default: false
      }
    ]);

    if (confirm) {
      console.log(chalk.yellow('\nRemoving MCP from Claude...'));
      const result = await this.callRapalaTool('mcp-remove-from-claude', { name });
      console.log(result || chalk.red('Failed to remove MCP'));
    }
  }

  /**
   * Show system status
   */
  async showStatus() {
    console.log(chalk.blue('\n📊 MCP System Status\n'));
    
    const result = await this.callRapalaTool('rapala-status', {});
    if (result) {
      console.log(result);
    }
    
    // Also show MCP-specific status
    const mcpList = await this.callRapalaTool('mcp-list', {});
    if (mcpList) {
      console.log('\n' + chalk.yellow('MCP Servers:'));
      console.log(mcpList.split('\n').slice(0, 10).join('\n'));
    }
  }

  /**
   * Show documentation
   */
  async showDocs() {
    console.log(chalk.white('\n📚 MCP Management Documentation\n'));
    console.log(`
${chalk.cyan('Overview:')}
The Rapala MCP Manager allows you to add ANY Model Context Protocol server
to Claude, not just predefined ones. It supports all transport types and
programming languages.

${chalk.green('Key Features:')}
• ${chalk.white('Universal Support')} - Python, Node.js, Go, Rust, any language
• ${chalk.white('Multi-Transport')} - stdio, HTTP, SSE
• ${chalk.white('Process Management')} - Start, stop, monitor servers
• ${chalk.white('Claude Integration')} - Automatic settings.json updates
• ${chalk.white('Environment Variables')} - API keys, custom configs

${chalk.yellow('Quick Commands:')}
  ${chalk.cyan('rapala mcpm')}          - Interactive interface (this menu)
  ${chalk.cyan('rapala mcpm -l')}       - List all MCP servers
  ${chalk.cyan('rapala mcpm -s agent-mcp')} - Start a server
  ${chalk.cyan('rapala mcpm -x agent-mcp')} - Stop a server
  ${chalk.cyan('rapala mcpm -a filesystem')} - Quick add preset
  ${chalk.cyan('rapala mcpm -c')}       - Add custom MCP
  ${chalk.cyan('rapala mcpm -r name')}  - Remove from Claude

${chalk.blue('Examples:')}
1. Add Python MCP: command="python", args=["server.py"]
2. Add HTTP MCP: url="http://localhost:3000/mcp"
3. Quick preset: rapala mcpm -a github

${chalk.magenta('Usage in Claude:')}
After adding an MCP, restart Claude and use:
  /mcp list           - See all MCP servers
  /mcp <server-name>  - Use specific server
  /mcp rapala         - Access Rapala tools

${chalk.gray('Documentation: docs/GENERIC_MCP_MANAGEMENT.md')}
    `);
  }

  /**
   * Call Rapala MCP tool
   */
  async callRapalaTool(toolName, args = {}) {
    return new Promise((resolve) => {
      const mcpPath = path.join(__dirname, 'rapala-mcp.mjs');
      const child = spawn('node', [mcpPath], {
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
          resolve(null);
        } catch (e) {
          resolve(null);
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
          clientInfo: { name: "rapala-mcpm", version: "1.0" }
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

  /**
   * Wait for Enter key
   */
  async waitForEnter() {
    await inquirer.prompt([
      {
        type: 'input',
        name: 'continue',
        message: 'Press Enter to continue...'
      }
    ]);
  }
}

module.exports = MCPInterface;