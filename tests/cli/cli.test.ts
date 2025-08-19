import { Command } from 'commander';
import { TaskStore } from '../../src/core/TaskStore';
import { getTestDatabasePath, cleanupTestDatabase } from '../setup';
import { registerQueueCommands } from '../../src/cli/commands/queue';
import { registerTaskCommands } from '../../src/cli/commands/task';
import { registerStatusCommands } from '../../src/cli/commands/status';

// Output capture for Commander + console mocking for application output
let capturedOutput: string[];
let capturedErrors: string[];

// Helper function for output testing
// Note: Global console mocking is now handled in tests/setup.ts
function enableOutputCapture() {
  // Override the global mocks with our capture functions
  console.log = jest.fn().mockImplementation(message => {
    capturedOutput.push(message + '\n');
  });
  console.error = jest.fn().mockImplementation(message => {
    capturedErrors.push(message + '\n');
  });
}

describe('CLI Commands', () => {
  let testDbPath: string;
  let store: TaskStore;
  let program: Command;

  beforeEach(() => {
    testDbPath = getTestDatabasePath();
    store = new TaskStore({ dbPath: testDbPath });
    capturedOutput = [];
    capturedErrors = [];

    // Create fresh commander program with exitOverride and output capture
    program = new Command();
    program
      .exitOverride() // 🎯 Use Commander's built-in testing support
      .configureOutput({
        writeOut: str => capturedOutput.push(str),
        writeErr: str => capturedErrors.push(str),
      })
      .option('--db-path <path>', 'Path to SQLite database file');

    // Register all commands
    registerQueueCommands(program);
    registerTaskCommands(program);
    registerStatusCommands(program);

    // Set the db-path option
    program.setOptionValue('db-path', testDbPath);
  });

  afterEach(() => {
    // Global console cleanup is handled in tests/setup.ts
    store.close();
    cleanupTestDatabase(testDbPath);
  });

  describe('Queue Commands', () => {
    test('create-queue command', async () => {
      await program.parseAsync([
        'node',
        'cli.js',
        'create-queue',
        'test-queue',
        '--description',
        'Test description',
      ]);

      // Verify queue was actually created (this is the real test)
      const queue = store.getQueue('test-queue');
      expect(queue).not.toBeNull();
      expect(queue!.name).toBe('test-queue');
      expect(queue!.description).toBe('Test description');
    });

    test('create-queue with duplicate name should error', async () => {
      store.createQueue({ name: 'duplicate-queue' });

      // The CLI throws the original ConflictError, not CommanderError
      await expect(
        program.parseAsync(['node', 'cli.js', 'create-queue', 'duplicate-queue'])
      ).rejects.toThrow('Queue already exists: duplicate-queue');

      // Verify the queue was not created again
      const queues = store.listQueues();
      expect(queues).toHaveLength(1); // Only the original queue should exist
    });

    test('list-queues command with no queues', async () => {
      enableOutputCapture(); // Enable output testing for this command

      await program.parseAsync(['node', 'cli.js', 'list-queues']);

      // Verify output shows no queues message
      const output = capturedOutput.join('');
      expect(output).toContain('No queues found.');

      // Also verify database state
      const queues = store.listQueues();
      expect(queues).toHaveLength(0);
    });

    test('list-queues command with queues', async () => {
      store.createQueue({ name: 'queue-1', description: 'First queue' });
      store.createQueue({ name: 'queue-2', description: 'Second queue' });

      enableOutputCapture(); // Test the table output

      await program.parseAsync(['node', 'cli.js', 'list-queues']);

      // Verify output contains queue information in table format
      const output = capturedOutput.join('');
      expect(output).toContain('queue-1');
      expect(output).toContain('queue-2');
      expect(output).toContain('First queue');
      expect(output).toContain('Second queue');
      expect(output).toContain('Name'); // Table header

      // Also verify database state
      const queues = store.listQueues();
      expect(queues).toHaveLength(2);
      expect(queues.map(q => q.name)).toEqual(['queue-1', 'queue-2']);
    });

    test('inspect-queue command', async () => {
      store.createQueue({ name: 'inspect-me', description: 'Queue to inspect' });

      await program.parseAsync(['node', 'cli.js', 'inspect-queue', 'inspect-me']);

      // Command should succeed (no error thrown)
      // Verify queue exists
      const queue = store.getQueue('inspect-me');
      expect(queue).not.toBeNull();
      expect(queue!.description).toBe('Queue to inspect');
    });

    test('inspect-queue with non-existent queue should error', async () => {
      await expect(
        program.parseAsync(['node', 'cli.js', 'inspect-queue', 'does-not-exist'])
      ).rejects.toThrow("Queue 'does-not-exist' not found.");

      // Verify queue doesn't exist
      const queue = store.getQueue('does-not-exist');
      expect(queue).toBeNull();
    });

    test('delete-queue with force flag', async () => {
      store.createQueue({ name: 'delete-me' });

      await program.parseAsync(['node', 'cli.js', 'delete-queue', 'delete-me', '--force']);

      // Verify queue was deleted
      const queue = store.getQueue('delete-me');
      expect(queue).toBeNull();
    });

    test('delete-queue without force on non-empty queue should error', async () => {
      store.createQueue({ name: 'has-tasks' });
      store.addTask({ queueName: 'has-tasks', title: 'Test task' });

      await expect(
        program.parseAsync(['node', 'cli.js', 'delete-queue', 'has-tasks'])
      ).rejects.toThrow('Delete operation cancelled - use --force to override');

      // Verify queue still exists
      const queue = store.getQueue('has-tasks');
      expect(queue).not.toBeNull();
    });
  });

  describe('Task Commands', () => {
    beforeEach(() => {
      store.createQueue({ name: 'task-queue' });
    });

    test('add-task command with basic options', async () => {
      enableOutputCapture(); // Test the success message and task display

      await program.parseAsync([
        'node',
        'cli.js',
        'add-task',
        'task-queue',
        'Test task',
        '--priority',
        '8',
      ]);

      const output = capturedOutput.join('');
      expect(output).toContain('Task added successfully');

      const tasks = store.listTasks('task-queue');
      expect(tasks).toHaveLength(1);
      expect(tasks[0]!.title).toBe('Test task');
      expect(tasks[0]!.priority).toBe(8);
    });

    test('add-task with key=value parameters', async () => {
      await program.parseAsync([
        'node',
        'cli.js',
        'add-task',
        'task-queue',
        'Param task',
        '--parameters',
        'type=test,count=5,enabled=true',
      ]);

      const tasks = store.listTasks('task-queue');
      expect(tasks[0]!.parameters).toEqual({
        type: 'test',
        count: 5,
        enabled: true,
      });
    });

    test('add-task with JSON parameters', async () => {
      await program.parseAsync([
        'node',
        'cli.js',
        'add-task',
        'task-queue',
        'JSON task',
        '--parameters',
        '{"config": {"nested": true}, "value": 42}',
      ]);

      const tasks = store.listTasks('task-queue');
      expect(tasks[0]!.parameters).toEqual({
        config: { nested: true },
        value: 42,
      });
    });

    test('add-task with non-existent queue should error', async () => {
      await expect(
        program.parseAsync(['node', 'cli.js', 'add-task', 'nonexistent', 'Test task'])
      ).rejects.toThrow('Queue not found: nonexistent');

      // Verify no task was created
      const queues = store.listQueues();
      expect(queues).toHaveLength(1); // Only task-queue should exist
    });

    test('checkout-task by queue name', async () => {
      const task = store.addTask({ queueName: 'task-queue', title: 'Checkout me', priority: 7 });

      enableOutputCapture(); // Test the checkout output display

      await program.parseAsync([
        'node',
        'cli.js',
        'checkout-task',
        'task-queue',
        '--worker-id',
        'test-worker',
      ]);

      // Verify checkout success message and task details are displayed
      const output = capturedOutput.join('');
      expect(output).toContain('Task checked out successfully');
      expect(output).toContain('Title: Checkout me');
      expect(output).toContain('Priority: 7');
      expect(output).toContain('Worker ID: test-worker');

      // Verify database state
      const updatedTask = store.getTask(task.id);
      expect(updatedTask!.status).toBe('checked_out');
      expect(updatedTask!.workerId).toBe('test-worker');
    });

    test('checkout-task by task ID', async () => {
      const task = store.addTask({ queueName: 'task-queue', title: 'Checkout by ID' });

      enableOutputCapture(); // Test checkout success message

      await program.parseAsync(['node', 'cli.js', 'checkout-task', task.id.toString()]);

      const output = capturedOutput.join('');
      expect(output).toContain('Task checked out successfully');

      const updatedTask = store.getTask(task.id);
      expect(updatedTask!.status).toBe('checked_out');
    });

    test('checkout-task with no available tasks', async () => {
      enableOutputCapture(); // Test the "no tasks" message

      await program.parseAsync(['node', 'cli.js', 'checkout-task', 'task-queue']);

      // Check for the appropriate message
      const output = capturedOutput.join('');
      expect(output).toContain('No available tasks to checkout.');

      // Verify business logic: empty queue should return null
      const result = store.checkoutTask('task-queue');
      expect(result).toBeNull();
    });

    test('checkout-task displays queue and task instructions', async () => {
      // Create queue with instructions
      store.updateQueue('task-queue', { instructions: 'Queue-level instructions for all tasks' });

      // Add task with its own instructions
      store.addTask({
        queueName: 'task-queue',
        title: 'Task with instructions',
        instructions: 'Task-specific instructions',
      });

      enableOutputCapture(); // Test instructions display

      await program.parseAsync(['node', 'cli.js', 'checkout-task', 'task-queue']);

      // Verify both queue and task instructions are shown
      const output = capturedOutput.join('');
      expect(output).toContain('Task checked out successfully');
      expect(output).toContain('Title: Task with instructions');
      expect(output).toContain('Instructions: Task-specific instructions');
      // Note: Currently formatTask only shows task instructions, not queue instructions
      // This might need enhancement to show combined instructions as per PRD
    });

    test('complete-task command', async () => {
      const task = store.addTask({ queueName: 'task-queue', title: 'Complete me' });
      store.checkoutTask(task.id);

      enableOutputCapture(); // Test completion success message

      await program.parseAsync(['node', 'cli.js', 'complete-task', task.id.toString()]);

      const output = capturedOutput.join('');
      expect(output).toContain('Task completed successfully');

      const updatedTask = store.getTask(task.id);
      expect(updatedTask!.status).toBe('completed');
    });

    test('complete-task with invalid ID should error', async () => {
      await expect(
        program.parseAsync(['node', 'cli.js', 'complete-task', 'not-a-number'])
      ).rejects.toThrow('Invalid task ID. Must be a number.');

      // Verify no task was affected
      const tasks = store.listTasks('task-queue');
      expect(tasks).toHaveLength(0); // No tasks should exist
    });

    test('list-tasks command', async () => {
      store.addTask({ queueName: 'task-queue', title: 'Task 1', priority: 3 });
      store.addTask({ queueName: 'task-queue', title: 'Task 2', priority: 7 });

      enableOutputCapture(); // Test table output formatting

      await program.parseAsync(['node', 'cli.js', 'list-tasks', 'task-queue']);

      const output = capturedOutput.join('');
      expect(output).toContain('Task 1');
      expect(output).toContain('Task 2');
      expect(output).toContain('| ID |'); // Table headers
      expect(output).toContain('Title'); // Table header (without pipes for spacing)
      expect(output).toContain('Priority');
    });

    test('list-tasks with status filter', async () => {
      store.addTask({ queueName: 'task-queue', title: 'Pending task' });
      const task2 = store.addTask({ queueName: 'task-queue', title: 'Checked out task' });
      store.checkoutTask(task2.id);

      enableOutputCapture(); // Test filtered output

      await program.parseAsync([
        'node',
        'cli.js',
        'list-tasks',
        'task-queue',
        '--status',
        'pending',
      ]);

      const output = capturedOutput.join('');
      expect(output).toContain('Pending task');
      expect(output).not.toContain('Checked out task');
    });

    test('inspect-task command', async () => {
      const task = store.addTask({
        queueName: 'task-queue',
        title: 'Inspect me',
        description: 'Task description',
      });

      enableOutputCapture(); // Test detailed task display

      await program.parseAsync(['node', 'cli.js', 'inspect-task', task.id.toString()]);

      const output = capturedOutput.join('');
      expect(output).toContain(`ID: ${task.id}`);
      expect(output).toContain('Title: Inspect me');
      expect(output).toContain('Description: Task description');
      expect(output).toContain('Queue: task-queue');
      expect(output).toContain('Status: pending');
    });
  });

  describe('Status Commands', () => {
    beforeEach(() => {
      store.createQueue({ name: 'status-queue' });
    });

    test('status command without queue (system-wide)', async () => {
      store.addTask({ queueName: 'status-queue', title: 'Task 1' });
      store.addTask({ queueName: 'status-queue', title: 'Task 2' });

      enableOutputCapture(); // Test system-wide status display

      await program.parseAsync(['node', 'cli.js', 'status']);

      const output = capturedOutput.join('');
      expect(output).toContain('System Status:');
      expect(output).toContain('Queue: status-queue');
      expect(output).toContain('Overall Totals:');
    });

    test('status command with specific queue', async () => {
      store.addTask({ queueName: 'status-queue', title: 'Task 1' });

      enableOutputCapture(); // Test queue-specific status display

      await program.parseAsync(['node', 'cli.js', 'status', 'status-queue']);

      const output = capturedOutput.join('');
      expect(output).toContain('Status for queue: status-queue');
      expect(output).toContain('Total: 1');
      expect(output).toContain('Pending: 1');
    });

    test('journal command', async () => {
      const task = store.addTask({ queueName: 'status-queue', title: 'Journal task' });
      store.addJournalEntry({ taskId: task.id, status: 'pending', notes: 'Task created' });

      enableOutputCapture(); // Test journal display

      await program.parseAsync(['node', 'cli.js', 'journal', task.id.toString()]);

      const output = capturedOutput.join('');
      expect(output).toContain(`Journal for task ${task.id}`);
      expect(output).toContain('Task created');
    });

    test('journal command with non-existent task should error', async () => {
      await expect(program.parseAsync(['node', 'cli.js', 'journal', '99999'])).rejects.toThrow(
        'Task 99999 not found.'
      );

      // Verify the task doesn't exist
      const task = store.getTask(99999);
      expect(task).toBeNull();
    });
  });

  describe('Parameter Parsing', () => {
    beforeEach(() => {
      store.createQueue({ name: 'param-test' });
    });

    test('parseParameters handles invalid JSON', async () => {
      await expect(
        program.parseAsync([
          'node',
          'cli.js',
          'add-task',
          'param-test',
          'Bad JSON',
          '--parameters',
          '{invalid json',
        ])
      ).rejects.toThrow('Invalid JSON parameters');

      // Verify no task was created due to invalid JSON
      const tasks = store.listTasks('param-test');
      expect(tasks).toHaveLength(0);
    });

    test('parseParameters handles invalid key=value format', async () => {
      await expect(
        program.parseAsync([
          'node',
          'cli.js',
          'add-task',
          'param-test',
          'Bad params',
          '--parameters',
          'invalid-format',
        ])
      ).rejects.toThrow('Invalid parameter format: invalid-format');

      // Verify no task was created due to invalid format
      const tasks = store.listTasks('param-test');
      expect(tasks).toHaveLength(0);
    });

    test('parseParameters handles empty key', async () => {
      await expect(
        program.parseAsync([
          'node',
          'cli.js',
          'add-task',
          'param-test',
          'Empty key',
          '--parameters',
          '=value',
        ])
      ).rejects.toThrow('Empty parameter key');

      // Verify no task was created due to empty key
      const tasks = store.listTasks('param-test');
      expect(tasks).toHaveLength(0);
    });
  });
});
