import Database from 'better-sqlite3';
import { Queue, CreateQueueRequest, UpdateQueueRequest } from '../models/Queue';
import { validateQueueName } from '../utils/validation';
import { NotFoundError, ConflictError, DatabaseError } from '../utils/errors';

export class QueueOperations {
  constructor(private readonly db: Database.Database) {}

  createQueue(request: CreateQueueRequest): Queue {
    validateQueueName(request.name);

    try {
      const stmt = this.db.prepare(`
        INSERT INTO queues (name, description, instructions)
        VALUES (@name, @description, @instructions)
      `);

      stmt.run({
        name: request.name,
        description: request.description || null,
        instructions: request.instructions || null,
      });

      return this.getQueue(request.name)!;
    } catch (error) {
      const err = error as { code?: string; message?: string };
      if (err.code === 'SQLITE_CONSTRAINT_PRIMARYKEY') {
        throw new ConflictError(`Queue already exists: ${request.name}`);
      }
      throw new DatabaseError(
        `Failed to create queue: ${err.message || 'Unknown error'}`,
        error as Error
      );
    }
  }

  updateQueue(name: string, request: UpdateQueueRequest): Queue {
    validateQueueName(name);

    const existingQueue = this.getQueue(name);
    if (!existingQueue) {
      throw new NotFoundError('Queue', name);
    }

    if (request.description === undefined && request.instructions === undefined) {
      return existingQueue;
    }

    try {
      const stmt = this.db.prepare(`
        UPDATE queues
        SET 
          description = CASE WHEN @descriptionSet THEN @description ELSE description END,
          instructions = CASE WHEN @instructionsSet THEN @instructions ELSE instructions END,
          updated_at = CURRENT_TIMESTAMP
        WHERE name = @name
      `);

      stmt.run({
        name,
        description: request.description || null,
        descriptionSet: request.description !== undefined ? 1 : 0,
        instructions: request.instructions || null,
        instructionsSet: request.instructions !== undefined ? 1 : 0,
      });

      return this.getQueue(name)!;
    } catch (error) {
      const err = error as { message?: string };
      throw new DatabaseError(
        `Failed to update queue: ${err.message || 'Unknown error'}`,
        error as Error
      );
    }
  }

  deleteQueue(name: string): void {
    validateQueueName(name);

    const result = this.db.prepare('DELETE FROM queues WHERE name = ?').run(name);

    if (result.changes === 0) {
      throw new NotFoundError('Queue', name);
    }
  }

  getQueue(name: string): Queue | null {
    validateQueueName(name);

    const row = this.db
      .prepare(
        `
      SELECT 
        name,
        description,
        instructions,
        created_at as createdAt,
        updated_at as updatedAt
      FROM queues
      WHERE name = ?
    `
      )
      .get(name) as Queue | undefined;

    return row || null;
  }

  listQueues(): Queue[] {
    const rows = this.db
      .prepare(
        `
      SELECT 
        name,
        description,
        instructions,
        created_at as createdAt,
        updated_at as updatedAt
      FROM queues
      ORDER BY name
    `
      )
      .all() as Queue[];

    return rows;
  }

  getQueueStats(name: string): {
    total: number;
    pending: number;
    checkedOut: number;
    completed: number;
    failed: number;
  } {
    validateQueueName(name);

    const queue = this.getQueue(name);
    if (!queue) {
      throw new NotFoundError('Queue', name);
    }

    const stats = this.db
      .prepare(
        `
      SELECT 
        status,
        COUNT(*) as count
      FROM tasks
      WHERE queue_name = ?
      GROUP BY status
    `
      )
      .all(name) as Array<{ status: string; count: number }>;

    const result = {
      total: 0,
      pending: 0,
      checkedOut: 0,
      completed: 0,
      failed: 0,
    };

    for (const stat of stats) {
      const count = Number(stat.count);
      result.total += count;
      switch (stat.status) {
        case 'pending':
          result.pending = count;
          break;
        case 'checked_out':
          result.checkedOut = count;
          break;
        case 'completed':
          result.completed = count;
          break;
        case 'failed':
          result.failed = count;
          break;
      }
    }

    return result;
  }
}
