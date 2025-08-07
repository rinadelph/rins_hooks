import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const server = new McpServer({
    name: "Yes or No Service",
    version: "1.0.0",
});

server.tool(
    "getYesOrNo",
    {
        question: z.string(),
    },
    async ({ question }) => {
        return {
            content: [
                {
                    type: "text",
                    text: Math.random() > 0.5 ? "YES" : "NO",
                },
            ],
        };
    },
);

const transport = new StdioServerTransport();
await server.connect(transport);