#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import fs from "fs-extra";
import path from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";
import os from "os";
import { spawn, exec } from "child_process";
import { promisify } from "util";

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Promisify exec for async/await
const execAsync = promisify(exec);

// Store running MCP servers
const runningMCPServers = new Map();

// Load MCP Manager
let MCPManager;
try {
  const MCPManagerModule = await import('./MCPManager.js');
  MCPManager = MCPManagerModule.MCPManager;
} catch (err) {
  console.error('Failed to load MCPManager:', err);
}

// Create server instance
const server = new McpServer(
  {
    name: "rapala-mcp",
    version: "2.0.0",
  },
  {
    instructions:
      "Use this server to manage Rapala hooks, status lines, and MCP servers.",
  }
);

// Register tools
server.tool(
  "rapala-test",
  "Test Rapala MCP connection and verify it is working",
  z.object({}),
  async () => {
    return {
      content: [
        {
          type: "text",
          text: `✅ Rapala MCP is working!\n\nServer: rapala-mcp v2.0.0\nStatus: Connected\nTime: ${new Date().toISOString()}`,
        },
      ],
    };
  }
);

server.tool(
  "rapala-hook-list",
  "List all available Rapala hooks with their current status",
  z.object({
    category: z.string().optional().describe("Filter by category"),
  }),
  async ({ category }) => {
    const hooksDir = path.join(__dirname, "../../hooks");
    const hooks = [];

    if (await fs.pathExists(hooksDir)) {
      const dirs = await fs.readdir(hooksDir);
      for (const dir of dirs) {
        const configPath = path.join(hooksDir, dir, "config.json");
        if (await fs.pathExists(configPath)) {
          try {
            const config = await fs.readJson(configPath);
            if (!category || config.category === category) {
              hooks.push({
                name: config.name || dir,
                description: config.description || "No description",
                enabled: !config.disabled,
                events: config.events || [],
                tags: config.tags || [],
              });
            }
          } catch (err) {
            console.error(`Failed to read config for ${dir}:`, err);
          }
        }
      }
    }

    return {
      content: [
        {
          type: "text",
          text: `Found ${hooks.length} hooks:\n\n${hooks
            .map(
              (h) =>
                `📌 ${h.name}${h.enabled ? " ✅" : " ❌"}\n   ${
                  h.description
                }\n   Events: ${h.events.join(", ") || "none"}`
            )
            .join("\n\n")}`,
        },
      ],
    };
  }
);

server.tool(
  "rapala-hook-enable",
  "Enable a specific Rapala hook",
  z.object({
    name: z.string().describe("Name of the hook to enable"),
  }),
  async ({ name }) => {
    const configPath = path.join(__dirname, "../../hooks", name, "config.json");
    if (await fs.pathExists(configPath)) {
      const config = await fs.readJson(configPath);
      config.disabled = false;
      await fs.writeJson(configPath, config, { spaces: 2 });
      return {
        content: [
          {
            type: "text",
            text: `✅ Hook "${name}" has been enabled successfully`,
          },
        ],
      };
    }
    return {
      content: [
        {
          type: "text",
          text: `❌ Hook not found: ${name}`,
        },
      ],
    };
  }
);

server.tool(
  "rapala-hook-disable",
  "Disable a specific Rapala hook",
  z.object({
    name: z.string().describe("Name of the hook to disable"),
  }),
  async ({ name }) => {
    const configPath = path.join(__dirname, "../../hooks", name, "config.json");
    if (await fs.pathExists(configPath)) {
      const config = await fs.readJson(configPath);
      config.disabled = true;
      await fs.writeJson(configPath, config, { spaces: 2 });
      return {
        content: [
          {
            type: "text",
            text: `✅ Hook "${name}" has been disabled successfully`,
          },
        ],
      };
    }
    return {
      content: [
        {
          type: "text",
          text: `❌ Hook not found: ${name}`,
        },
      ],
    };
  }
);

