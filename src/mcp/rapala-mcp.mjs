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

// Store agent-mcp process reference
let agentMcpProcess = null;
let agentMcpPort = 3001;

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
  "agent-mcp-start",
  "Start the agent-mcp server for multi-agent collaboration",
  z.object({
    port: z.number().optional().describe("Port to run the server on (default: 3001)"),
    projectDir: z.string().optional().describe("Project directory to operate in")
  }),
  async ({ port, projectDir }) => {
    if (agentMcpProcess) {
      return {
        content: [
          {
            type: "text",
            text: `⚠️ Agent-MCP server is already running on port ${agentMcpPort}`
          }
        ]
      };
    }

    const actualPort = port || 3001;
    const args = ["--port", actualPort.toString()];
    
    if (projectDir) {
      args.push("--project-dir", projectDir);
    }

    try {
      agentMcpProcess = spawn("agent-mcp", args, {
        detached: false,
        stdio: ["ignore", "pipe", "pipe"]
      });

      agentMcpPort = actualPort;

      // Capture initial output
      let output = "";
      const captureOutput = (data) => {
        output += data.toString();
      };

      agentMcpProcess.stdout.on("data", captureOutput);
      agentMcpProcess.stderr.on("data", captureOutput);

      // Wait a bit for server to start
      await new Promise(resolve => setTimeout(resolve, 2000));

      agentMcpProcess.stdout.removeListener("data", captureOutput);
      agentMcpProcess.stderr.removeListener("data", captureOutput);

      agentMcpProcess.on("exit", () => {
        agentMcpProcess = null;
      });

      return {
        content: [
          {
            type: "text",
            text: `✅ Agent-MCP server started on port ${actualPort}\n\nInitial output:\n${output.slice(0, 500)}...\n\nServer URL: http://localhost:${actualPort}/mcp`
          }
        ]
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `❌ Failed to start agent-mcp: ${error.message}`
          }
        ]
      };
    }
  }
);

server.tool(
  "agent-mcp-stop",
  "Stop the agent-mcp server",
  z.object({}),
  async () => {
    if (!agentMcpProcess) {
      return {
        content: [
          {
            type: "text",
            text: `⚠️ Agent-MCP server is not running`
          }
        ]
      };
    }

    try {
      agentMcpProcess.kill("SIGTERM");
      agentMcpProcess = null;
      
      return {
        content: [
          {
            type: "text",
            text: `✅ Agent-MCP server stopped successfully`
          }
        ]
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `❌ Failed to stop agent-mcp: ${error.message}`
          }
        ]
      };
    }
  }
);

server.tool(
  "agent-mcp-status",
  "Check the status of agent-mcp server",
  z.object({}),
  async () => {
    if (agentMcpProcess) {
      try {
        // Try to check if the process is still running
        const isRunning = agentMcpProcess.pid && !agentMcpProcess.killed;
        
        if (isRunning) {
          // Try to check HTTP endpoint
          try {
            const { stdout } = await execAsync(`curl -s http://localhost:${agentMcpPort}/health || echo "No health endpoint"`);
            return {
              content: [
                {
                  type: "text",
                  text: `✅ Agent-MCP server is running\n\nPort: ${agentMcpPort}\nPID: ${agentMcpProcess.pid}\nURL: http://localhost:${agentMcpPort}/mcp\n\nHealth check:\n${stdout}`
                }
              ]
            };
          } catch {
            return {
              content: [
                {
                  type: "text",
                  text: `✅ Agent-MCP server is running\n\nPort: ${agentMcpPort}\nPID: ${agentMcpProcess.pid}\nURL: http://localhost:${agentMcpPort}/mcp`
                }
              ]
            };
          }
        }
      } catch (error) {
        agentMcpProcess = null;
      }
    }

    // Check if agent-mcp is available
    try {
      const { stdout } = await execAsync("which agent-mcp");
      return {
        content: [
          {
            type: "text",
            text: `❌ Agent-MCP server is not running\n\n✅ Agent-MCP is installed at: ${stdout.trim()}\n\nUse 'agent-mcp-start' tool to start the server`
          }
        ]
      };
    } catch {
      return {
        content: [
          {
            type: "text",
            text: `❌ Agent-MCP is not installed\n\nInstall it with: npm install -g agent-mcp-node`
          }
        ]
      };
    }
  }
);

server.tool(
  "agent-mcp-info",
  "Get information about agent-mcp capabilities",
  z.object({}),
  async () => {
    const info = `
📊 Agent-MCP Information

Agent-MCP is a Multi-Agent Collaboration Protocol server that provides:

🛠️ Available Tools:
• create_agent - Create new AI agents
• view_status - View agent status
• terminate_agent - Terminate an agent
• list_agents - List all agents
• relaunch_agent - Relaunch an agent
• audit_agent_sessions - Audit agent sessions
• smart_audit_agents - Smart agent auditing

💬 Communication:
• send_agent_message - Send messages to agents
• get_agent_messages - Get agent messages
• broadcast_admin_message - Broadcast to all agents
• request_assistance - Request help from agents

📋 Task Management:
• create_self_task - Create tasks
• assign_task - Assign tasks to agents
• view_tasks - View all tasks
• update_task_status - Update task status
• search_tasks - Search through tasks
• delete_task - Delete tasks
• bulk_task_operations - Bulk task operations

🔍 RAG & Context:
• ask_project_rag - Query project knowledge base
• get_rag_status - Get RAG system status
• check_file_status - Check file status
• update_file_status - Update file status
• view_project_context - View project context
• update_project_context - Update project context

📦 Session Management:
• save_session_state - Save session state
• load_session_state - Load session state
• list_session_states - List all session states
• clear_session_state - Clear session state

To use agent-mcp with Claude:
1. Start the server: Use 'agent-mcp-start' tool
2. Add to Claude: claude mcp add agent-mcp http://localhost:3001/mcp
3. Use the tools in Claude
`;

    return {
      content: [
        {
          type: "text",
          text: info.trim()
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
  console.error("🛠️  Rapala tools: rapala-test, rapala-hook-list, rapala-hook-enable, rapala-hook-disable, rapala-status");
  console.error("🤖 Agent-MCP tools: agent-mcp-start, agent-mcp-stop, agent-mcp-status, agent-mcp-info");
}

// Start the server
main().catch((error) => {
  console.error("❌ Fatal error starting Rapala MCP Server:", error);
  process.exit(1);
});