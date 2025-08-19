import {
  TaskStore,
  ValidationError,
  NotFoundError,
  ConflictError,
  CheckoutError,
} from '../../src/core';
import { getTestDatabasePath, cleanupTestDatabase } from '../setup';

describe('TaskStore', () => {
  let store: TaskStore;
  let testDbPath: string;

  beforeEach(() => {
    testDbPath = getTestDatabasePath();
    store = new TaskStore({ dbPath: testDbPath });
  });

  afterEach(() => {
    store.close();
    cleanupTestDatabase(testDbPath);
  });

  describe('Queue Operations', () => {
    describe('createQueue', () => {
      it('should create a new queue', () => {
        const queue = store.createQueue({
          name: 'test-queue',
          description: 'Test queue description',
          instructions: 'Test instructions',
        });

        expect(queue.name).toBe('test-queue');
        expect(queue.description).toBe('Test queue description');
        expect(queue.instructions).toBe('Test instructions');
        expect(queue.createdAt).toBeDefined();
        expect(queue.updatedAt).toBeDefined();
      });

      it('should create a queue with minimal information', () => {
        const queue = store.createQueue({ name: 'minimal-queue' });

        expect(queue.name).toBe('minimal-queue');
        expect(queue.description).toBeNull();
        expect(queue.instructions).toBeNull();
      });

      it('should throw ConflictError for duplicate queue names', () => {
        store.createQueue({ name: 'duplicate-queue' });

        expect(() => {
          store.createQueue({ name: 'duplicate-queue' });
        }).toThrow(ConflictError);
      });

      it('should validate queue name', () => {
        expect(() => {
          store.createQueue({ name: '' });
        }).toThrow(ValidationError);

        expect(() => {
          store.createQueue({ name: 'invalid name!' });
        }).toThrow(ValidationError);
      });
    });

    describe('updateQueue', () => {
      beforeEach(() => {
        store.createQueue({
          name: 'update-test',
          description: 'Original description',
          instructions: 'Original instructions',
        });
      });

      it('should update queue description', () => {
        const updated = store.updateQueue('update-test', {
          description: 'Updated description',
        });

        expect(updated.description).toBe('Updated description');
        expect(updated.instructions).toBe('Original instructions');
      });

      it('should update queue instructions', () => {
        const updated = store.updateQueue('update-test', {
          instructions: 'Updated instructions',
        });

        expect(updated.description).toBe('Original description');
        expect(updated.instructions).toBe('Updated instructions');
      });

      it('should clear fields with empty strings', () => {
        const updated = store.updateQueue('update-test', {
          description: '',
          instructions: '',
        });

        expect(updated.description).toBeNull();
        expect(updated.instructions).toBeNull();
      });

      it('should throw NotFoundError for non-existent queue', () => {
        expect(() => {
          store.updateQueue('non-existent', { description: 'Test' });
        }).toThrow(NotFoundError);
      });
    });

    describe('deleteQueue', () => {
      it('should delete an existing queue', () => {
        store.createQueue({ name: 'delete-test' });
        store.deleteQueue('delete-test');

        expect(store.getQueue('delete-test')).toBeNull();
      });

      it('should throw NotFoundError for non-existent queue', () => {
        expect(() => {
          store.deleteQueue('non-existent');
        }).toThrow(NotFoundError);
      });

      it('should cascade delete tasks in the queue', () => {
        store.createQueue({ name: 'cascade-test' });
        const task = store.addTask({
          queueName: 'cascade-test',
          title: 'Test task',
        });

        store.deleteQueue('cascade-test');

        expect(store.getTask(task.id)).toBeNull();
      });
    });

    describe('listQueues', () => {
      it('should return empty array when no queues exist', () => {
        expect(store.listQueues()).toEqual([]);
      });

      it('should return all queues sorted by name', () => {
        store.createQueue({ name: 'queue-b' });
        store.createQueue({ name: 'queue-a' });
        store.createQueue({ name: 'queue-c' });

        const queues = store.listQueues();

        expect(queues).toHaveLength(3);
        expect(queues[0]!.name).toBe('queue-a');
        expect(queues[1]!.name).toBe('queue-b');
        expect(queues[2]!.name).toBe('queue-c');
      });
    });

    describe('getQueueStats', () => {
      beforeEach(() => {
        store.createQueue({ name: 'stats-test' });
      });

      it('should return correct statistics for queue', () => {
        const task1 = store.addTask({ queueName: 'stats-test', title: 'Task 1' });
        const task2 = store.addTask({ queueName: 'stats-test', title: 'Task 2' });
        const task3 = store.addTask({ queueName: 'stats-test', title: 'Task 3' });
        store.addTask({ queueName: 'stats-test', title: 'Task 4' });

        store.checkoutTask(task1.id);
        store.completeTask(task1.id);
        store.checkoutTask(task2.id);
        store.failTask(task3.id);

        const stats = store.getQueueStats('stats-test');

        expect(stats.total).toBe(4);
        expect(stats.pending).toBe(1);
        expect(stats.checkedOut).toBe(1);
        expect(stats.completed).toBe(1);
        expect(stats.failed).toBe(1);
      });

      it('should throw NotFoundError for non-existent queue', () => {
        expect(() => {
          store.getQueueStats('non-existent');
        }).toThrow(NotFoundError);
      });
    });
  });

  describe('Task Operations', () => {
    beforeEach(() => {
      store.createQueue({ name: 'task-test' });
    });

    describe('addTask', () => {
      it('should add a task with all properties', () => {
        const task = store.addTask({
          queueName: 'task-test',
          title: 'Complete task',
          description: 'Task description',
          priority: 8,
          parameters: { key: 'value', number: 42 },
          instructions: 'Task instructions',
        });

        expect(task.queueName).toBe('task-test');
        expect(task.title).toBe('Complete task');
        expect(task.description).toBe('Task description');
        expect(task.priority).toBe(8);
        expect(task.parameters).toEqual({ key: 'value', number: 42 });
        expect(task.instructions).toBe('Task instructions');
        expect(task.status).toBe('pending');
        expect(task.workerId).toBeNull();
      });

      it('should add a task with minimal information', () => {
        const task = store.addTask({
          queueName: 'task-test',
          title: 'Minimal task',
        });

        expect(task.title).toBe('Minimal task');
        expect(task.priority).toBe(5);
        expect(task.status).toBe('pending');
      });

      it('should validate task title', () => {
        expect(() => {
          store.addTask({ queueName: 'task-test', title: '' });
        }).toThrow(ValidationError);
      });

      it('should validate priority range', () => {
        expect(() => {
          store.addTask({ queueName: 'task-test', title: 'Test', priority: 0 });
        }).toThrow(ValidationError);

        expect(() => {
          store.addTask({ queueName: 'task-test', title: 'Test', priority: 11 });
        }).toThrow(ValidationError);
      });

      it('should throw NotFoundError for non-existent queue', () => {
        expect(() => {
          store.addTask({ queueName: 'non-existent', title: 'Test' });
        }).toThrow(NotFoundError);
      });
    });

    describe('updateTask', () => {
      let taskId: number;

      beforeEach(() => {
        const task = store.addTask({
          queueName: 'task-test',
          title: 'Original title',
          description: 'Original description',
          priority: 5,
        });
        taskId = task.id;
      });

      it('should update task properties', () => {
        const updated = store.updateTask(taskId, {
          title: 'Updated title',
          priority: 8,
        });

        expect(updated.title).toBe('Updated title');
        expect(updated.priority).toBe(8);
        expect(updated.description).toBe('Original description');
      });

      it('should clear fields with empty strings', () => {
        const updated = store.updateTask(taskId, {
          description: '',
          instructions: '',
        });

        expect(updated.description).toBeNull();
        expect(updated.instructions).toBeNull();
      });

      it('should throw NotFoundError for non-existent task', () => {
        expect(() => {
          store.updateTask(999999, { title: 'Test' });
        }).toThrow(NotFoundError);
      });
    });

    describe('checkoutTask', () => {
      it('should checkout specific task by ID', () => {
        const task = store.addTask({ queueName: 'task-test', title: 'Checkout test' });

        const checkedOut = store.checkoutTask(task.id, 'worker-1');

        expect(checkedOut).not.toBeNull();
        expect(checkedOut!.status).toBe('checked_out');
        expect(checkedOut!.workerId).toBe('worker-1');
        expect(checkedOut!.checkedOutAt).toBeDefined();
      });

      it('should checkout highest priority pending task from queue', () => {
        store.addTask({ queueName: 'task-test', title: 'Low priority', priority: 3 });
        store.addTask({ queueName: 'task-test', title: 'High priority', priority: 9 });
        store.addTask({ queueName: 'task-test', title: 'Medium priority', priority: 5 });

        const checkedOut = store.checkoutTask('task-test');

        expect(checkedOut).not.toBeNull();
        expect(checkedOut!.title).toBe('High priority');
        expect(checkedOut!.status).toBe('checked_out');
      });

      it('should return null when no pending tasks in queue', () => {
        const task = store.addTask({ queueName: 'task-test', title: 'Only task' });
        store.checkoutTask(task.id);

        const result = store.checkoutTask('task-test');
        expect(result).toBeNull();
      });

      it('should throw CheckoutError when task is already checked out', () => {
        const task = store.addTask({ queueName: 'task-test', title: 'Test' });
        store.checkoutTask(task.id);

        expect(() => {
          store.checkoutTask(task.id);
        }).toThrow(CheckoutError);
      });

      it('should throw NotFoundError for non-existent queue', () => {
        expect(() => {
          store.checkoutTask('non-existent');
        }).toThrow(NotFoundError);
      });
    });

    describe('completeTask', () => {
      it('should complete a checked out task', () => {
        const task = store.addTask({ queueName: 'task-test', title: 'Complete test' });
        store.checkoutTask(task.id);

        const completed = store.completeTask(task.id);

        expect(completed.status).toBe('completed');
        expect(completed.completedAt).toBeDefined();
      });

      it('should be idempotent for already completed tasks', () => {
        const task = store.addTask({ queueName: 'task-test', title: 'Test' });
        store.checkoutTask(task.id);
        store.completeTask(task.id);

        const result = store.completeTask(task.id);
        expect(result.status).toBe('completed');
      });

      it('should throw ValidationError for pending task', () => {
        const task = store.addTask({ queueName: 'task-test', title: 'Test' });

        expect(() => {
          store.completeTask(task.id);
        }).toThrow(ValidationError);
      });
    });

    describe('resetTask', () => {
      it('should reset task to pending status', () => {
        const task = store.addTask({ queueName: 'task-test', title: 'Reset test' });
        store.checkoutTask(task.id, 'worker-1');

        const reset = store.resetTask(task.id);

        expect(reset.status).toBe('pending');
        expect(reset.workerId).toBeNull();
        expect(reset.checkedOutAt).toBeNull();
      });

      it('should be idempotent for pending tasks', () => {
        const task = store.addTask({ queueName: 'task-test', title: 'Test' });

        const result = store.resetTask(task.id);
        expect(result.status).toBe('pending');
      });
    });

    describe('failTask', () => {
      it('should mark task as failed', () => {
        const task = store.addTask({ queueName: 'task-test', title: 'Fail test' });

        const failed = store.failTask(task.id);

        expect(failed.status).toBe('failed');
      });

      it('should be idempotent for failed tasks', () => {
        const task = store.addTask({ queueName: 'task-test', title: 'Test' });
        store.failTask(task.id);

        const result = store.failTask(task.id);
        expect(result.status).toBe('failed');
      });
    });

    describe('listTasks', () => {
      beforeEach(() => {
        store.addTask({ queueName: 'task-test', title: 'Task 1', priority: 3 });
        store.addTask({ queueName: 'task-test', title: 'Task 2', priority: 7 });
        store.addTask({ queueName: 'task-test', title: 'Task 3', priority: 5 });
        const task4 = store.addTask({ queueName: 'task-test', title: 'Task 4', priority: 9 });
        store.checkoutTask(task4.id);
      });

      it('should list all tasks in priority order', () => {
        const tasks = store.listTasks('task-test');

        expect(tasks).toHaveLength(4);
        expect(tasks[0]!.title).toBe('Task 4');
        expect(tasks[1]!.title).toBe('Task 2');
        expect(tasks[2]!.title).toBe('Task 3');
        expect(tasks[3]!.title).toBe('Task 1');
      });

      it('should filter by status', () => {
        const pending = store.listTasks('task-test', 'pending');
        expect(pending).toHaveLength(3);

        const checkedOut = store.listTasks('task-test', 'checked_out');
        expect(checkedOut).toHaveLength(1);
      });

      it('should limit results', () => {
        const tasks = store.listTasks('task-test', undefined, 2);
        expect(tasks).toHaveLength(2);
      });
    });
  });

  describe('Journal Operations', () => {
    let taskId: number;

    beforeEach(() => {
      store.createQueue({ name: 'journal-test' });
      const task = store.addTask({ queueName: 'journal-test', title: 'Journal task' });
      taskId = task.id;
    });

    describe('addJournalEntry', () => {
      it('should add journal entry with notes', () => {
        const entry = store.addJournalEntry({
          taskId,
          status: 'checked_out',
          notes: 'Started processing',
        });

        expect(entry.taskId).toBe(taskId);
        expect(entry.status).toBe('checked_out');
        expect(entry.notes).toBe('Started processing');
        expect(entry.timestamp).toBeDefined();
      });

      it('should validate status', () => {
        expect(() => {
          store.addJournalEntry({
            taskId,
            status: 'invalid_status',
            notes: 'Test',
          });
        }).toThrow(ValidationError);
      });

      it('should throw NotFoundError for non-existent task', () => {
        expect(() => {
          store.addJournalEntry({
            taskId: 999999,
            status: 'pending',
            notes: 'Test',
          });
        }).toThrow(NotFoundError);
      });
    });

    describe('getTaskJournal', () => {
      it('should return journal entries in chronological order', () => {
        store.addJournalEntry({ taskId, status: 'pending', notes: 'Created' });
        store.addJournalEntry({ taskId, status: 'checked_out', notes: 'Started' });
        store.addJournalEntry({ taskId, status: 'completed', notes: 'Finished' });

        const journal = store.getTaskJournal(taskId);

        expect(journal).toHaveLength(3);
        expect(journal[0]!.notes).toBe('Created');
        expect(journal[1]!.notes).toBe('Started');
        expect(journal[2]!.notes).toBe('Finished');
      });

      it('should return empty array for task with no journal', () => {
        const journal = store.getTaskJournal(taskId);
        expect(journal).toEqual([]);
      });
    });

    describe('clearTaskJournal', () => {
      it('should remove all journal entries for a task', () => {
        store.addJournalEntry({ taskId, status: 'pending', notes: 'Entry 1' });
        store.addJournalEntry({ taskId, status: 'checked_out', notes: 'Entry 2' });

        store.clearTaskJournal(taskId);

        const journal = store.getTaskJournal(taskId);
        expect(journal).toEqual([]);
      });
    });
  });

  describe('Transaction Support', () => {
    it('should support atomic operations in transaction', () => {
      store.createQueue({ name: 'transaction-test' });

      const result = store.runInTransaction(() => {
        const task1 = store.addTask({ queueName: 'transaction-test', title: 'Task 1' });
        const task2 = store.addTask({ queueName: 'transaction-test', title: 'Task 2' });
        store.checkoutTask(task1.id);
        return { task1, task2 };
      });

      expect(result.task1.id).toBeDefined();
      expect(result.task2.id).toBeDefined();
      expect(store.getTask(result.task1.id)!.status).toBe('checked_out');
    });

    it('should rollback transaction on error', () => {
      store.createQueue({ name: 'rollback-test' });

      expect(() => {
        store.runInTransaction(() => {
          store.addTask({ queueName: 'rollback-test', title: 'Task 1' });
          store.addTask({ queueName: 'rollback-test', title: 'Task 2' });
          throw new Error('Rollback!');
        });
      }).toThrow('Rollback!');

      const tasks = store.listTasks('rollback-test');
      expect(tasks).toEqual([]);
    });
  });
});