server.tool(
  "mcp-start",
  "Start any MCP server (stdio, SSE, or HTTP transport)",
  z.object({
    name: z.string().describe("Name/identifier for the MCP server"),
    transport: z.enum(["stdio", "sse", "http"]).describe("Transport type"),
    command: z.string().describe("Command to execute (e.g., 'npx', 'node', 'python', or absolute path)"),
    args: z.array(z.string()).optional().describe("Arguments for the command"),
    env: z.record(z.string()).optional().describe("Environment variables"),
    port: z.number().optional().describe("Port for HTTP/SSE servers"),
    projectDir: z.string().optional().describe("Working directory")
  }),
  async ({ name, transport, command, args = [], env = {}, port, projectDir }) => {
    // Check if server is already running
    if (runningMCPServers.has(name)) {
      const server = runningMCPServers.get(name);
      return {
        content: [
          {
            type: "text",
            text: `⚠️ MCP server "${name}" is already running\n\nTransport: ${server.transport}\nCommand: ${server.command} ${server.args.join(' ')}\nPID: ${server.process.pid}`
          }
        ]
      };
    }

    try {
      const spawnOptions = {
        detached: false,
        stdio: transport === "stdio" ? ["pipe", "pipe", "pipe"] : ["ignore", "pipe", "pipe"],
        env: { ...process.env, ...env }
      };

      if (projectDir) {
        spawnOptions.cwd = projectDir;
      }

      // Handle special cases for common MCP servers
      let actualCommand = command;
      let actualArgs = [...args];

      // If it's an npx command for a known MCP server, ensure proper args
      if (command === "npx" && args.length > 0) {
        // npx commands might need -y flag
        if (!args.includes("-y") && !args.includes("--yes")) {
          actualArgs = ["-y", ...args];
        }
      }

      // For HTTP/SSE servers, add port argument if provided
      if ((transport === "http" || transport === "sse") && port) {
        // Common patterns for port arguments
        if (!actualArgs.some(arg => arg.includes("port"))) {
          actualArgs.push("--port", port.toString());
        }
      }

      const childProcess = spawn(actualCommand, actualArgs, spawnOptions);

      // Capture initial output
      let output = "";
      const captureOutput = (data) => {
        output += data.toString();
      };

      childProcess.stdout.on("data", captureOutput);
      childProcess.stderr.on("data", captureOutput);

      // Wait for server to start
      await new Promise(resolve => setTimeout(resolve, 2000));

      childProcess.stdout.removeListener("data", captureOutput);
      childProcess.stderr.removeListener("data", captureOutput);

      // Store server info
      const serverInfo = {
        name,
        transport,
        command: actualCommand,
        args: actualArgs,
        env,
        port,
        projectDir,
        process: childProcess,
        startedAt: new Date().toISOString()
      };

      runningMCPServers.set(name, serverInfo);

      // Handle process exit
      childProcess.on("exit", (code) => {
        console.error(`MCP server "${name}" exited with code ${code}`);
        runningMCPServers.delete(name);
      });

      // Build connection info based on transport
      let connectionInfo = "";
      if (transport === "stdio") {
        connectionInfo = `\n\nFor Claude integration:\nclaude mcp add ${name} "${actualCommand}" ${actualArgs.join(' ')}`;
      } else if (transport === "http" || transport === "sse") {
        const url = `http://localhost:${port || 3000}/mcp`;
        connectionInfo = `\n\nServer URL: ${url}\n\nFor Claude integration:\nclaude mcp add ${name} ${url}`;
      }

      return {
        content: [
          {
            type: "text",
            text: `✅ MCP server "${name}" started successfully\n\nTransport: ${transport}\nCommand: ${actualCommand} ${actualArgs.join(' ')}\nPID: ${childProcess.pid}\n\nInitial output:\n${output.slice(0, 500)}${connectionInfo}`
          }
        ]
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `❌ Failed to start MCP server "${name}": ${error.message}`
          }
        ]
      };
    }
  }
);

