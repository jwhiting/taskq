import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { TaskStore } from '../../core/index.js';
import { formatTable } from '../utils/responses.js';

/**
 * Register all status and journal tools with the MCP server
 */
export function registerStatusTools(server: McpServer, taskStore: TaskStore) {
  // Tool 1: get_status
  server.registerTool(
    'get_status',
    {
      title: 'Get Status',
      description: 'Get system-wide status or queue-specific status',
      inputSchema: {
        queue: z.string().optional().describe('Optional queue name for queue-specific status'),
      },
    },
    async ({ queue }) => {
      try {
        if (queue) {
          // Queue-specific status
          const queueObj = taskStore.getQueue(queue);
          if (!queueObj) {
            throw new Error(`Queue '${queue}' not found`);
          }
          const stats = taskStore.getQueueStats(queue);

          const summary = [
            `Queue: ${queueObj.name}`,
            `Description: ${queueObj.description || 'None'}`,
            `Total Tasks: ${stats.total}`,
            `Pending: ${stats.pending}`,
            `Checked Out: ${stats.checkedOut}`,
            `Completed: ${stats.completed}`,
            `Failed: ${stats.failed}`,
            `Created: ${new Date(queueObj.createdAt).toLocaleString()}`,
            `Updated: ${new Date(queueObj.updatedAt).toLocaleString()}`,
          ].join('\n');

          return {
            content: [
              {
                type: 'text',
                text: `Queue Status:\n\n${summary}`,
              },
            ],
          };
        } else {
          // System-wide status
          const queues = taskStore.listQueues();
          let totalTasks = 0;
          let pendingTasks = 0;
          let checkedOutTasks = 0;
          let completedTasks = 0;
          let failedTasks = 0;

          const queueSummaries = queues.map(queueObj => {
            const stats = taskStore.getQueueStats(queueObj.name);
            totalTasks += stats.total;
            pendingTasks += stats.pending;
            checkedOutTasks += stats.checkedOut;
            completedTasks += stats.completed;
            failedTasks += stats.failed;

            return {
              name: queueObj.name,
              totalTasks: stats.total,
              pendingTasks: stats.pending,
              checkedOutTasks: stats.checkedOut,
              completedTasks: stats.completed,
              failedTasks: stats.failed,
            };
          });

          const summary = [
            'TaskQ System Status',
            '===================',
            '',
            `Total Queues: ${queues.length}`,
            `Total Tasks: ${totalTasks}`,
            `Pending Tasks: ${pendingTasks}`,
            `Checked Out Tasks: ${checkedOutTasks}`,
            `Completed Tasks: ${completedTasks}`,
            `Failed Tasks: ${failedTasks}`,
            '',
            'Queue Summary:',
            '',
          ];

          if (queueSummaries.length > 0) {
            const headers = ['Queue', 'Total', 'Pending', 'Checked Out', 'Completed', 'Failed'];
            const rows = queueSummaries.map(q => [
              q.name,
              q.totalTasks.toString(),
              q.pendingTasks.toString(),
              q.checkedOutTasks.toString(),
              q.completedTasks.toString(),
              q.failedTasks.toString(),
            ]);

            const table = formatTable(headers, rows);
            summary.push(table);
          } else {
            summary.push('No queues found.');
          }

          return {
            content: [
              {
                type: 'text',
                text: summary.join('\n'),
              },
            ],
          };
        }
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

  // Tool 2: update_task_journal
  server.registerTool(
    'update_task_journal',
    {
      title: 'Update Task Journal',
      description: 'Add a journal entry to track task status changes',
      inputSchema: {
        task_id: z.number().describe('Task ID to add journal entry for'),
        status: z
          .enum(['pending', 'checked_out', 'completed', 'failed'])
          .describe('Status for this journal entry'),
        notes: z.string().optional().describe('Optional notes for this status change'),
      },
    },
    async ({ task_id, status, notes }) => {
      try {
        const request: any = { taskId: task_id, status };
        if (notes !== undefined) request.notes = notes;

        const journalEntry = taskStore.addJournalEntry(request);

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  success: true,
                  message: `Journal entry added for task ${task_id}`,
                  journalEntry,
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
