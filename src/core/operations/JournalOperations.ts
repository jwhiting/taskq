import Database from 'better-sqlite3';
import { TaskJournalEntry, CreateTaskJournalRequest } from '../models/TaskJournal';
import { validateTaskId, validateTaskStatus } from '../utils/validation';
import { NotFoundError, DatabaseError } from '../utils/errors';

export class JournalOperations {
  constructor(private readonly db: Database.Database) {}

  addJournalEntry(request: CreateTaskJournalRequest): TaskJournalEntry {
    validateTaskId(request.taskId);
    validateTaskStatus(request.status);

    const taskExists = this.db.prepare('SELECT 1 FROM tasks WHERE id = ?').get(request.taskId);
    if (!taskExists) {
      throw new NotFoundError('Task', String(request.taskId));
    }

    try {
      const stmt = this.db.prepare(`
        INSERT INTO task_journal (task_id, status, notes)
        VALUES (@taskId, @status, @notes)
      `);

      const result = stmt.run({
        taskId: request.taskId,
        status: request.status,
        notes: request.notes || null,
      });

      return this.getJournalEntry(Number(result.lastInsertRowid))!;
    } catch (error) {
      const err = error as { message?: string };
      throw new DatabaseError(
        `Failed to add journal entry: ${err.message || 'Unknown error'}`,
        error as Error
      );
    }
  }

  getJournalEntry(id: number): TaskJournalEntry | null {
    const row = this.db
      .prepare(
        `
      SELECT 
        id,
        task_id as taskId,
        status,
        notes,
        timestamp
      FROM task_journal
      WHERE id = ?
    `
      )
      .get(id) as TaskJournalEntry | undefined;

    return row || null;
  }

  getTaskJournal(taskId: number): TaskJournalEntry[] {
    validateTaskId(taskId);

    const rows = this.db
      .prepare(
        `
      SELECT 
        id,
        task_id as taskId,
        status,
        notes,
        timestamp
      FROM task_journal
      WHERE task_id = ?
      ORDER BY timestamp ASC
    `
      )
      .all(taskId) as TaskJournalEntry[];

    return rows;
  }

  clearTaskJournal(taskId: number): void {
    validateTaskId(taskId);

    this.db.prepare('DELETE FROM task_journal WHERE task_id = ?').run(taskId);
  }
}
