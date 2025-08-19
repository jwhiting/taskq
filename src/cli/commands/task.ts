import { Command } from 'commander';
import { TaskStore } from '../../core/TaskStore';
import { TaskStatus } from '../../core/models/Task';
import { formatTask, formatTaskTable, parseParameters } from '../utils/formatting';

export function registerTaskCommands(program: Command): void {
  program
    .command('add-task')
    .description('Add a new task to a queue')
    .argument('<queue>', 'Queue name')
    .argument('<title>', 'Task title')
    .option('-d, --description <description>', 'Task description')
    .option('-p, --priority <priority>', 'Task priority (1-10)', '5')
    .option('--parameters <parameters>', 'Task parameters (JSON or key=value,key2=value2)')
    .option('-i, --instructions <instructions>', 'Task-specific instructions')
    .action(
      async (
        queueName: string,
        title: string,
        options: {
          description?: string;
          priority?: string;
          parameters?: string;
          instructions?: string;
        }
      ) => {
        try {
          const store = new TaskStore({ dbPath: program.getOptionValue('db-path') });

          let parameters: Record<string, unknown> | undefined;
          if (options.parameters) {
            parameters = parseParameters(options.parameters);
          }

          const task = store.addTask({
            queueName,
            title,
            ...(options.description !== undefined && { description: options.description }),
            priority: parseInt(options.priority || '5', 10),
            ...(parameters !== undefined && { parameters }),
            ...(options.instructions !== undefined && { instructions: options.instructions }),
          });

          console.log('Task added successfully:');
          console.log(formatTask(task));
        } catch (error) {
          const err = error as Error;
          console.error('Error adding task:', err.message);
          process.exit(1);
        }
      }
    );

  program
    .command('update-task')
    .description('Update an existing task')
    .argument('<task-id>', 'Task ID')
    .option('-t, --title <title>', 'Task title')
    .option('-d, --description <description>', 'Task description (empty string to clear)')
    .option('-p, --priority <priority>', 'Task priority (1-10)')
    .option('--parameters <parameters>', 'Task parameters (JSON or key=value,key2=value2)')
    .option(
      '-i, --instructions <instructions>',
      'Task-specific instructions (empty string to clear)'
    )
    .action(
      async (
        taskIdStr: string,
        options: {
          title?: string;
          description?: string;
          priority?: string;
          parameters?: string;
          instructions?: string;
        }
      ) => {
        try {
          const store = new TaskStore({ dbPath: program.getOptionValue('db-path') });

          const taskId = parseInt(taskIdStr, 10);
          if (isNaN(taskId)) {
            console.error('Invalid task ID. Must be a number.');
            process.exit(1);
          }

          let parameters: Record<string, unknown> | undefined;
          if (options.parameters) {
            parameters = parseParameters(options.parameters);
          }

          const task = store.updateTask(taskId, {
            ...(options.title !== undefined && { title: options.title }),
            ...(options.description !== undefined && { description: options.description }),
            ...(options.priority !== undefined && { priority: parseInt(options.priority, 10) }),
            ...(parameters !== undefined && { parameters }),
            ...(options.instructions !== undefined && { instructions: options.instructions }),
          });

          console.log('Task updated successfully:');
          console.log(formatTask(task));
        } catch (error) {
          const err = error as Error;
          console.error('Error updating task:', err.message);
          process.exit(1);
        }
      }
    );

  program
    .command('checkout-task')
    .description(
      'Checkout a task (by queue name for next available, or by task ID for specific task)'
    )
    .argument('<queue-or-task-id>', 'Queue name or task ID')
    .option('-w, --worker-id <worker-id>', 'Worker ID for checkout')
    .action(async (queueOrTaskId: string, options: { workerId?: string }) => {
      try {
        const store = new TaskStore({ dbPath: program.getOptionValue('db-path') });

        let task;
        if (/^\d+$/.test(queueOrTaskId)) {
          // It's a number - treat as task ID
          const taskId = parseInt(queueOrTaskId, 10);
          task = store.checkoutTask(taskId, options.workerId);
        } else {
          // It's a string - treat as queue name
          task = store.checkoutTask(queueOrTaskId, options.workerId);
        }

        if (!task) {
          console.log('No available tasks to checkout.');
          process.exit(0);
        }

        console.log('Task checked out successfully:');
        console.log(formatTask(task));
      } catch (error) {
        const err = error as Error;
        console.error('Error checking out task:', err.message);
        process.exit(1);
      }
    });

  program
    .command('complete-task')
    .description('Mark a task as completed')
    .argument('<task-id>', 'Task ID')
    .action(async (taskIdStr: string) => {
      try {
        const store = new TaskStore({ dbPath: program.getOptionValue('db-path') });

        const taskId = parseInt(taskIdStr, 10);
        if (isNaN(taskId)) {
          console.error('Invalid task ID. Must be a number.');
          process.exit(1);
        }

        const task = store.completeTask(taskId);
        console.log('Task completed successfully:');
        console.log(formatTask(task));
      } catch (error) {
        const err = error as Error;
        console.error('Error completing task:', err.message);
        process.exit(1);
      }
    });

  program
    .command('reset-task')
    .description('Reset a task back to pending status')
    .argument('<task-id>', 'Task ID')
    .action(async (taskIdStr: string) => {
      try {
        const store = new TaskStore({ dbPath: program.getOptionValue('db-path') });

        const taskId = parseInt(taskIdStr, 10);
        if (isNaN(taskId)) {
          console.error('Invalid task ID. Must be a number.');
          process.exit(1);
        }

        const task = store.resetTask(taskId);
        console.log('Task reset successfully:');
        console.log(formatTask(task));
      } catch (error) {
        const err = error as Error;
        console.error('Error resetting task:', err.message);
        process.exit(1);
      }
    });

  program
    .command('fail-task')
    .description('Mark a task as failed')
    .argument('<task-id>', 'Task ID')
    .action(async (taskIdStr: string) => {
      try {
        const store = new TaskStore({ dbPath: program.getOptionValue('db-path') });

        const taskId = parseInt(taskIdStr, 10);
        if (isNaN(taskId)) {
          console.error('Invalid task ID. Must be a number.');
          process.exit(1);
        }

        const task = store.failTask(taskId);
        console.log('Task failed successfully:');
        console.log(formatTask(task));
      } catch (error) {
        const err = error as Error;
        console.error('Error failing task:', err.message);
        process.exit(1);
      }
    });

  program
    .command('delete-task')
    .description('Delete a task')
    .argument('<task-id>', 'Task ID')
    .action(async (taskIdStr: string) => {
      try {
        const store = new TaskStore({ dbPath: program.getOptionValue('db-path') });

        const taskId = parseInt(taskIdStr, 10);
        if (isNaN(taskId)) {
          console.error('Invalid task ID. Must be a number.');
          process.exit(1);
        }

        store.deleteTask(taskId);
        console.log(`Task ${taskId} deleted successfully.`);
      } catch (error) {
        const err = error as Error;
        console.error('Error deleting task:', err.message);
        process.exit(1);
      }
    });

  program
    .command('list-tasks')
    .description('List tasks in a queue')
    .argument('<queue>', 'Queue name')
    .option('-s, --status <status>', 'Filter by status (pending, checked_out, completed, failed)')
    .option('-l, --limit <limit>', 'Limit number of results', '50')
    .action(async (queueName: string, options: { status?: string; limit?: string }) => {
      try {
        const store = new TaskStore({ dbPath: program.getOptionValue('db-path') });

        let status: TaskStatus | undefined;
        if (options.status) {
          const validStatuses: TaskStatus[] = ['pending', 'checked_out', 'completed', 'failed'];
          if (!validStatuses.includes(options.status as TaskStatus)) {
            console.error(`Invalid status. Must be one of: ${validStatuses.join(', ')}`);
            process.exit(1);
          }
          status = options.status as TaskStatus;
        }

        const limit = parseInt(options.limit || '50', 10);
        if (isNaN(limit) || limit <= 0) {
          console.error('Limit must be a positive number.');
          process.exit(1);
        }

        const tasks = store.listTasks(queueName, status, limit);
        console.log(formatTaskTable(tasks));
      } catch (error) {
        const err = error as Error;
        console.error('Error listing tasks:', err.message);
        process.exit(1);
      }
    });

  program
    .command('inspect-task')
    .description('Inspect a task and show its details')
    .argument('<task-id>', 'Task ID')
    .action(async (taskIdStr: string) => {
      try {
        const store = new TaskStore({ dbPath: program.getOptionValue('db-path') });

        const taskId = parseInt(taskIdStr, 10);
        if (isNaN(taskId)) {
          console.error('Invalid task ID. Must be a number.');
          process.exit(1);
        }

        const task = store.getTask(taskId);
        if (!task) {
          console.error(`Task ${taskId} not found.`);
          process.exit(1);
        }

        console.log(formatTask(task));
      } catch (error) {
        const err = error as Error;
        console.error('Error inspecting task:', err.message);
        process.exit(1);
      }
    });
}
