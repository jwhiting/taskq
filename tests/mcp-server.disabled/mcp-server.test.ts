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

describe("TaskQ MCP Server", () => {
  let taskStore: TaskStore;
  let server: Server;
  let clientTransport: any;
  let serverTransport: any;
  let testDbPath: string;

  beforeEach(async () => {
    // Create isolated test database
    testDbPath = join(tmpdir(), `test-taskq-mcp-${Date.now()}-${Math.random()}.db`);
    taskStore = new TaskStore({ dbPath: testDbPath });

    // Create MCP server
    server = new Server(
      {
        name: "taskq-test-server",
        version: "0.1.0",
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    // Get all tool definitions
    const queueTools = getQueueToolDefinitions();
    const taskTools = getTaskToolDefinitions();
    const statusTools = getStatusToolDefinitions();
    const allTools = [...queueTools, ...taskTools, ...statusTools];

    // Register tools/list handler
    server.setRequestHandler({ method: "tools/list" }, async () => {
      return { tools: allTools };
    });

    // Register tool handlers
    registerQueueTools(server, taskStore);
    registerTaskTools(server, taskStore);
    registerStatusTools(server, taskStore);

    // Create transport pair
    const transports = createInMemoryTransportPair();
    clientTransport = transports.clientTransport;
    serverTransport = transports.serverTransport;

    // Connect server
    await server.connect(serverTransport);
  });

  afterEach(async () => {
    // Clean up test database
    if (existsSync(testDbPath)) {
      unlinkSync(testDbPath);
    }
  });

  describe("Tool Discovery", () => {
    test("should list all 16 tools", async () => {
      const request = {
        jsonrpc: "2.0" as const,
        id: 1,
        method: "tools/list" as const,
        params: {}
      };

      const responsePromise = new Promise((resolve) => {
        clientTransport.onmessage = resolve;
      });

      await clientTransport.send(request);
      const response: any = await responsePromise;

      expect(response.result.tools).toBeDefined();
      expect(response.result.tools).toHaveLength(16); // 5 queue + 9 task + 2 status tools
      
      // Check that all expected tools are present
      const toolNames = response.result.tools.map((tool: any) => tool.name);
      expect(toolNames).toContain("create_queue");
      expect(toolNames).toContain("add_task");
      expect(toolNames).toContain("get_status");
    });
  });

  describe("Queue Operations", () => {
    test("create_queue should work", async () => {
      const request = {
        jsonrpc: "2.0" as const,
        id: 1,
        method: "tools/call" as const,
        params: {
          name: "create_queue",
          arguments: {
            name: "test-queue",
            description: "Test queue for MCP",
            instructions: "Test instructions"
          }
        }
      };

      const responsePromise = new Promise((resolve) => {
        clientTransport.onmessage = resolve;
      });

      await clientTransport.send(request);
      const response: any = await responsePromise;

      expect(response.result.content).toBeDefined();
      expect(response.result.content[0].text).toContain("test-queue");
      
      // Verify queue was created in database
      const queue = await taskStore.inspectQueue("test-queue");
      expect(queue.name).toBe("test-queue");
      expect(queue.description).toBe("Test queue for MCP");
    });

    test("list_queues should return formatted table", async () => {
      // First create a queue
      await taskStore.createQueue("test-queue", "Test description");

      const request = {
        jsonrpc: "2.0" as const,
        id: 1,
        method: "tools/call" as const,
        params: {
          name: "list_queues",
          arguments: {}
        }
      };

      const responsePromise = new Promise((resolve) => {
        clientTransport.onmessage = resolve;
      });

      await clientTransport.send(request);
      const response: any = await responsePromise;

      expect(response.result.content[0].text).toContain("test-queue");
      expect(response.result.content[0].text).toContain("Test description");
    });

    test("delete_queue should work", async () => {
      // Create a queue first
      await taskStore.createQueue("delete-me", "Queue to delete");

      const request = {
        jsonrpc: "2.0" as const,
        id: 1,
        method: "tools/call" as const,
        params: {
          name: "delete_queue",
          arguments: {
            name: "delete-me"
          }
        }
      };

      const responsePromise = new Promise((resolve) => {
        clientTransport.onmessage = resolve;
      });

      await clientTransport.send(request);
      const response: any = await responsePromise;

      expect(response.result.content[0].text).toContain("deleted successfully");

      // Verify queue was deleted
      await expect(taskStore.inspectQueue("delete-me")).rejects.toThrow();
    });
  });

  describe("Task Operations", () => {
    beforeEach(async () => {
      // Create test queue for tasks
      await taskStore.createQueue("task-queue", "Queue for task tests");
    });

    test("add_task should work", async () => {
      const request = {
        jsonrpc: "2.0" as const,
        id: 1,
        method: "tools/call" as const,
        params: {
          name: "add_task",
          arguments: {
            queue: "task-queue",
            title: "Test Task",
            description: "A test task",
            priority: 8,
            parameters: { key: "value" }
          }
        }
      };

      const responsePromise = new Promise((resolve) => {
        clientTransport.onmessage = resolve;
      });

      await clientTransport.send(request);
      const response: any = await responsePromise;

      expect(response.result.content[0].text).toContain("Test Task");
      expect(response.result.content[0].text).toContain("task-queue");

      // Verify task was created
      const tasks = await taskStore.listTasks("task-queue");
      expect(tasks).toHaveLength(1);
      expect(tasks[0].title).toBe("Test Task");
      expect(tasks[0].priority).toBe(8);
    });

    test("checkout_task should work with queue name", async () => {
      // Add a task first
      const task = await taskStore.addTask("task-queue", "Checkout Test", "Task to checkout");

      const request = {
        jsonrpc: "2.0" as const,
        id: 1,
        method: "tools/call" as const,
        params: {
          name: "checkout_task",
          arguments: {
            queue_or_task_id: "task-queue",
            worker_id: "test-worker"
          }
        }
      };

      const responsePromise = new Promise((resolve) => {
        clientTransport.onmessage = resolve;
      });

      await clientTransport.send(request);
      const response: any = await responsePromise;

      expect(response.result.content[0].text).toContain("checked out successfully");

      // Verify task status
      const checkedOutTask = await taskStore.inspectTask(task.id);
      expect(checkedOutTask.status).toBe("checked_out");
      expect(checkedOutTask.workerId).toBe("test-worker");
    });

    test("complete_task should work", async () => {
      // Add and checkout a task
      const task = await taskStore.addTask("task-queue", "Complete Test", "Task to complete");
      await taskStore.checkoutTask(task.id, "test-worker");

      const request = {
        jsonrpc: "2.0" as const,
        id: 1,
        method: "tools/call" as const,
        params: {
          name: "complete_task",
          arguments: {
            task_id: task.id
          }
        }
      };

      const responsePromise = new Promise((resolve) => {
        clientTransport.onmessage = resolve;
      });

      await clientTransport.send(request);
      const response: any = await responsePromise;

      expect(response.result.content[0].text).toContain("marked as completed");

      // Verify task status
      const completedTask = await taskStore.inspectTask(task.id);
      expect(completedTask.status).toBe("completed");
      expect(completedTask.completedAt).toBeDefined();
    });
  });

  describe("Status Operations", () => {
    test("get_status should work for system-wide status", async () => {
      // Create test data
      await taskStore.createQueue("status-queue", "Queue for status test");
      await taskStore.addTask("status-queue", "Status Task", "Test task");

      const request = {
        jsonrpc: "2.0" as const,
        id: 1,
        method: "tools/call" as const,
        params: {
          name: "get_status",
          arguments: {}
        }
      };

      const responsePromise = new Promise((resolve) => {
        clientTransport.onmessage = resolve;
      });

      await clientTransport.send(request);
      const response: any = await responsePromise;

      expect(response.result.content[0].text).toContain("TaskQ System Status");
      expect(response.result.content[0].text).toContain("Total Queues: 1");
      expect(response.result.content[0].text).toContain("Total Tasks: 1");
    });

    test("get_status should work for queue-specific status", async () => {
      await taskStore.createQueue("specific-queue", "Specific queue for test");
      await taskStore.addTask("specific-queue", "Task 1", "First task");
      await taskStore.addTask("specific-queue", "Task 2", "Second task");

      const request = {
        jsonrpc: "2.0" as const,
        id: 1,
        method: "tools/call" as const,
        params: {
          name: "get_status",
          arguments: {
            queue: "specific-queue"
          }
        }
      };

      const responsePromise = new Promise((resolve) => {
        clientTransport.onmessage = resolve;
      });

      await clientTransport.send(request);
      const response: any = await responsePromise;

      expect(response.result.content[0].text).toContain("Queue: specific-queue");
      expect(response.result.content[0].text).toContain("Total Tasks: 2");
    });
  });

  describe("Error Handling", () => {
    test("should handle invalid queue name", async () => {
      const request = {
        jsonrpc: "2.0" as const,
        id: 1,
        method: "tools/call" as const,
        params: {
          name: "inspect_queue",
          arguments: {
            name: "non-existent-queue"
          }
        }
      };

      const responsePromise = new Promise((resolve) => {
        clientTransport.onmessage = resolve;
      });

      await clientTransport.send(request);
      const response: any = await responsePromise;

      expect(response.result.isError).toBe(true);
      expect(response.result.content[0].text).toContain("Error:");
    });

    test("should handle invalid tool name", async () => {
      const request = {
        jsonrpc: "2.0" as const,
        id: 1,
        method: "tools/call" as const,
        params: {
          name: "non_existent_tool",
          arguments: {}
        }
      };

      const responsePromise = new Promise((resolve) => {
        clientTransport.onmessage = resolve;
      });

      await clientTransport.send(request);
      const response: any = await responsePromise;

      // Should not handle unknown tools (return null and let other handlers process)
      expect(response.result).toBeNull();
    });

    test("should handle validation errors", async () => {
      const request = {
        jsonrpc: "2.0" as const,
        id: 1,
        method: "tools/call" as const,
        params: {
          name: "create_queue",
          arguments: {
            // Missing required 'name' field
            description: "Queue without name"
          }
        }
      };

      const responsePromise = new Promise((resolve) => {
        clientTransport.onmessage = resolve;
      });

      await clientTransport.send(request);
      const response: any = await responsePromise;

      expect(response.result.isError).toBe(true);
      expect(response.result.content[0].text).toContain("Error:");
    });
  });
});