server.tool(
  "mcp-stop",
  "Stop a running MCP server",
  z.object({
    name: z.string().describe("Name of the MCP server to stop")
  }),
  async ({ name }) => {
    const server = runningMCPServers.get(name);
    
    if (!server) {
      return {
        content: [
          {
            type: "text",
            text: `⚠️ MCP server "${name}" is not running`
          }
        ]
      };
    }

    try {
      server.process.kill("SIGTERM");
      runningMCPServers.delete(name);
      
      return {
        content: [
          {
            type: "text",
            text: `✅ MCP server "${name}" stopped successfully`
          }
        ]
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `❌ Failed to stop MCP server "${name}": ${error.message}`
          }
        ]
      };
    }
  }
);

server.tool(
  "mcp-list",
  "List all running MCP servers and available MCP packages",
  z.object({}),
  async () => {
    let output = "📊 MCP Server Status\n\n";
    
    // List running servers
    if (runningMCPServers.size > 0) {
      output += "🟢 Running Servers:\n";
      for (const [name, server] of runningMCPServers) {
        const isRunning = server.process.pid && !server.process.killed;
        const status = isRunning ? "✅" : "❌";
        output += `\n${status} ${name}\n`;
        output += `   Transport: ${server.transport}\n`;
        output += `   Command: ${server.command} ${server.args.join(' ')}\n`;
        output += `   PID: ${server.process.pid}\n`;
        if (server.port) {
          output += `   Port: ${server.port}\n`;
        }
        output += `   Started: ${server.startedAt}\n`;
      }
    } else {
      output += "⚪ No MCP servers currently running\n";
    }
    
    output += "\n📦 Available MCP Servers:\n";
    
    // Check for known MCP servers
    const mcpServers = [
      { name: "agent-mcp", check: "which agent-mcp", install: "npm install -g agent-mcp-node" },
      { name: "@modelcontextprotocol/server-filesystem", check: "npm list -g @modelcontextprotocol/server-filesystem", install: "npm install -g @modelcontextprotocol/server-filesystem" },
      { name: "@modelcontextprotocol/server-github", check: "npm list -g @modelcontextprotocol/server-github", install: "npm install -g @modelcontextprotocol/server-github" },
      { name: "@modelcontextprotocol/server-gitlab", check: "npm list -g @modelcontextprotocol/server-gitlab", install: "npm install -g @modelcontextprotocol/server-gitlab" },
      { name: "@modelcontextprotocol/server-google-drive", check: "npm list -g @modelcontextprotocol/server-google-drive", install: "npm install -g @modelcontextprotocol/server-google-drive" },
      { name: "@modelcontextprotocol/server-postgres", check: "npm list -g @modelcontextprotocol/server-postgres", install: "npm install -g @modelcontextprotocol/server-postgres" },
      { name: "@modelcontextprotocol/server-sqlite", check: "npm list -g @modelcontextprotocol/server-sqlite", install: "npm install -g @modelcontextprotocol/server-sqlite" },
      { name: "@modelcontextprotocol/server-google-maps", check: "npm list -g @modelcontextprotocol/server-google-maps", install: "npm install -g @modelcontextprotocol/server-google-maps" },
      { name: "@modelcontextprotocol/server-slack", check: "npm list -g @modelcontextprotocol/server-slack", install: "npm install -g @modelcontextprotocol/server-slack" },
      { name: "@modelcontextprotocol/server-memory", check: "npm list -g @modelcontextprotocol/server-memory", install: "npm install -g @modelcontextprotocol/server-memory" },
      { name: "@modelcontextprotocol/server-puppeteer", check: "npm list -g @modelcontextprotocol/server-puppeteer", install: "npm install -g @modelcontextprotocol/server-puppeteer" },
      { name: "@modelcontextprotocol/server-brave-search", check: "npm list -g @modelcontextprotocol/server-brave-search", install: "npm install -g @modelcontextprotocol/server-brave-search" },
      { name: "@modelcontextprotocol/server-fetch", check: "npm list -g @modelcontextprotocol/server-fetch", install: "npm install -g @modelcontextprotocol/server-fetch" }
    ];
    
    for (const mcp of mcpServers) {
      try {
        await execAsync(mcp.check);
        output += `\n✅ ${mcp.name} (installed)`;
      } catch {
        output += `\n⚪ ${mcp.name} (not installed - ${mcp.install})`;
      }
    }
    
    // Also check using MCPManager if available
    if (MCPManager) {
      try {
        const manager = new MCPManager();
        const discovered = await manager.discoverMCPs();
        if (discovered.length > 0) {
          output += "\n\n🔍 Discovered MCP Servers (from registry):\n";
          for (const mcp of discovered) {
            output += `\n   ${mcp.name}:\n`;
            output += `      Transport: ${mcp.transport}\n`;
            output += `      Command: ${mcp.command} ${mcp.args?.join(' ') || ''}\n`;
            if (mcp.description) {
              output += `      Description: ${mcp.description}\n`;
            }
          }
        }
      } catch (err) {
        // MCPManager not available or error
      }
    }
    
    return {
      content: [
        {
          type: "text",
          text: output
        }
      ]
    };
  }
);

