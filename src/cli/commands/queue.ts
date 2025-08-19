import { Command } from 'commander';
import { TaskStore } from '../../core/TaskStore.js';
import { formatQueue, formatQueueTable, formatQueueStats } from '../utils/formatting.js';

export function registerQueueCommands(program: Command): void {
  program
    .command('create-queue')
    .description('Create a new queue')
    .argument('<name>', 'Queue name')
    .option('-d, --description <description>', 'Queue description')
    .option('-i, --instructions <instructions>', 'Default instructions for tasks in this queue')
    .action(async (name: string, options: { description?: string; instructions?: string }) => {
      try {
        const store = new TaskStore({ dbPath: program.getOptionValue('db-path') });

        const queue = store.createQueue({
          name,
          ...(options.description !== undefined && { description: options.description }),
          ...(options.instructions !== undefined && { instructions: options.instructions }),
        });

        console.log('Queue created successfully:');
        console.log(formatQueue(queue));
      } catch (error) {
        const err = error as Error;
        console.error('Error creating queue:', err.message);
        throw err; // Let Commander handle the exit via exitOverride
      }
    });

  program
    .command('update-queue')
    .description('Update an existing queue')
    .argument('<name>', 'Queue name')
    .option('-d, --description <description>', 'Queue description (empty string to clear)')
    .option('-i, --instructions <instructions>', 'Default instructions (empty string to clear)')
    .action(async (name: string, options: { description?: string; instructions?: string }) => {
      try {
        const store = new TaskStore({ dbPath: program.getOptionValue('db-path') });

        const queue = store.updateQueue(name, {
          ...(options.description !== undefined && { description: options.description }),
          ...(options.instructions !== undefined && { instructions: options.instructions }),
        });

        console.log('Queue updated successfully:');
        console.log(formatQueue(queue));
      } catch (error) {
        const err = error as Error;
        console.error('Error updating queue:', err.message);
        throw err; // Let Commander handle the exit via exitOverride
      }
    });

  program
    .command('delete-queue')
    .description('Delete a queue and all its tasks')
    .argument('<name>', 'Queue name')
    .option('-f, --force', 'Skip confirmation prompt')
    .action(async (name: string, options: { force?: boolean }) => {
      try {
        const store = new TaskStore({ dbPath: program.getOptionValue('db-path') });

        if (!options.force) {
          // Simple confirmation - no fancy prompts
          const stats = store.getQueueStats(name);
          if (stats.total > 0) {
            console.log(
              `Warning: Queue '${name}' contains ${stats.total} tasks that will be deleted.`
            );
            console.log('Use --force to skip this confirmation.');
            throw new Error('Delete operation cancelled - use --force to override');
          }
        }

        store.deleteQueue(name);
        console.log(`Queue '${name}' deleted successfully.`);
      } catch (error) {
        const err = error as Error;
        console.error('Error deleting queue:', err.message);
        throw err; // Let Commander handle the exit via exitOverride
      }
    });

  program
    .command('list-queues')
    .description('List all queues')
    .action(async () => {
      try {
        const store = new TaskStore({ dbPath: program.getOptionValue('db-path') });

        const queues = store.listQueues();
        console.log(formatQueueTable(queues));
      } catch (error) {
        const err = error as Error;
        console.error('Error listing queues:', err.message);
        throw err; // Let Commander handle the exit via exitOverride
      }
    });

  program
    .command('inspect-queue')
    .description('Inspect a queue and show its details and statistics')
    .argument('<name>', 'Queue name')
    .action(async (name: string) => {
      try {
        const store = new TaskStore({ dbPath: program.getOptionValue('db-path') });

        const queue = store.getQueue(name);
        if (!queue) {
          console.error(`Queue '${name}' not found.`);
          throw new Error(`Queue '${name}' not found.`);
        }

        const stats = store.getQueueStats(name);

        console.log(formatQueue(queue));
        console.log('\nStatistics:');
        console.log(formatQueueStats(stats));
      } catch (error) {
        const err = error as Error;
        console.error('Error inspecting queue:', err.message);
        throw err; // Let Commander handle the exit via exitOverride
      }
    });
}
