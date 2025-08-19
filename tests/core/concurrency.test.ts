import { TaskStore, Task } from '../../src/core';
import { getTestDatabasePath, cleanupTestDatabase } from '../setup';

describe('Concurrency Tests', () => {
  let store: TaskStore;
  let testDbPath: string;

  beforeEach(() => {
    testDbPath = getTestDatabasePath();
    store = new TaskStore({ dbPath: testDbPath });

    store.createQueue({ name: 'concurrent-queue' });
    for (let i = 1; i <= 20; i++) {
      store.addTask({
        queueName: 'concurrent-queue',
        title: `Task ${i}`,
        priority: Math.floor(Math.random() * 10) + 1,
      });
    }
  });

  afterEach(() => {
    store.close();
    cleanupTestDatabase(testDbPath);
  });

  describe('Concurrent Checkout Operations', () => {
    it('should handle multiple workers checking out from same queue', async () => {
      const workers = 5;
      const checkouts: Promise<unknown>[] = [];

      for (let i = 0; i < workers; i++) {
        checkouts.push(
          new Promise(resolve => {
            setTimeout(() => {
              const task = store.checkoutTask('concurrent-queue', `worker-${i}`);
              resolve(task);
            }, Math.random() * 10);
          })
        );
      }

      const results = await Promise.all(checkouts);
      const checkedOutTasks = results.filter(task => task !== null) as Task[];

      expect(checkedOutTasks).toHaveLength(workers);

      const taskIds = new Set(checkedOutTasks.map(t => t.id));
      expect(taskIds.size).toBe(workers);

      const workerIds = new Set(checkedOutTasks.map(t => t.workerId));
      expect(workerIds.size).toBe(workers);
    });

    it('should prevent double checkout of same task', async () => {
      const task = store.addTask({
        queueName: 'concurrent-queue',
        title: 'Race condition test',
      });

      const checkouts: Promise<unknown>[] = [];
      const attemptCount = 10;

      for (let i = 0; i < attemptCount; i++) {
        checkouts.push(
          new Promise(resolve => {
            try {
              const result = store.checkoutTask(task.id, `worker-${i}`);
              resolve({ success: true, result });
            } catch {
              resolve({ success: false });
            }
          })
        );
      }

      const results = await Promise.all(checkouts);

      const successful = results.filter(r => (r as { success: boolean }).success);
      const failed = results.filter(r => !(r as { success: boolean }).success);

      expect(successful).toHaveLength(1);
      expect(failed).toHaveLength(attemptCount - 1);

      expect(failed).toHaveLength(attemptCount - 1);
    });

    it('should handle rapid sequential checkouts correctly', () => {
      const checkouts: Task[] = [];

      for (let i = 0; i < 10; i++) {
        const task = store.checkoutTask('concurrent-queue', `worker-${i}`);
        if (task) {
          checkouts.push(task);
        }
      }

      expect(checkouts).toHaveLength(10);

      const taskIds = new Set(checkouts.map(t => t.id));
      expect(taskIds.size).toBe(10);

      const statuses = checkouts.map(t => t.status);
      expect(statuses.every(s => s === 'checked_out')).toBe(true);
    });
  });

  describe('Concurrent Queue Operations', () => {
    it('should handle concurrent queue creation safely', async () => {
      const queueNames = Array.from({ length: 5 }, (_, i) => `queue-${i}`);

      const creates = queueNames.map(
        name =>
          new Promise(resolve => {
            try {
              const queue = store.createQueue({ name });
              resolve({ success: true, queue });
            } catch {
              resolve({ success: false });
            }
          })
      );

      const results = await Promise.all(creates);
      const successful = results.filter(r => (r as { success: boolean }).success);

      expect(successful).toHaveLength(5);

      const queues = store.listQueues();
      const createdQueueNames = queues.map(q => q.name).filter(n => n.startsWith('queue-'));
      expect(createdQueueNames).toHaveLength(5);
    });

    it('should handle concurrent updates to same queue', async () => {
      store.createQueue({ name: 'update-test' });

      const updates = Array.from(
        { length: 10 },
        (_, i) =>
          new Promise(resolve => {
            const updated = store.updateQueue('update-test', {
              description: `Update ${i}`,
              instructions: `Instructions ${i}`,
            });
            resolve(updated);
          })
      );

      const results = await Promise.all(updates);

      expect(results).toHaveLength(10);

      const finalQueue = store.getQueue('update-test');
      expect(finalQueue).toBeDefined();
      expect(finalQueue!.description).toMatch(/Update \d+/);
      expect(finalQueue!.instructions).toMatch(/Instructions \d+/);
    });
  });

  describe('Concurrent Task Modifications', () => {
    it('should handle concurrent task status changes safely', async () => {
      const task = store.addTask({
        queueName: 'concurrent-queue',
        title: 'Status change test',
      });

      store.checkoutTask(task.id);

      const operations: Array<() => Task> = [
        (): Task => store.completeTask(task.id),
        (): Task => store.resetTask(task.id),
        (): Task => store.failTask(task.id),
        (): Task => store.completeTask(task.id),
        (): Task => store.resetTask(task.id),
      ];

      await Promise.all(
        operations.map(
          op =>
            new Promise(resolve => {
              try {
                const result = op();
                resolve({ success: true, result });
              } catch {
                resolve({ success: false });
              }
            })
        )
      );

      const finalTask = store.getTask(task.id);
      expect(finalTask).toBeDefined();
      expect(['pending', 'completed', 'failed']).toContain(finalTask!.status);
    });

    it('should handle concurrent task updates atomically', async () => {
      const task = store.addTask({
        queueName: 'concurrent-queue',
        title: 'Original title',
        priority: 5,
      });

      const updates = Array.from(
        { length: 10 },
        (_, i) =>
          new Promise(resolve => {
            const updated = store.updateTask(task.id, {
              title: `Updated title ${i}`,
              priority: (i % 10) + 1,
            });
            resolve(updated);
          })
      );

      const results = await Promise.all(updates);

      expect(results).toHaveLength(10);

      const finalTask = store.getTask(task.id);
      expect(finalTask).toBeDefined();
      expect(finalTask!.title).toMatch(/Updated title \d+/);
      expect(finalTask!.priority).toBeGreaterThanOrEqual(1);
      expect(finalTask!.priority).toBeLessThanOrEqual(10);
    });
  });

  describe('Transaction Isolation', () => {
    it('should isolate concurrent transactions', async () => {
      const transactions = Array.from(
        { length: 5 },
        (_, i) =>
          new Promise(resolve => {
            try {
              const result = store.runInTransaction(() => {
                const queueName = `tx-queue-${i}`;
                store.createQueue({ name: queueName });

                const tasks = [];
                for (let j = 0; j < 3; j++) {
                  tasks.push(
                    store.addTask({
                      queueName,
                      title: `Task ${j} in queue ${i}`,
                    })
                  );
                }

                return { queueName, tasks };
              });
              resolve({ success: true, result });
            } catch {
              resolve({ success: false });
            }
          })
      );

      const results = await Promise.all(transactions);
      const successful = results.filter(r => (r as { success: boolean }).success);

      expect(successful).toHaveLength(5);

      for (const { result } of successful as Array<{
        success: boolean;
        result: { queueName: string };
      }>) {
        const tasks = store.listTasks(result.queueName);
        expect(tasks).toHaveLength(3);
      }
    });

    it('should handle transaction rollbacks under concurrent load', async () => {
      const operations = Array.from(
        { length: 10 },
        (_, i) =>
          new Promise(resolve => {
            try {
              store.runInTransaction(() => {
                const queueName = `rollback-queue-${i}`;
                store.createQueue({ name: queueName });

                if (i % 2 === 0) {
                  throw new Error('Intentional rollback');
                }

                return queueName;
              });
              resolve({ success: true, index: i });
            } catch {
              resolve({ success: false, index: i });
            }
          })
      );

      const results = await Promise.all(operations);

      const successful = results.filter(r => (r as { success: boolean }).success);
      const failed = results.filter(r => !(r as { success: boolean }).success);

      expect(successful).toHaveLength(5);
      expect(failed).toHaveLength(5);

      const queues = store.listQueues();
      const rollbackQueues = queues.filter(q => q.name.startsWith('rollback-queue-'));

      expect(rollbackQueues).toHaveLength(5);

      rollbackQueues.forEach(queue => {
        const index = parseInt(queue.name.split('-')[2]!);
        expect(index % 2).toBe(1);
      });
    });
  });

  describe('High Load Scenarios', () => {
    it('should handle bulk task creation under load', async () => {
      const bulkOperations = Array.from(
        { length: 10 },
        (_, batchIndex) =>
          new Promise(resolve => {
            const tasks = [];
            for (let i = 0; i < 100; i++) {
              tasks.push(
                store.addTask({
                  queueName: 'concurrent-queue',
                  title: `Bulk task ${batchIndex}-${i}`,
                  priority: Math.floor(Math.random() * 10) + 1,
                })
              );
            }
            resolve(tasks);
          })
      );

      const results = await Promise.all(bulkOperations);

      const allTasks = results.flat();
      expect(allTasks).toHaveLength(1000);

      const taskIds = new Set(allTasks.map(t => (t as Task).id));
      expect(taskIds.size).toBe(1000);

      const queueTasks = store.listTasks('concurrent-queue');
      expect(queueTasks.length).toBeGreaterThanOrEqual(1000);
    });

    it('should maintain data integrity under mixed operations', async () => {
      const operations: Promise<{
        type: string;
        task?: Task | null;
        stats?: unknown;
        journal?: unknown;
      }>[] = [];

      for (let i = 0; i < 50; i++) {
        const op = i % 5;

        switch (op) {
          case 0:
            operations.push(
              new Promise(resolve => {
                const task = store.addTask({
                  queueName: 'concurrent-queue',
                  title: `Mixed op task ${i}`,
                });
                resolve({ type: 'add', task });
              })
            );
            break;

          case 1:
            operations.push(
              new Promise(resolve => {
                const task = store.checkoutTask('concurrent-queue', `worker-${i}`);
                resolve({ type: 'checkout', task });
              })
            );
            break;

          case 2:
            operations.push(
              new Promise(resolve => {
                const tasks = store.listTasks('concurrent-queue', 'checked_out');
                if (tasks.length > 0) {
                  const completed = store.completeTask(tasks[0]!.id);
                  resolve({ type: 'complete', task: completed });
                } else {
                  resolve({ type: 'complete', task: null });
                }
              })
            );
            break;

          case 3:
            operations.push(
              new Promise(resolve => {
                const stats = store.getQueueStats('concurrent-queue');
                resolve({ type: 'stats', stats });
              })
            );
            break;

          case 4:
            operations.push(
              new Promise(resolve => {
                const journal = store.addJournalEntry({
                  taskId: 1,
                  status: 'pending',
                  notes: `Operation ${i}`,
                });
                resolve({ type: 'journal', journal });
              })
            );
            break;
        }
      }

      const results = await Promise.all(operations);

      expect(results).toHaveLength(50);

      const stats = store.getQueueStats('concurrent-queue');
      expect(stats.total).toBeGreaterThan(0);

      const allTasks = store.listTasks('concurrent-queue');
      allTasks.forEach(task => {
        expect(task.id).toBeDefined();
        expect(task.title).toBeDefined();
        expect(['pending', 'checked_out', 'completed', 'failed']).toContain(task.status);
      });
    });
  });
});