server.tool(
  "mcp-add-to-claude",
  "Add an MCP server to Claude's configuration",
  z.object({
    name: z.string().describe("Name for the MCP server in Claude"),
    transport: z.enum(["stdio", "http", "sse"]).describe("Transport type"),
    command: z.string().optional().describe("Command for stdio transport"),
    args: z.array(z.string()).optional().describe("Arguments for stdio command"),
    url: z.string().optional().describe("URL for HTTP/SSE transport"),
    env: z.record(z.string()).optional().describe("Environment variables")
  }),
  async ({ name, transport, command, args = [], url, env = {} }) => {
    try {
      // Read current Claude settings
      const settingsPath = path.join(os.homedir(), '.claude', 'settings.json');
      const settings = await fs.readJson(settingsPath);
      
      // Ensure mcpServers object exists
      if (!settings.mcpServers) {
        settings.mcpServers = {};
      }
      
      // Check if server already exists
      if (settings.mcpServers[name]) {
        return {
          content: [
            {
              type: "text",
              text: `⚠️ MCP server "${name}" already exists in Claude settings. Use a different name or remove it first.`
            }
          ]
        };
      }
      
      // Configure based on transport type
      if (transport === "stdio") {
        if (!command) {
          return {
            content: [
              {
                type: "text",
                text: `❌ Command is required for stdio transport`
              }
            ]
          };
        }
        
        settings.mcpServers[name] = {
          command,
          args,
          env
        };
      } else if (transport === "http" || transport === "sse") {
        if (!url) {
          return {
            content: [
              {
                type: "text",
                text: `❌ URL is required for ${transport} transport`
              }
            ]
          };
        }
        
        settings.mcpServers[name] = {
          url,
          transport,
          env
        };
      }
      
      // Save updated settings
      await fs.writeJson(settingsPath, settings, { spaces: 2 });
      
      let configDetails = `\n\nConfiguration added:\n`;
      if (transport === "stdio") {
        configDetails += `Command: ${command} ${args.join(' ')}`;
      } else {
        configDetails += `URL: ${url}\nTransport: ${transport}`;
      }
      
      if (Object.keys(env).length > 0) {
        configDetails += `\nEnvironment: ${JSON.stringify(env)}`;
      }
      
      return {
        content: [
          {
            type: "text",
            text: `✅ MCP server "${name}" added to Claude settings${configDetails}\n\n⚠️ Restart Claude for changes to take effect`
          }
        ]
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `❌ Failed to add MCP server to Claude: ${error.message}`
          }
        ]
      };
    }
  }
);

