#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { TaskStore } from "../core/index.js";
import { registerQueueTools } from "./tools/queue-tools.js";
// import { registerTaskTools } from "./tools/task-tools.js";
// import { registerStatusTools } from "./tools/status-tools.js";

async function main() {
  // Initialize TaskStore with configuration
  const taskStore = new TaskStore();

  // Create MCP server
  const server = new McpServer({
    name: "taskq-mcp-server",
    version: "0.1.0"
  });

  // Register queue tools (5 tools) - working with correct MCP API
  registerQueueTools(server, taskStore);
  
  // TODO: Implement task and status tools with correct MCP API
  // registerTaskTools(server, taskStore);
  // registerStatusTools(server, taskStore);

  // Set up stdio transport
  const transport = new StdioServerTransport();
  
  // Connect server to transport
  await server.connect(transport);
  
  // Log server start (to stderr so it doesn't interfere with MCP protocol)
  console.error("TaskQ MCP server started");
}

// Handle graceful shutdown
process.on("SIGINT", async () => {
  console.error("TaskQ MCP server shutting down");
  process.exit(0);
});

process.on("SIGTERM", async () => {
  console.error("TaskQ MCP server shutting down");
  process.exit(0);
});

// Start server
main().catch((error) => {
  console.error("Failed to start TaskQ MCP server:", error);
  process.exit(1);
});