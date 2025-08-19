import { Command } from 'commander';
import { TaskStore } from '../../core/TaskStore';
import { formatQueueStats, formatJournalTable } from '../utils/formatting';

export function registerStatusCommands(program: Command): void {
  program
    .command('status')
    .description('Show system or queue status')
    .argument('[queue]', 'Optional queue name for queue-specific status')
    .action(async (queueName?: string) => {
      try {
        const store = new TaskStore({ dbPath: program.getOptionValue('db-path') });

        if (queueName) {
          // Queue-specific status
          const queue = store.getQueue(queueName);
          if (!queue) {
            console.error(`Queue '${queueName}' not found.`);
            throw new Error(`Queue '${queueName}' not found.`);
          }

          const stats = store.getQueueStats(queueName);
          console.log(`Status for queue: ${queueName}`);
          console.log(formatQueueStats(stats));
        } else {
          // System-wide status
          const queues = store.listQueues();

          if (queues.length === 0) {
            console.log('No queues found.');
            return;
          }

          console.log('System Status:\n');

          let totalTasks = 0;
          let totalPending = 0;
          let totalCheckedOut = 0;
          let totalCompleted = 0;
          let totalFailed = 0;

          for (const queue of queues) {
            const stats = store.getQueueStats(queue.name);
            totalTasks += stats.total;
            totalPending += stats.pending;
            totalCheckedOut += stats.checkedOut;
            totalCompleted += stats.completed;
            totalFailed += stats.failed;

            console.log(`Queue: ${queue.name}`);
            console.log(`  ${formatQueueStats(stats).replace(/\n/g, '\n  ')}`);
            console.log('');
          }

          console.log('Overall Totals:');
          console.log(
            formatQueueStats({
              total: totalTasks,
              pending: totalPending,
              checkedOut: totalCheckedOut,
              completed: totalCompleted,
              failed: totalFailed,
            })
          );
        }
      } catch (error) {
        const err = error as Error;
        console.error('Error getting status:', err.message);
        throw err; // Let Commander handle the exit via exitOverride
      }
    });

  program
    .command('journal')
    .description('Show task status journal')
    .argument('<task-id>', 'Task ID')
    .action(async (taskIdStr: string) => {
      try {
        const store = new TaskStore({ dbPath: program.getOptionValue('db-path') });

        const taskId = parseInt(taskIdStr, 10);
        if (isNaN(taskId)) {
          console.error('Invalid task ID. Must be a number.');
          throw new Error('Invalid task ID. Must be a number.');
        }

        // Verify task exists
        const task = store.getTask(taskId);
        if (!task) {
          console.error(`Task ${taskId} not found.`);
          throw new Error(`Task ${taskId} not found.`);
        }

        const journal = store.getTaskJournal(taskId);
        console.log(`Journal for task ${taskId}: ${task.title}`);
        console.log(formatJournalTable(journal));
      } catch (error) {
        const err = error as Error;
        console.error('Error getting journal:', err.message);
        throw err; // Let Commander handle the exit via exitOverride
      }
    });
}
