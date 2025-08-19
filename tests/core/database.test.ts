import { Configuration } from '../../src/core/config/Configuration';
import { TaskQDatabase } from '../../src/core/database/Database';

describe('TaskQDatabase', () => {
  let database: TaskQDatabase;
  let config: Configuration;

  beforeEach(() => {
    // Force a unique database path for each test
    const testDbPath = `${process.env['TASKQ_DB_PATH']}-${Date.now()}-${Math.random()}`;
    process.env['TASKQ_DB_PATH'] = testDbPath;

    // Each test gets a fresh database
    config = new Configuration();
    database = new TaskQDatabase(config);
  });

  afterEach(() => {
    if (database) {
      database.close();
    }
  });

  describe('initialization', () => {
    it('should create database and tables successfully', () => {
      expect(database).toBeDefined();

      const db = database.getDatabase();
      expect(db).toBeDefined();

      // Check that tables exist by querying them
      const tables = db
        .prepare(
          `
        SELECT name FROM sqlite_master 
        WHERE type='table' AND name IN ('queues', 'tasks', 'task_journal')
      `
        )
        .all() as { name: string }[];

      expect(tables).toHaveLength(3);
      expect(tables.map(t => t.name)).toEqual(
        expect.arrayContaining(['queues', 'tasks', 'task_journal'])
      );
    });

    it('should create indexes for performance', () => {
      const db = database.getDatabase();

      const indexes = db
        .prepare(
          `
        SELECT name FROM sqlite_master 
        WHERE type='index' AND name LIKE 'idx_%'
      `
        )
        .all();

      expect(indexes.length).toBeGreaterThan(0);
    });

    it('should enable foreign keys', () => {
      const db = database.getDatabase();

      const foreignKeysResult = db.prepare('PRAGMA foreign_keys').get() as { foreign_keys: number };
      expect(foreignKeysResult.foreign_keys).toBe(1);
    });
  });

  describe('stats', () => {
    it('should return correct initial stats', () => {
      const stats = database.getStats();

      expect(stats).toEqual({
        queues: 0,
        tasks: 0,
        journalEntries: 0,
      });
    });
  });

  describe('transactions', () => {
    it('should execute functions within transactions', () => {
      const db = database.getDatabase();

      const result = database.transaction(() => {
        db.prepare(`INSERT INTO queues (name, description) VALUES (?, ?)`).run(
          'test-queue',
          'Test queue'
        );
        return 'success';
      });

      expect(result).toBe('success');

      const stats = database.getStats();
      expect(stats['queues']).toBe(1);
    });

    it('should handle transactions correctly', () => {
      const db = database.getDatabase();

      // Test successful transaction
      const result = database.transaction(() => {
        db.prepare(`INSERT INTO queues (name, description) VALUES (?, ?)`).run(
          'test-queue-1',
          'Test queue 1'
        );
        db.prepare(`INSERT INTO queues (name, description) VALUES (?, ?)`).run(
          'test-queue-2',
          'Test queue 2'
        );
        return 'success';
      });

      expect(result).toBe('success');

      const stats = database.getStats();
      expect(stats['queues']).toBe(2);

      // Verify both queues were inserted
      const queues = db.prepare('SELECT name FROM queues ORDER BY name').all() as {
        name: string;
      }[];
      expect(queues.map(q => q.name)).toEqual(['test-queue-1', 'test-queue-2']);
    });
  });
});
