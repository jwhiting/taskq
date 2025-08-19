import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { TaskStore } from '../../core/index';
import { formatTable } from '../utils/responses';

/**
 * Register all task management tools with the MCP server
 */
export function registerTaskTools(server: McpServer, taskStore: TaskStore) {
  // Tool 1: add_task
  server.registerTool(
    'add_task',
    {
      title: 'Add Task',
      description: 'Add a new task to a queue',
      inputSchema: {
        queue: z.string().describe('Queue name to add task to'),
        title: z.string().describe('Task title'),
        description: z.string().optional().describe('Task description'),
        priority: z.number().min(1).max(10).optional().describe('Task priority (1-10, default 5)'),
        parameters: z.record(z.any()).optional().describe('Task parameters as key-value pairs'),
        instructions: z.string().optional().describe('Task-specific instructions'),
      },
    },
    async ({ queue, title, description, priority, parameters, instructions }) => {
      try {
        const request: any = { queueName: queue, title };
        if (description !== undefined) request.description = description;
        if (priority !== undefined) request.priority = priority;
        if (parameters !== undefined) request.parameters = parameters;
        if (instructions !== undefined) request.instructions = instructions;

        const task = taskStore.addTask(request);

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  success: true,
                  message: `Task '${title}' added to queue '${queue}'`,
                  task,
                },
                null,
                2
              ),
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Error: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  // Tool 2: update_task
  server.registerTool(
    'update_task',
    {
      title: 'Update Task',
      description: "Update an existing task's properties",
      inputSchema: {
        task_id: z.number().describe('Task ID to update'),
        title: z.string().optional().describe('New task title'),
        description: z.string().optional().describe('New task description'),
        priority: z.number().min(1).max(10).optional().describe('New task priority (1-10)'),
        parameters: z.record(z.any()).optional().describe('New task parameters as key-value pairs'),
        instructions: z.string().optional().describe('New task-specific instructions'),
      },
    },
    async ({ task_id, title, description, priority, parameters, instructions }) => {
      try {
        const request: any = {};
        if (title !== undefined) request.title = title;
        if (description !== undefined) request.description = description;
        if (priority !== undefined) request.priority = priority;
        if (parameters !== undefined) request.parameters = parameters;
        if (instructions !== undefined) request.instructions = instructions;

        const task = taskStore.updateTask(task_id, request);

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  success: true,
                  message: `Task ${task_id} updated successfully`,
                  task,
                },
                null,
                2
              ),
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Error: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  // Tool 3: checkout_task
  server.registerTool(
    'checkout_task',
    {
      title: 'Checkout Task',
      description:
        'Checkout a task (by queue name for next available, or by task ID for specific task)',
      inputSchema: {
        queue_or_task_id: z
          .string()
          .describe('Queue name (for next available task) or task ID (for specific task)'),
        worker_id: z.string().optional().describe('Optional worker identifier'),
      },
    },
    async ({ queue_or_task_id, worker_id }) => {
      try {
        // Check if it's a number (task ID) or string (queue name)
        const isTaskId = /^\d+$/.test(queue_or_task_id);

        let task;
        if (isTaskId) {
          task = taskStore.checkoutTask(parseInt(queue_or_task_id), worker_id);
        } else {
          task = taskStore.checkoutTask(queue_or_task_id, worker_id);
        }

        if (!task) {
          throw new Error('No tasks available to checkout');
        }

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  success: true,
                  message: `Task ${task.id} checked out successfully`,
                  task,
                },
                null,
                2
              ),
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Error: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  // Tool 4: complete_task
  server.registerTool(
    'complete_task',
    {
      title: 'Complete Task',
      description: 'Mark a task as completed',
      inputSchema: {
        task_id: z.number().describe('Task ID to complete'),
      },
    },
    async ({ task_id }) => {
      try {
        const task = taskStore.completeTask(task_id);

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  success: true,
                  message: `Task ${task_id} marked as completed`,
                  task,
                },
                null,
                2
              ),
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Error: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  // Tool 5: reset_task
  server.registerTool(
    'reset_task',
    {
      title: 'Reset Task',
      description: 'Reset a checked-out task back to pending',
      inputSchema: {
        task_id: z.number().describe('Task ID to reset'),
      },
    },
    async ({ task_id }) => {
      try {
        const task = taskStore.resetTask(task_id);

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  success: true,
                  message: `Task ${task_id} reset to pending`,
                  task,
                },
                null,
                2
              ),
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Error: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  // Tool 6: fail_task
  server.registerTool(
    'fail_task',
    {
      title: 'Fail Task',
      description: 'Mark a task as failed',
      inputSchema: {
        task_id: z.number().describe('Task ID to mark as failed'),
      },
    },
    async ({ task_id }) => {
      try {
        const task = taskStore.failTask(task_id);

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  success: true,
                  message: `Task ${task_id} marked as failed`,
                  task,
                },
                null,
                2
              ),
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Error: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  // Tool 7: delete_task
  server.registerTool(
    'delete_task',
    {
      title: 'Delete Task',
      description: 'Delete a task from the queue',
      inputSchema: {
        task_id: z.number().describe('Task ID to delete'),
      },
    },
    async ({ task_id }) => {
      try {
        taskStore.deleteTask(task_id);

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  success: true,
                  message: `Task ${task_id} deleted successfully`,
                },
                null,
                2
              ),
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Error: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  // Tool 8: list_tasks
  server.registerTool(
    'list_tasks',
    {
      title: 'List Tasks',
      description: 'List tasks in a queue with optional status filter',
      inputSchema: {
        queue: z.string().describe('Queue name to list tasks from'),
        status: z
          .enum(['pending', 'checked_out', 'completed', 'failed'])
          .optional()
          .describe('Filter by task status'),
        limit: z.number().optional().describe('Maximum number of tasks to return'),
      },
    },
    async ({ queue, status, limit }) => {
      try {
        const tasks = taskStore.listTasks(queue, status, limit);

        if (tasks.length === 0) {
          return {
            content: [
              {
                type: 'text',
                text: `No tasks found in queue '${queue}'${status ? ` with status '${status}'` : ''}.`,
              },
            ],
          };
        }

        const headers = ['ID', 'Title', 'Status', 'Priority', 'Created'];
        const rows = tasks.map(task => [
          task.id.toString(),
          task.title.substring(0, 50) + (task.title.length > 50 ? '...' : ''),
          task.status,
          task.priority.toString(),
          new Date(task.createdAt).toLocaleString(),
        ]);

        const table = formatTable(headers, rows);

        return {
          content: [
            {
              type: 'text',
              text: `Tasks in queue '${queue}':\n\n${table}`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Error: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  // Tool 9: inspect_task
  server.registerTool(
    'inspect_task',
    {
      title: 'Inspect Task',
      description: 'Get detailed information about a specific task',
      inputSchema: {
        task_id: z.number().describe('Task ID to inspect'),
      },
    },
    async ({ task_id }) => {
      try {
        const task = taskStore.getTask(task_id);
        if (!task) {
          throw new Error(`Task ${task_id} not found`);
        }

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  success: true,
                  task,
                },
                null,
                2
              ),
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Error: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    }
  );
}
