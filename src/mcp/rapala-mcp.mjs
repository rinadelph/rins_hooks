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
    "🛠️  Available tools: rapala-test, rapala-hook-list, rapala-hook-enable, rapala-hook-disable, rapala-status"
  );
}

// Start the server
main().catch((error) => {
  console.error("❌ Fatal error starting Rapala MCP Server:", error);
  process.exit(1);
});