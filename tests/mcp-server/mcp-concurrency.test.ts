import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { tmpdir } from "os";
import { join } from "path";
import { unlinkSync, existsSync } from "fs";
import { TaskStore } from "../../src/core/index.js";
import { registerQueueTools } from "../../src/mcp-server/tools/queue-tools.js";
import { registerTaskTools } from "../../src/mcp-server/tools/task-tools.js";
import { registerStatusTools } from "../../src/mcp-server/tools/status-tools.js";

describe("TaskQ MCP Server - MCP Protocol Concurrency Tests", () => {
  let taskStore: TaskStore;
  let testDbPath: string;

  beforeEach(async () => {
    // Create isolated test database (real database, no mocks)
    testDbPath = join(tmpdir(), `test-taskq-mcp-concurrency-${Date.now()}-${Math.random()}.db`);
    taskStore = new TaskStore({ dbPath: testDbPath });
  });

  afterEach(async () => {
    // Clean up real test database
    if (existsSync(testDbPath)) {
      unlinkSync(testDbPath);
    }
  });

  // Helper function to create MCP server with transport (real, no mocks)
  async function createMcpServerTransport() {
    const server = new McpServer({
      name: "taskq-concurrency-test",
      version: "0.1.0"
    });

    // Register all real tools
    registerQueueTools(server, taskStore);
    registerTaskTools(server, taskStore);
    registerStatusTools(server, taskStore);

    // Create real transport pair
    const transports = InMemoryTransport.createLinkedPair();
    await server.connect(transports[1]);

    return transports[0];
  }

  // Helper function to send MCP request and wait for response (real protocol)
  async function sendMcpRequest(transport: any, method: string, params: any = {}): Promise<any> {
    return new Promise((resolve, reject) => {
      const requestId = Math.random().toString(36);
      
      transport.onmessage = (message: any) => {
        if (message.id === requestId) {
          resolve(message);
        }
      };
      
      transport.onerror = (error: any) => {
        reject(error);
      };

      transport.send({
        jsonrpc: "2.0",
        id: requestId,
        method,
        params
      });
    });
  }

  describe("MCP Protocol-Specific Concurrency", () => {
    test("multiple MCP clients can perform simultaneous tool discovery", async () => {
      // Create multiple MCP client transports
      const clients: any[] = [];
      for (let i = 0; i < 3; i++) {
        const transport = await createMcpServerTransport();
        clients.push(transport);
      }

      // All clients discover tools simultaneously
      const discoveryPromises = clients.map(client => 
        sendMcpRequest(client, "tools/list")
      );

      const results = await Promise.all(discoveryPromises);

      // All clients should get the same tool list
      results.forEach(response => {
        expect(response.result.tools).toHaveLength(16);
        expect(response.result.tools.map((t: any) => t.name).sort()).toEqual([
          "add_task", "checkout_task", "complete_task", "create_queue", "delete_queue",
          "delete_task", "fail_task", "get_status", "inspect_queue", "inspect_task",
          "list_queues", "list_tasks", "reset_task", "update_queue", "update_task",
          "update_task_journal"
        ]);
      });
    });

    test("multiple MCP clients can make concurrent requests without interference", async () => {
      // Set up test data
      taskStore.createQueue({ name: "mcp-test-queue", description: "MCP concurrency test" });

      // Create multiple MCP clients
      const clients: any[] = [];
      for (let i = 0; i < 3; i++) {
        const transport = await createMcpServerTransport();
        clients.push(transport);
      }

      // Each client performs different operations concurrently
      const operations = [
        // Client 0: Add task
        sendMcpRequest(clients[0], "tools/call", {
          name: "add_task",
          arguments: {
            queue: "mcp-test-queue",
            title: "Task from Client 0"
          }
        }),
        // Client 1: Get status
        sendMcpRequest(clients[1], "tools/call", {
          name: "get_status",
          arguments: { queue: "mcp-test-queue" }
        }),
        // Client 2: List queues
        sendMcpRequest(clients[2], "tools/call", {
          name: "list_queues",
          arguments: {}
        })
      ];

      const results = await Promise.all(operations);

      // All operations should complete successfully
      results.forEach(response => {
        expect(response.result).toBeDefined();
        expect(response.result.isError).toBeFalsy();
      });

      // Verify the operations had their intended effects
      const finalTasks = taskStore.listTasks("mcp-test-queue");
      expect(finalTasks.length).toBe(1);
      expect(finalTasks[0]!.title).toBe("Task from Client 0");
    });

    test("MCP error handling works correctly with concurrent clients", async () => {
      // Create multiple MCP clients
      const clients: any[] = [];
      for (let i = 0; i < 2; i++) {
        const transport = await createMcpServerTransport();
        clients.push(transport);
      }

      // Both clients try to create the same queue (duplicate error scenario)
      const createPromises = clients.map((client, index) =>
        sendMcpRequest(client, "tools/call", {
          name: "create_queue",
          arguments: {
            name: "duplicate-queue",
            description: `Created by client ${index}`
          }
        })
      );

      const results = await Promise.all(createPromises);

      // One should succeed, one should fail with proper error
      const successes = results.filter(r => !r.result.isError);
      const failures = results.filter(r => r.result.isError);
      
      expect(successes.length).toBe(1);
      expect(failures.length).toBe(1);
      expect(failures[0].result.content[0].text).toContain("Error:");

      // Verify only one queue was created
      const queue = taskStore.getQueue("duplicate-queue");
      expect(queue).toBeTruthy();
    });
  });
});