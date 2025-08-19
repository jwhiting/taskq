import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { Configuration } from '../config/Configuration.js';

export class TaskQDatabase {
  private db: Database.Database;
  private readonly dbPath: string;

  constructor(config: Configuration) {
    this.dbPath = config.getDatabasePath();
    this.initializeDatabase();
    this.db = new Database(this.dbPath);
    this.createTables();
  }

  public getDatabase(): Database.Database {
    return this.db;
  }

  public close(): void {
    if (this.db) {
      this.db.close();
    }
  }

  private initializeDatabase(): void {
    // Ensure the directory exists
    const dir = path.dirname(this.dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  private createTables(): void {
    // Enable foreign keys
    this.db.pragma('foreign_keys = ON');

    // Create queues table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS queues (
        name TEXT PRIMARY KEY,
        description TEXT,
        instructions TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Create tasks table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS tasks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        queue_name TEXT NOT NULL,
        title TEXT NOT NULL,
        description TEXT,
        priority INTEGER DEFAULT 5,
        parameters JSON,
        instructions TEXT,
        status TEXT DEFAULT 'pending',
        worker_id TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        checked_out_at DATETIME,
        completed_at DATETIME,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (queue_name) REFERENCES queues(name) ON DELETE CASCADE,
        CHECK (priority >= 1 AND priority <= 10),
        CHECK (status IN ('pending', 'checked_out', 'completed', 'failed'))
      );
    `);

    // Create task_journal table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS task_journal (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        task_id INTEGER NOT NULL,
        status TEXT NOT NULL,
        notes TEXT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
      );
    `);

    // Create indexes for performance
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_tasks_queue_status ON tasks(queue_name, status);
      CREATE INDEX IF NOT EXISTS idx_tasks_priority ON tasks(priority);
      CREATE INDEX IF NOT EXISTS idx_tasks_created_at ON tasks(created_at);
      CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
      CREATE INDEX IF NOT EXISTS idx_journal_task_id ON task_journal(task_id);
      CREATE INDEX IF NOT EXISTS idx_journal_timestamp ON task_journal(timestamp);
    `);

    // Create trigger to update updated_at timestamp
    this.db.exec(`
      CREATE TRIGGER IF NOT EXISTS update_queues_updated_at
      AFTER UPDATE ON queues
      FOR EACH ROW
      BEGIN
        UPDATE queues SET updated_at = CURRENT_TIMESTAMP WHERE name = NEW.name;
      END;
    `);

    this.db.exec(`
      CREATE TRIGGER IF NOT EXISTS update_tasks_updated_at
      AFTER UPDATE ON tasks
      FOR EACH ROW
      BEGIN
        UPDATE tasks SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
      END;
    `);
  }

  /**
   * Execute a function within a transaction
   */
  public transaction<T>(fn: () => T): T {
    const transaction = this.db.transaction(fn);
    return transaction();
  }

  /**
   * Get database statistics for debugging
   */
  public getStats(): Record<string, number> {
    const queueCount = this.db.prepare('SELECT COUNT(*) as count FROM queues').get() as {
      count: number;
    };
    const taskCount = this.db.prepare('SELECT COUNT(*) as count FROM tasks').get() as {
      count: number;
    };
    const journalCount = this.db.prepare('SELECT COUNT(*) as count FROM task_journal').get() as {
      count: number;
    };

    return {
      queues: queueCount.count,
      tasks: taskCount.count,
      journalEntries: journalCount.count,
    };
  }
}
