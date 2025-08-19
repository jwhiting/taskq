import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { TaskStore } from '../../core/index';
import { formatTable } from '../utils/responses';

/**
 * Register all queue management tools with the MCP server
 */
export function registerQueueTools(server: McpServer, taskStore: TaskStore) {
  // Tool 1: create_queue
  server.registerTool(
    'create_queue',
    {
      title: 'Create Queue',
      description: 'Create a new task queue with optional description and instructions',
      inputSchema: {
        name: z.string().describe('Unique queue name'),
        description: z.string().optional().describe('Queue description'),
        instructions: z
          .string()
          .optional()
          .describe('Default instructions for all tasks in this queue'),
      },
    },
    async ({ name, description, instructions }) => {
      try {
        const request: any = { name };
        if (description !== undefined) request.description = description;
        if (instructions !== undefined) request.instructions = instructions;

        const queue = taskStore.createQueue(request);

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  success: true,
                  message: `Queue '${name}' created successfully`,
                  queue,
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

  // Tool 2: update_queue
  server.registerTool(
    'update_queue',
    {
      title: 'Update Queue',
      description: "Update an existing queue's description and/or instructions",
      inputSchema: {
        name: z.string().describe('Queue name to update'),
        description: z.string().optional().describe('New description (empty string to clear)'),
        instructions: z.string().optional().describe('New instructions (empty string to clear)'),
      },
    },
    async ({ name, description, instructions }) => {
      try {
        const request: any = {};
        if (description !== undefined) request.description = description;
        if (instructions !== undefined) request.instructions = instructions;

        const queue = taskStore.updateQueue(name, request);

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  success: true,
                  message: `Queue '${name}' updated successfully`,
                  queue,
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

  // Tool 3: delete_queue
  server.registerTool(
    'delete_queue',
    {
      title: 'Delete Queue',
      description: 'Delete a queue and all its tasks',
      inputSchema: {
        name: z.string().describe('Queue name to delete'),
      },
    },
    async ({ name }) => {
      try {
        taskStore.deleteQueue(name);

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  success: true,
                  message: `Queue '${name}' deleted successfully`,
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

  // Tool 4: list_queues
  server.registerTool(
    'list_queues',
    {
      title: 'List Queues',
      description: 'List all queues with summary information',
      inputSchema: {},
    },
    async () => {
      try {
        const queues = taskStore.listQueues();

        if (queues.length === 0) {
          return {
            content: [
              {
                type: 'text',
                text: 'No queues found.',
              },
            ],
          };
        }

        const headers = ['Name', 'Description', 'Tasks', 'Created'];
        const rows = queues.map(queue => {
          const stats = taskStore.getQueueStats(queue.name);
          return [
            queue.name,
            queue.description || '',
            stats.total.toString(),
            new Date(queue.createdAt).toLocaleString(),
          ];
        });

        const table = formatTable(headers, rows);

        return {
          content: [
            {
              type: 'text',
              text: `Queues:\n\n${table}`,
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

  // Tool 5: inspect_queue
  server.registerTool(
    'inspect_queue',
    {
      title: 'Inspect Queue',
      description: 'Get detailed information about a specific queue',
      inputSchema: {
        name: z.string().describe('Queue name to inspect'),
      },
    },
    async ({ name }) => {
      try {
        const queue = taskStore.getQueue(name);
        if (!queue) {
          throw new Error(`Queue '${name}' not found`);
        }

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  success: true,
                  queue,
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
