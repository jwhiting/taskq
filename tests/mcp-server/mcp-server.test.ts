import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { tmpdir } from "os";
import { join } from "path";
import { unlinkSync, existsSync } from "fs";
import { TaskStore } from "../../src/core/index.js";
import { registerQueueTools } from "../../src/mcp-server/tools/queue-tools.js";
import { registerTaskTools } from "../../src/mcp-server/tools/task-tools.js";
import { registerStatusTools } from "../../src/mcp-server/tools/status-tools.js";

describe("TaskQ MCP Server - Full Integration Tests", () => {
  let taskStore: TaskStore;
  let server: McpServer;
  let clientTransport: any;
  let serverTransport: any;
  let testDbPath: string;

  beforeEach(async () => {
    // Create isolated test database (real database, no mocks)
    testDbPath = join(tmpdir(), `test-taskq-mcp-${Date.now()}-${Math.random()}.db`);
    taskStore = new TaskStore({ dbPath: testDbPath });

    // Create real MCP server
    server = new McpServer({
      name: "taskq-test-server",
      version: "0.1.0"
    });

    // Register all tools (real implementations, no mocks)
    registerQueueTools(server, taskStore);
    registerTaskTools(server, taskStore);
    registerStatusTools(server, taskStore);

    // Create real transport pair (no mocks)
    const transports = InMemoryTransport.createLinkedPair();
    clientTransport = transports[0];
    serverTransport = transports[1];

    // Connect real server to real transport
    await server.connect(serverTransport);
  });

  afterEach(async () => {
    // Clean up real test database
    if (existsSync(testDbPath)) {
      unlinkSync(testDbPath);
    }
  });

  // Helper function to send real MCP requests (no mocks)
  async function sendMcpRequest(method: string, params: any = {}): Promise<any> {
    return new Promise((resolve, reject) => {
      const requestId = Math.random().toString(36);
      
      clientTransport.onmessage = (message: any) => {
        if (message.id === requestId) {
          resolve(message);
        }
      };
      
      clientTransport.onerror = (error: any) => {
        reject(error);
      };

      clientTransport.send({
        jsonrpc: "2.0",
        id: requestId,
        method,
        params
      });
    });
  }

  describe("Tool Discovery", () => {
    test("should list all 16 tools via MCP protocol", async () => {
      const response = await sendMcpRequest("tools/list");

      expect(response.result.tools).toBeDefined();
      expect(response.result.tools).toHaveLength(16);
      
      // Verify all expected tools are present
      const toolNames = response.result.tools.map((tool: any) => tool.name).sort();
      expect(toolNames).toEqual([
        "add_task",
        "checkout_task", 
        "complete_task",
        "create_queue",
        "delete_queue",
        "delete_task",
        "fail_task",
        "get_status",
        "inspect_queue",
        "inspect_task",
        "list_queues",
        "list_tasks",
        "reset_task",
        "update_queue",
        "update_task",
        "update_task_journal"
      ]);
    });

    test("tools should have proper schemas and descriptions", async () => {
      const response = await sendMcpRequest("tools/list");
      
      response.result.tools.forEach((tool: any) => {
        expect(tool.name).toBeDefined();
        expect(tool.description).toBeDefined();
        expect(tool.inputSchema).toBeDefined();
        expect(typeof tool.name).toBe("string");
        expect(typeof tool.description).toBe("string");
        expect(typeof tool.inputSchema).toBe("object");
      });
    });
  });

  describe("Queue Operations via MCP", () => {
    test("create_queue should work through MCP protocol", async () => {
      const response = await sendMcpRequest("tools/call", {
        name: "create_queue",
        arguments: {
          name: "test-queue",
          description: "Test queue via MCP",
          instructions: "Test instructions"
        }
      });

      expect(response.result.content).toBeDefined();
      expect(response.result.content[0].type).toBe("text");
      
      const result = JSON.parse(response.result.content[0].text);
      expect(result.success).toBe(true);
      expect(result.queue.name).toBe("test-queue");
      expect(result.queue.description).toBe("Test queue via MCP");
      
      // Verify in real database (no mocks)
      const queue = taskStore.getQueue("test-queue");
      expect(queue).toBeTruthy();
      expect(queue!.name).toBe("test-queue");
    });

    test("list_queues should return formatted output via MCP", async () => {
      // First create a queue through real TaskStore
      taskStore.createQueue({ 
        name: "list-test-queue", 
        description: "Queue for list test" 
      });

      const response = await sendMcpRequest("tools/call", {
        name: "list_queues",
        arguments: {}
      });

      expect(response.result.content[0].text).toContain("list-test-queue");
      expect(response.result.content[0].text).toContain("Queue for list test");
      expect(response.result.content[0].text).toContain("Queues:");
    });

    test("inspect_queue should return detailed queue info", async () => {
      // Create queue through real TaskStore
      taskStore.createQueue({ 
        name: "inspect-queue", 
        description: "Queue to inspect",
        instructions: "Test instructions" 
      });

      const response = await sendMcpRequest("tools/call", {
        name: "inspect_queue",
        arguments: { name: "inspect-queue" }
      });

      const result = JSON.parse(response.result.content[0].text);
      expect(result.success).toBe(true);
      expect(result.queue.name).toBe("inspect-queue");
      expect(result.queue.description).toBe("Queue to inspect");
      expect(result.queue.instructions).toBe("Test instructions");
    });

    test("delete_queue should work and verify in database", async () => {
      // Create queue first
      taskStore.createQueue({ name: "delete-me", description: "Queue to delete" });

      const response = await sendMcpRequest("tools/call", {
        name: "delete_queue",
        arguments: { name: "delete-me" }
      });

      const result = JSON.parse(response.result.content[0].text);
      expect(result.success).toBe(true);
      expect(result.message).toContain("deleted successfully");

      // Verify deletion in real database
      const queue = taskStore.getQueue("delete-me");
      expect(queue).toBeNull();
    });

    test("update_queue should modify queue properties", async () => {
      // Create initial queue
      taskStore.createQueue({ name: "update-me", description: "Original" });

      const response = await sendMcpRequest("tools/call", {
        name: "update_queue",
        arguments: { 
          name: "update-me", 
          description: "Updated description",
          instructions: "New instructions"
        }
      });

      const result = JSON.parse(response.result.content[0].text);
      expect(result.success).toBe(true);

      // Verify update in real database
      const queue = taskStore.getQueue("update-me");
      expect(queue!.description).toBe("Updated description");
      expect(queue!.instructions).toBe("New instructions");
    });
  });

  describe("Task Operations via MCP", () => {
    beforeEach(async () => {
      // Create test queue for tasks
      taskStore.createQueue({ name: "task-queue", description: "Queue for task tests" });
    });

    test("add_task should work through MCP protocol", async () => {
      const response = await sendMcpRequest("tools/call", {
        name: "add_task",
        arguments: {
          queue: "task-queue",
          title: "MCP Test Task",
          description: "Task added via MCP",
          priority: 8,
          parameters: { key: "value", test: true }
        }
      });

      const result = JSON.parse(response.result.content[0].text);
      expect(result.success).toBe(true);
      expect(result.task.title).toBe("MCP Test Task");
      expect(result.task.priority).toBe(8);

      // Verify in real database
      const tasks = taskStore.listTasks("task-queue");
      expect(tasks).toHaveLength(1);
      expect(tasks[0]!.title).toBe("MCP Test Task");
      expect(tasks[0]!.parameters).toEqual({ key: "value", test: true });
    });

    test("checkout_task should work with queue name", async () => {
      // Add a task first
      const task = taskStore.addTask({ 
        queueName: "task-queue", 
        title: "Checkout Test", 
        description: "Task to checkout" 
      });

      const response = await sendMcpRequest("tools/call", {
        name: "checkout_task",
        arguments: {
          queue_or_task_id: "task-queue",
          worker_id: "test-worker"
        }
      });

      const result = JSON.parse(response.result.content[0].text);
      expect(result.success).toBe(true);
      expect(result.task.id).toBe(task.id);

      // Verify checkout in real database
      const checkedOutTask = taskStore.getTask(task.id);
      expect(checkedOutTask!.status).toBe("checked_out");
      expect(checkedOutTask!.workerId).toBe("test-worker");
    });

    test("checkout_task should work with specific task ID", async () => {
      // Add a task first  
      const task = taskStore.addTask({
        queueName: "task-queue",
        title: "Specific Checkout Test"
      });

      const response = await sendMcpRequest("tools/call", {
        name: "checkout_task", 
        arguments: {
          queue_or_task_id: task.id.toString(),
          worker_id: "specific-worker"
        }
      });

      const result = JSON.parse(response.result.content[0].text);
      expect(result.success).toBe(true);
      expect(result.task.id).toBe(task.id);

      // Verify in real database
      const checkedOutTask = taskStore.getTask(task.id);
      expect(checkedOutTask!.status).toBe("checked_out");
      expect(checkedOutTask!.workerId).toBe("specific-worker");
    });

    test("complete_task should mark task as completed", async () => {
      // Add and checkout a task
      const task = taskStore.addTask({ queueName: "task-queue", title: "Complete Test" });
      taskStore.checkoutTask(task.id, "test-worker");

      const response = await sendMcpRequest("tools/call", {
        name: "complete_task",
        arguments: { task_id: task.id }
      });

      const result = JSON.parse(response.result.content[0].text);
      expect(result.success).toBe(true);

      // Verify in real database
      const completedTask = taskStore.getTask(task.id);
      expect(completedTask!.status).toBe("completed");
      expect(completedTask!.completedAt).toBeTruthy();
    });

    test("reset_task should reset task to pending", async () => {
      // Add and checkout a task
      const task = taskStore.addTask({ queueName: "task-queue", title: "Reset Test" });
      taskStore.checkoutTask(task.id, "test-worker");

      const response = await sendMcpRequest("tools/call", {
        name: "reset_task",
        arguments: { task_id: task.id }
      });

      const result = JSON.parse(response.result.content[0].text);
      expect(result.success).toBe(true);

      // Verify in real database
      const resetTask = taskStore.getTask(task.id);
      expect(resetTask!.status).toBe("pending");
      expect(resetTask!.workerId).toBeNull();
    });

    test("fail_task should mark task as failed", async () => {
      // Add and checkout a task
      const task = taskStore.addTask({ queueName: "task-queue", title: "Fail Test" });
      taskStore.checkoutTask(task.id, "test-worker");

      const response = await sendMcpRequest("tools/call", {
        name: "fail_task",
        arguments: { task_id: task.id }
      });

      const result = JSON.parse(response.result.content[0].text);
      expect(result.success).toBe(true);

      // Verify in real database
      const failedTask = taskStore.getTask(task.id);
      expect(failedTask!.status).toBe("failed");
    });

    test("list_tasks should return formatted task list", async () => {
      // Add some tasks
      taskStore.addTask({ queueName: "task-queue", title: "Task 1", priority: 5 });
      taskStore.addTask({ queueName: "task-queue", title: "Task 2", priority: 8 });

      const response = await sendMcpRequest("tools/call", {
        name: "list_tasks",
        arguments: { queue: "task-queue" }
      });

      expect(response.result.content[0].text).toContain("Tasks in queue 'task-queue'");
      expect(response.result.content[0].text).toContain("Task 1");
      expect(response.result.content[0].text).toContain("Task 2");
    });

    test("inspect_task should return detailed task info", async () => {
      const task = taskStore.addTask({ 
        queueName: "task-queue", 
        title: "Inspect Test",
        description: "Task to inspect",
        priority: 7
      });

      const response = await sendMcpRequest("tools/call", {
        name: "inspect_task",
        arguments: { task_id: task.id }
      });

      const result = JSON.parse(response.result.content[0].text);
      expect(result.success).toBe(true);
      expect(result.task.id).toBe(task.id);
      expect(result.task.title).toBe("Inspect Test");
      expect(result.task.description).toBe("Task to inspect");
      expect(result.task.priority).toBe(7);
    });

    test("update_task should modify task properties", async () => {
      const task = taskStore.addTask({ 
        queueName: "task-queue", 
        title: "Original Title",
        priority: 5 
      });

      const response = await sendMcpRequest("tools/call", {
        name: "update_task",
        arguments: { 
          task_id: task.id,
          title: "Updated Title",
          priority: 9,
          description: "Updated description"
        }
      });

      const result = JSON.parse(response.result.content[0].text);
      expect(result.success).toBe(true);

      // Verify in real database
      const updatedTask = taskStore.getTask(task.id);
      expect(updatedTask!.title).toBe("Updated Title");
      expect(updatedTask!.priority).toBe(9);
      expect(updatedTask!.description).toBe("Updated description");
    });

    test("delete_task should remove task from database", async () => {
      const task = taskStore.addTask({ queueName: "task-queue", title: "Delete Test" });

      const response = await sendMcpRequest("tools/call", {
        name: "delete_task", 
        arguments: { task_id: task.id }
      });

      const result = JSON.parse(response.result.content[0].text);
      expect(result.success).toBe(true);

      // Verify deletion in real database
      const deletedTask = taskStore.getTask(task.id);
      expect(deletedTask).toBeNull();
    });
  });

  describe("Status Operations via MCP", () => {
    test("get_status should return system-wide status", async () => {
      // Create test data
      taskStore.createQueue({ name: "status-queue", description: "Queue for status test" });
      taskStore.addTask({ queueName: "status-queue", title: "Status Task" });

      const response = await sendMcpRequest("tools/call", {
        name: "get_status",
        arguments: {}
      });

      expect(response.result.content[0].text).toContain("TaskQ System Status");
      expect(response.result.content[0].text).toContain("Total Queues: 1");
      expect(response.result.content[0].text).toContain("Total Tasks: 1");
      expect(response.result.content[0].text).toContain("status-queue");
    });

    test("get_status should return queue-specific status", async () => {
      taskStore.createQueue({ name: "specific-queue", description: "Specific queue test" });
      taskStore.addTask({ queueName: "specific-queue", title: "Task 1" });
      taskStore.addTask({ queueName: "specific-queue", title: "Task 2" });

      const response = await sendMcpRequest("tools/call", {
        name: "get_status",
        arguments: { queue: "specific-queue" }
      });

      expect(response.result.content[0].text).toContain("Queue: specific-queue");
      expect(response.result.content[0].text).toContain("Total Tasks: 2");
      expect(response.result.content[0].text).toContain("Pending: 2");
    });

    test("update_task_journal should add journal entry", async () => {
      // Ensure we have a test queue for this test
      taskStore.createQueue({ name: "journal-queue", description: "Queue for journal test" });
      const task = taskStore.addTask({ queueName: "journal-queue", title: "Journal Test" });

      const response = await sendMcpRequest("tools/call", {
        name: "update_task_journal",
        arguments: {
          task_id: task.id,
          status: "checked_out",
          notes: "Test journal entry"
        }
      });

      const result = JSON.parse(response.result.content[0].text);
      expect(result.success).toBe(true);
      expect(result.journalEntry.taskId).toBe(task.id);
      expect(result.journalEntry.status).toBe("checked_out");
      expect(result.journalEntry.notes).toBe("Test journal entry");
    });
  });

  describe("Error Handling via MCP", () => {
    test("should handle invalid queue name gracefully", async () => {
      const response = await sendMcpRequest("tools/call", {
        name: "inspect_queue",
        arguments: { name: "non-existent-queue" }
      });

      expect(response.result.isError).toBe(true);
      expect(response.result.content[0].text).toContain("Error:");
      expect(response.result.content[0].text).toContain("not found");
    });

    test("should handle invalid task ID gracefully", async () => {
      const response = await sendMcpRequest("tools/call", {
        name: "inspect_task",
        arguments: { task_id: 99999 }
      });

      expect(response.result.isError).toBe(true);
      expect(response.result.content[0].text).toContain("Error:");
      expect(response.result.content[0].text).toContain("not found");
    });

    test("should handle duplicate queue creation", async () => {
      // Create queue first
      taskStore.createQueue({ name: "duplicate-test", description: "First" });

      const response = await sendMcpRequest("tools/call", {
        name: "create_queue",
        arguments: { name: "duplicate-test", description: "Second" }
      });

      expect(response.result.isError).toBe(true);
      expect(response.result.content[0].text).toContain("Error:");
    });

    test("should handle checkout of non-existent queue", async () => {
      const response = await sendMcpRequest("tools/call", {
        name: "checkout_task",
        arguments: { queue_or_task_id: "non-existent-queue" }
      });

      expect(response.result.isError).toBe(true);
      expect(response.result.content[0].text).toContain("Error:");
    });
  });
});