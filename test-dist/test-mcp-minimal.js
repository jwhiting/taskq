#!/usr/bin/env node
// Minimal MCP server test to verify the API works
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
async function main() {
    const server = new Server({
        name: "test-server",
        version: "1.0.0",
    }, {
        capabilities: {
            tools: {},
        },
    });
    // Test basic tools list
    server.setRequestHandler({ method: "tools/list" }, async () => {
        return {
            tools: [
                {
                    name: "test_tool",
                    description: "A test tool",
                    inputSchema: {
                        type: "object",
                        properties: {
                            message: {
                                type: "string",
                                description: "Test message"
                            }
                        },
                        required: ["message"]
                    }
                }
            ]
        };
    });
    // Test tool call handler
    server.setRequestHandler({ method: "tools/call" }, async (request) => {
        if (request.params.name === "test_tool") {
            return {
                content: [{
                        type: "text",
                        text: `Hello: ${request.params.arguments.message}`
                    }]
            };
        }
        return {
            content: [{
                    type: "text",
                    text: "Unknown tool"
                }]
        };
    });
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error("Test MCP server started");
}
main().catch(console.error);