server.tool(
  "mcp-remove-from-claude",
  "Remove an MCP server from Claude's configuration",
  z.object({
    name: z.string().describe("Name of the MCP server to remove")
  }),
  async ({ name }) => {
    try {
      // Read current Claude settings
      const settingsPath = path.join(os.homedir(), '.claude', 'settings.json');
      const settings = await fs.readJson(settingsPath);
      
      // Check if server exists
      if (!settings.mcpServers || !settings.mcpServers[name]) {
        return {
          content: [
            {
              type: "text",
              text: `⚠️ MCP server "${name}" not found in Claude settings`
            }
          ]
        };
      }
      
      // Remove the server
      delete settings.mcpServers[name];
      
      // Save updated settings
      await fs.writeJson(settingsPath, settings, { spaces: 2 });
      
      return {
        content: [
          {
            type: "text",
            text: `✅ MCP server "${name}" removed from Claude settings\n\n⚠️ Restart Claude for changes to take effect`
          }
        ]
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `❌ Failed to remove MCP server from Claude: ${error.message}`
          }
        ]
      };
    }
  }
);

server.tool(
  "mcp-quick-add",
  "Quickly add a known MCP server with predefined settings",
  z.object({
    preset: z.enum([
      "agent-mcp",
      "filesystem",
      "github",
      "gitlab",
      "google-drive",
      "postgres",
      "sqlite",
      "google-maps",
      "slack",
      "memory",
      "puppeteer",
      "brave-search",
      "fetch"
    ]).describe("Preset MCP server to add"),
    name: z.string().optional().describe("Custom name (defaults to preset name)"),
    env: z.record(z.string()).optional().describe("Environment variables (e.g., API keys)")
  }),
  async ({ preset, name, env = {} }) => {
    const presets = {
      "agent-mcp": {
        transport: "http",
        url: "http://localhost:3001/mcp",
        description: "Multi-agent collaboration protocol server",
        startCommand: { command: "agent-mcp", args: ["--port", "3001"] }
      },
      "filesystem": {
        transport: "stdio",
        command: "npx",
        args: ["-y", "@modelcontextprotocol/server-filesystem", "/"],
        description: "File system access"
      },
      "github": {
        transport: "stdio",
        command: "npx",
        args: ["-y", "@modelcontextprotocol/server-github"],
        description: "GitHub API access",
        requiredEnv: ["GITHUB_PERSONAL_ACCESS_TOKEN"]
      },
      "gitlab": {
        transport: "stdio",
        command: "npx",
        args: ["-y", "@modelcontextprotocol/server-gitlab"],
        description: "GitLab API access",
        requiredEnv: ["GITLAB_PERSONAL_ACCESS_TOKEN", "GITLAB_API_URL"]
      },
      "google-drive": {
        transport: "stdio",
        command: "npx",
        args: ["-y", "@modelcontextprotocol/server-google-drive"],
        description: "Google Drive access",
        requiredEnv: ["GOOGLE_DRIVE_CLIENT_ID", "GOOGLE_DRIVE_CLIENT_SECRET"]
      },
      "postgres": {
        transport: "stdio",
        command: "npx",
        args: ["-y", "@modelcontextprotocol/server-postgres", "postgresql://localhost/mydb"],
        description: "PostgreSQL database access"
      },
      "sqlite": {
        transport: "stdio",
        command: "npx",
        args: ["-y", "@modelcontextprotocol/server-sqlite", "path/to/database.db"],
        description: "SQLite database access"
      },
      "google-maps": {
        transport: "stdio",
        command: "npx",
        args: ["-y", "@modelcontextprotocol/server-google-maps"],
        description: "Google Maps API access",
        requiredEnv: ["GOOGLE_MAPS_API_KEY"]
      },
      "slack": {
        transport: "stdio",
        command: "npx",
        args: ["-y", "@modelcontextprotocol/server-slack"],
        description: "Slack workspace access",
        requiredEnv: ["SLACK_BOT_TOKEN", "SLACK_TEAM_ID"]
      },
      "memory": {
        transport: "stdio",
        command: "npx",
        args: ["-y", "@modelcontextprotocol/server-memory"],
        description: "Knowledge graph memory system"
      },
      "puppeteer": {
        transport: "stdio",
        command: "npx",
        args: ["-y", "@modelcontextprotocol/server-puppeteer"],
        description: "Browser automation"
      },
      "brave-search": {
        transport: "stdio",
        command: "npx",
        args: ["-y", "@modelcontextprotocol/server-brave-search"],
        description: "Brave search API",
        requiredEnv: ["BRAVE_API_KEY"]
      },
      "fetch": {
        transport: "stdio",
        command: "npx",
        args: ["-y", "@modelcontextprotocol/server-fetch"],
        description: "Web content fetching"
      }
    };
    
    const config = presets[preset];
    if (!config) {
      return {
        content: [
          {
            type: "text",
            text: `❌ Unknown preset: ${preset}`
          }
        ]
      };
    }
    
    // Check required environment variables
    if (config.requiredEnv) {
      const missing = config.requiredEnv.filter(key => !env[key]);
      if (missing.length > 0) {
        return {
          content: [
            {
              type: "text",
              text: `❌ Missing required environment variables for ${preset}:\n\n${missing.join(', ')}\n\nProvide them in the env parameter`
            }
          ]
        };
      }
    }
    
    const serverName = name || preset;
    
    // If it's agent-mcp and it needs to be started first
    if (preset === "agent-mcp") {
      // Start the server if not running
      if (!runningMCPServers.has("agent-mcp")) {
        const startResult = await server.tool("mcp-start").handler({
          name: "agent-mcp",
          transport: "http",
          command: config.startCommand.command,
          args: config.startCommand.args,
          port: 3001
        });
        
        if (startResult.content[0].text.includes("❌")) {
          return startResult;
        }
      }
    }
    
    // Add to Claude settings
    const addResult = await server.tool("mcp-add-to-claude").handler({
      name: serverName,
      transport: config.transport,
      command: config.command,
      args: config.args,
      url: config.url,
      env
    });
    
    return {
      content: [
        {
          type: "text",
          text: addResult.content[0].text + `\n\nPreset: ${preset}\nDescription: ${config.description}`
        }
      ]
    };
  }
);

