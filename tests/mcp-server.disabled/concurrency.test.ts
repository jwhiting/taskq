import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { createInMemoryTransportPair } from "@modelcontextprotocol/sdk/inMemory.js";
import { tmpdir } from "os";
import { join } from "path";
import { unlinkSync, existsSync } from "fs";
import { TaskStore } from "../../src/core/index.js";
import { 
  registerQueueTools, 
  getQueueToolDefinitions 
} from "../../src/mcp-server/tools/queue-tools.js";
import { 
  registerTaskTools, 
  getTaskToolDefinitions 
} from "../../src/mcp-server/tools/task-tools.js";
import { 
  registerStatusTools, 
  getStatusToolDefinitions 
} from "../../src/mcp-server/tools/status-tools.js";

describe("TaskQ MCP Server Concurrency", () => {
  let taskStore: TaskStore;
  let testDbPath: string;

  beforeEach(async () => {
    // Create isolated test database
    testDbPath = join(tmpdir(), `test-taskq-mcp-concurrency-${Date.now()}-${Math.random()}.db`);
    taskStore = new TaskStore({ dbPath: testDbPath });
  });

  afterEach(async () => {
    // Clean up test database
    if (existsSync(testDbPath)) {
      unlinkSync(testDbPath);
    }
  });

  // Helper function to create MCP server with transport
  async function createMcpServerTransport() {
    const server = new Server(
      {
        name: "taskq-concurrency-test",
        version: "0.1.0",
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    // Register all tools
    const queueTools = getQueueToolDefinitions();
    const taskTools = getTaskToolDefinitions();
    const statusTools = getStatusToolDefinitions();
    const allTools = [...queueTools, ...taskTools, ...statusTools];

    server.setRequestHandler({ method: "tools/list" }, async () => {
      return { tools: allTools };
    });

    registerQueueTools(server, taskStore);
    registerTaskTools(server, taskStore);
    registerStatusTools(server, taskStore);

    const transports = createInMemoryTransportPair();
    await server.connect(transports.serverTransport);

    return transports.clientTransport;
  }

  // Helper function to send MCP request and wait for response
  async function sendMcpRequest(transport: any, request: any) {
    return new Promise((resolve) => {
      transport.onmessage = resolve;
      transport.send(request);
    });
  }

  describe("Concurrent Task Checkout", () => {
    test("multiple clients checking out tasks should be atomic", async () => {
      // Create test queue and multiple tasks
      await taskStore.createQueue("concurrent-queue", "Test concurrent operations");
      const tasks = [];
      for (let i = 0; i < 10; i++) {
        const task = await taskStore.addTask("concurrent-queue", `Task ${i}`, `Test task ${i}`);
        tasks.push(task);
      }

      // Create multiple client transports
      const clients = [];
      for (let i = 0; i < 5; i++) {
        const transport = await createMcpServerTransport();
        clients.push(transport);
      }

      // Concurrent checkout requests
      const checkoutPromises = clients.map(async (client, index) => {
        const results = [];
        // Each client tries to checkout 3 tasks
        for (let i = 0; i < 3; i++) {
          try {
            const response: any = await sendMcpRequest(client, {
              jsonrpc: "2.0" as const,
              id: i + 1,
              method: "tools/call" as const,
              params: {
                name: "checkout_task",
                arguments: {
                  queue_or_task_id: "concurrent-queue",
                  worker_id: `worker-${index}`
                }
              }
            });

            if (response.result && !response.result.isError) {
              const taskData = JSON.parse(response.result.content[0].text);
              results.push(taskData.task.id);
            }
          } catch (error) {
            // Some checkouts may fail when queue is empty, which is expected
          }
        }
        return results;
      });

      // Wait for all checkout operations
      const allResults = await Promise.all(checkoutPromises);
      const checkedOutTaskIds = allResults.flat();

      // Verify no duplicate checkouts (atomicity)
      const uniqueTaskIds = new Set(checkedOutTaskIds);
      expect(uniqueTaskIds.size).toBe(checkedOutTaskIds.length);

      // Verify all checked out tasks are in checked_out status
      for (const taskId of checkedOutTaskIds) {
        const task = await taskStore.inspectTask(taskId);
        expect(task.status).toBe("checked_out");
        expect(task.workerId).toMatch(/worker-\d/);
      }

      // Should have checked out up to 10 tasks (limited by available tasks)
      expect(checkedOutTaskIds.length).toBeLessThanOrEqual(10);
    });
  });

  describe("Concurrent Queue Operations", () => {
    test("concurrent queue creation should handle duplicates gracefully", async () => {
      // Create multiple client transports
      const clients = [];
      for (let i = 0; i < 3; i++) {
        const transport = await createMcpServerTransport();
        clients.push(transport);
      }

      // Try to create the same queue concurrently
      const createPromises = clients.map(async (client, index) => {
        try {
          const response: any = await sendMcpRequest(client, {
            jsonrpc: "2.0" as const,
            id: 1,
            method: "tools/call" as const,
            params: {
              name: "create_queue",
              arguments: {
                name: "concurrent-create-queue",
                description: `Created by client ${index}`
              }
            }
          });
          return { success: !response.result.isError, client: index };
        } catch (error) {
          return { success: false, client: index };
        }
      });

      const results = await Promise.all(createPromises);
      
      // Only one should succeed, others should fail with duplicate error
      const successes = results.filter(r => r.success);
      expect(successes.length).toBe(1);

      // Verify queue exists and is consistent
      const queue = await taskStore.inspectQueue("concurrent-create-queue");
      expect(queue.name).toBe("concurrent-create-queue");
    });
  });

  describe("Mixed Concurrent Operations", () => {
    test("concurrent task additions and status queries should be consistent", async () => {
      // Create test queue
      await taskStore.createQueue("mixed-ops-queue", "Test mixed operations");

      // Create multiple client transports
      const clients = [];
      for (let i = 0; i < 4; i++) {
        const transport = await createMcpServerTransport();
        clients.push(transport);
      }

      // Run mixed operations concurrently
      const operations = [
        // Client 0: Add tasks
        ...Array.from({ length: 5 }, (_, i) => ({
          client: 0,
          operation: async () => {
            return await sendMcpRequest(clients[0], {
              jsonrpc: "2.0" as const,
              id: i + 1,
              method: "tools/call" as const,
              params: {
                name: "add_task",
                arguments: {
                  queue: "mixed-ops-queue",
                  title: `Concurrent Task ${i}`,
                  description: `Task added concurrently ${i}`
                }
              }
            });
          }
        })),
        
        // Client 1: Query status
        ...Array.from({ length: 3 }, (_, i) => ({
          client: 1,
          operation: async () => {
            return await sendMcpRequest(clients[1], {
              jsonrpc: "2.0" as const,
              id: i + 1,
              method: "tools/call" as const,
              params: {
                name: "get_status",
                arguments: {
                  queue: "mixed-ops-queue"
                }
              }
            });
          }
        })),

        // Client 2: List tasks
        ...Array.from({ length: 3 }, (_, i) => ({
          client: 2,
          operation: async () => {
            return await sendMcpRequest(clients[2], {
              jsonrpc: "2.0" as const,
              id: i + 1,
              method: "tools/call" as const,
              params: {
                name: "list_tasks",
                arguments: {
                  queue: "mixed-ops-queue"
                }
              }
            });
          }
        })),

        // Client 3: Add more tasks
        ...Array.from({ length: 3 }, (_, i) => ({
          client: 3,
          operation: async () => {
            return await sendMcpRequest(clients[3], {
              jsonrpc: "2.0" as const,
              id: i + 1,
              method: "tools/call" as const,
              params: {
                name: "add_task",
                arguments: {
                  queue: "mixed-ops-queue",
                  title: `Extra Task ${i}`,
                  description: `Extra task ${i}`,
                  priority: 3
                }
              }
            });
          }
        }))
      ];

      // Execute all operations concurrently
      const results = await Promise.all(operations.map(op => op.operation()));

      // Verify final state consistency
      const finalTasks = await taskStore.listTasks("mixed-ops-queue");
      expect(finalTasks.length).toBe(8); // 5 + 3 tasks added

      const queueStatus = await taskStore.getQueueStatus("mixed-ops-queue");
      expect(queueStatus.totalTasks).toBe(8);
      expect(queueStatus.pendingTasks).toBe(8);

      // All operations should have completed without errors
      results.forEach((result: any) => {
        expect(result.result).toBeDefined();
      });
    });
  });

  describe("High Load Concurrent Operations", () => {
    test("should handle high concurrent task operations without corruption", async () => {
      // Create test queue
      await taskStore.createQueue("high-load-queue", "High load test queue");

      // Create many client transports
      const clientCount = 10;
      const clients = [];
      for (let i = 0; i < clientCount; i++) {
        const transport = await createMcpServerTransport();
        clients.push(transport);
      }

      // Each client performs multiple operations
      const operationsPerClient = 5;
      const allOperations = [];

      for (let clientIdx = 0; clientIdx < clientCount; clientIdx++) {
        for (let opIdx = 0; opIdx < operationsPerClient; opIdx++) {
          allOperations.push({
            clientIdx,
            operation: async () => {
              const taskId = `${clientIdx}-${opIdx}`;
              
              // Add task
              const addResponse: any = await sendMcpRequest(clients[clientIdx], {
                jsonrpc: "2.0" as const,
                id: 1,
                method: "tools/call" as const,
                params: {
                  name: "add_task",
                  arguments: {
                    queue: "high-load-queue",
                    title: `High Load Task ${taskId}`,
                    description: `Task from client ${clientIdx}, operation ${opIdx}`
                  }
                }
              });

              if (addResponse.result && !addResponse.result.isError) {
                const taskData = JSON.parse(addResponse.result.content[0].text);
                const actualTaskId = taskData.task.id;

                // Try to checkout the task
                const checkoutResponse: any = await sendMcpRequest(clients[clientIdx], {
                  jsonrpc: "2.0" as const,
                  id: 2,
                  method: "tools/call" as const,
                  params: {
                    name: "checkout_task",
                    arguments: {
                      queue_or_task_id: actualTaskId.toString(),
                      worker_id: `high-load-worker-${clientIdx}`
                    }
                  }
                });

                return { 
                  taskId: actualTaskId, 
                  clientIdx, 
                  added: true, 
                  checkedOut: checkoutResponse.result && !checkoutResponse.result.isError 
                };
              }

              return { taskId, clientIdx, added: false, checkedOut: false };
            }
          });
        }
      }

      // Execute all operations concurrently
      const results = await Promise.all(allOperations.map(op => op.operation()));

      // Verify results
      const addedTasks = results.filter(r => r.added);
      expect(addedTasks.length).toBe(clientCount * operationsPerClient); // All tasks should be added

      // Verify database consistency
      const finalTasks = await taskStore.listTasks("high-load-queue");
      expect(finalTasks.length).toBe(clientCount * operationsPerClient);

      // Check for any corruption - all tasks should have valid data
      finalTasks.forEach(task => {
        expect(task.id).toBeDefined();
        expect(task.queueName).toBe("high-load-queue");
        expect(task.title).toMatch(/High Load Task \d+-\d+/);
        expect(task.status).toMatch(/pending|checked_out/);
      });

      // Count checked out tasks
      const checkedOutTasks = finalTasks.filter(task => task.status === "checked_out");
      const checkedOutResults = results.filter(r => r.checkedOut);
      
      // Number of checked out tasks should match successful checkout operations
      expect(checkedOutTasks.length).toBe(checkedOutResults.length);
    });
  });
});