server.tool(
  "rapala-status",
  "Get overall Rapala system status",
  z.object({}),
  async () => {
    const hooksDir = path.join(__dirname, "../../hooks");
    let totalHooks = 0;
    let enabledHooks = 0;
    let disabledHooks = 0;

    if (await fs.pathExists(hooksDir)) {
      const dirs = await fs.readdir(hooksDir);
      for (const dir of dirs) {
        const configPath = path.join(hooksDir, dir, "config.json");
        if (await fs.pathExists(configPath)) {
          try {
            const config = await fs.readJson(configPath);
            totalHooks++;
            if (config.disabled) {
              disabledHooks++;
            } else {
              enabledHooks++;
            }
          } catch (err) {
            // Skip invalid configs
          }
        }
      }
    }

    return {
      content: [
        {
          type: "text",
          text:
            `📊 Rapala System Status\n\n` +
            `Total Hooks: ${totalHooks}\n` +
            `✅ Enabled: ${enabledHooks}\n` +
            `❌ Disabled: ${disabledHooks}\n` +
            `\nServer: rapala-mcp v2.0.0\n` +
            `Status: Operational\n` +
            `Time: ${new Date().toISOString()}`,
        },
      ],
    };
  }
);

// Main function to start the server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("🚀 Rapala MCP Server v2.0.0 started successfully");
  console.error("📡 Connected via stdio transport");
  console.error(
    "🛠️  Available tools: rapala-test, rapala-hook-list, rapala-hook-enable, rapala-hook-disable, rapala-status, mcp-start, mcp-stop, mcp-list, mcp-add-to-claude, mcp-remove-from-claude, mcp-quick-add"
  );
}

// Start the server
main().catch((error) => {
  console.error("❌ Fatal error starting Rapala MCP Server:", error);
  process.exit(1);
});