import Database from 'better-sqlite3';
import { Task, TaskStatus, CreateTaskRequest, UpdateTaskRequest } from '../models/Task.js';
import {
  validateQueueName,
  validateTaskTitle,
  validatePriority,
  validateTaskStatus,
  validateTaskId,
  validateParameters,
} from '../utils/validation.js';
import { NotFoundError, CheckoutError, DatabaseError, ValidationError } from '../utils/errors.js';

export class TaskOperations {
  constructor(private readonly db: Database.Database) {}

  addTask(request: CreateTaskRequest): Task {
    validateQueueName(request.queueName);
    validateTaskTitle(request.title);

    if (request.priority !== undefined) {
      validatePriority(request.priority);
    }

    const parameters = validateParameters(request.parameters);

    const queueExists = this.db
      .prepare('SELECT 1 FROM queues WHERE name = ?')
      .get(request.queueName);
    if (!queueExists) {
      throw new NotFoundError('Queue', request.queueName);
    }

    try {
      const stmt = this.db.prepare(`
        INSERT INTO tasks (queue_name, title, description, priority, parameters, instructions)
        VALUES (@queueName, @title, @description, @priority, @parameters, @instructions)
      `);

      const result = stmt.run({
        queueName: request.queueName,
        title: request.title,
        description: request.description || null,
        priority: request.priority || 5,
        parameters: parameters ? JSON.stringify(parameters) : null,
        instructions: request.instructions || null,
      });

      return this.getTask(Number(result.lastInsertRowid))!;
    } catch (error) {
      const err = error as { message?: string };
      throw new DatabaseError(
        `Failed to add task: ${err.message || 'Unknown error'}`,
        error as Error
      );
    }
  }

  updateTask(id: number, request: UpdateTaskRequest): Task {
    validateTaskId(id);

    const existingTask = this.getTask(id);
    if (!existingTask) {
      throw new NotFoundError('Task', String(id));
    }

    if (request.title !== undefined) {
      validateTaskTitle(request.title);
    }
    if (request.priority !== undefined) {
      validatePriority(request.priority);
    }

    const parameters =
      request.parameters !== undefined ? validateParameters(request.parameters) : undefined;

    try {
      const stmt = this.db.prepare(`
        UPDATE tasks
        SET 
          title = COALESCE(@title, title),
          description = CASE WHEN @descriptionSet THEN @description ELSE description END,
          priority = COALESCE(@priority, priority),
          parameters = CASE WHEN @parametersSet THEN @parameters ELSE parameters END,
          instructions = CASE WHEN @instructionsSet THEN @instructions ELSE instructions END,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = @id
      `);

      stmt.run({
        id,
        title: request.title,
        description: request.description || null,
        descriptionSet: request.description !== undefined ? 1 : 0,
        priority: request.priority,
        parameters: parameters ? JSON.stringify(parameters) : null,
        parametersSet: request.parameters !== undefined ? 1 : 0,
        instructions: request.instructions || null,
        instructionsSet: request.instructions !== undefined ? 1 : 0,
      });

      return this.getTask(id)!;
    } catch (error) {
      const err = error as { message?: string };
      throw new DatabaseError(
        `Failed to update task: ${err.message || 'Unknown error'}`,
        error as Error
      );
    }
  }

  checkoutTask(queueNameOrTaskId: string | number, workerId?: string): Task | null {
    const transaction = this.db.transaction(() => {
      let task: Task | null = null;

      if (typeof queueNameOrTaskId === 'number') {
        validateTaskId(queueNameOrTaskId);
        task = this.getTask(queueNameOrTaskId);
        if (!task) {
          throw new NotFoundError('Task', String(queueNameOrTaskId));
        }
        if (task.status !== 'pending') {
          throw new CheckoutError(
            `Task ${queueNameOrTaskId} is not pending (status: ${task.status})`
          );
        }
      } else {
        validateQueueName(queueNameOrTaskId);

        const queueExists = this.db
          .prepare('SELECT 1 FROM queues WHERE name = ?')
          .get(queueNameOrTaskId);
        if (!queueExists) {
          throw new NotFoundError('Queue', queueNameOrTaskId);
        }

        const row = this.db
          .prepare(
            `
          SELECT id
          FROM tasks
          WHERE queue_name = ? AND status = 'pending'
          ORDER BY priority DESC, created_at ASC
          LIMIT 1
        `
          )
          .get(queueNameOrTaskId) as { id: number } | undefined;

        if (!row) {
          return null;
        }

        task = this.getTask(row.id);
      }

      if (!task) {
        return null;
      }

      const stmt = this.db.prepare(`
        UPDATE tasks
        SET 
          status = 'checked_out',
          worker_id = @workerId,
          checked_out_at = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = @id AND status = 'pending'
      `);

      const result = stmt.run({
        id: task.id,
        workerId: workerId || null,
      });

      if (result.changes === 0) {
        throw new CheckoutError(
          `Failed to checkout task ${task.id} - it may have been checked out by another worker`
        );
      }

      return this.getTask(task.id);
    });

    return transaction();
  }

  completeTask(id: number): Task {
    validateTaskId(id);

    const task = this.getTask(id);
    if (!task) {
      throw new NotFoundError('Task', String(id));
    }

    if (task.status === 'completed') {
      return task;
    }

    if (task.status !== 'checked_out') {
      throw new ValidationError(
        `Cannot complete task ${id} - it must be checked out first (status: ${task.status})`
      );
    }

    try {
      const stmt = this.db.prepare(`
        UPDATE tasks
        SET 
          status = 'completed',
          completed_at = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `);

      stmt.run(id);
      return this.getTask(id)!;
    } catch (error) {
      const err = error as { message?: string };
      throw new DatabaseError(
        `Failed to complete task: ${err.message || 'Unknown error'}`,
        error as Error
      );
    }
  }

  resetTask(id: number): Task {
    validateTaskId(id);

    const task = this.getTask(id);
    if (!task) {
      throw new NotFoundError('Task', String(id));
    }

    if (task.status === 'pending') {
      return task;
    }

    try {
      const stmt = this.db.prepare(`
        UPDATE tasks
        SET 
          status = 'pending',
          worker_id = NULL,
          checked_out_at = NULL,
          completed_at = NULL,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `);

      stmt.run(id);
      return this.getTask(id)!;
    } catch (error) {
      const err = error as { message?: string };
      throw new DatabaseError(
        `Failed to reset task: ${err.message || 'Unknown error'}`,
        error as Error
      );
    }
  }

  failTask(id: number): Task {
    validateTaskId(id);

    const task = this.getTask(id);
    if (!task) {
      throw new NotFoundError('Task', String(id));
    }

    if (task.status === 'failed') {
      return task;
    }

    try {
      const stmt = this.db.prepare(`
        UPDATE tasks
        SET 
          status = 'failed',
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `);

      stmt.run(id);
      return this.getTask(id)!;
    } catch (error) {
      const err = error as { message?: string };
      throw new DatabaseError(
        `Failed to mark task as failed: ${err.message || 'Unknown error'}`,
        error as Error
      );
    }
  }

  deleteTask(id: number): void {
    validateTaskId(id);

    const result = this.db.prepare('DELETE FROM tasks WHERE id = ?').run(id);

    if (result.changes === 0) {
      throw new NotFoundError('Task', String(id));
    }
  }

  getTask(id: number): Task | null {
    validateTaskId(id);

    const row = this.db
      .prepare(
        `
      SELECT 
        id,
        queue_name as queueName,
        title,
        description,
        priority,
        parameters,
        instructions,
        status,
        worker_id as workerId,
        created_at as createdAt,
        checked_out_at as checkedOutAt,
        completed_at as completedAt,
        updated_at as updatedAt
      FROM tasks
      WHERE id = ?
    `
      )
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .get(id) as any;

    if (!row) {
      return null;
    }

    if (row.parameters) {
      try {
        row.parameters = JSON.parse(row.parameters);
      } catch {
        row.parameters = null;
      }
    }

    return row as Task;
  }

  listTasks(queueName: string, status?: TaskStatus, limit?: number): Task[] {
    validateQueueName(queueName);

    if (status) {
      validateTaskStatus(status);
    }

    let query = `
      SELECT 
        id,
        queue_name as queueName,
        title,
        description,
        priority,
        parameters,
        instructions,
        status,
        worker_id as workerId,
        created_at as createdAt,
        checked_out_at as checkedOutAt,
        completed_at as completedAt,
        updated_at as updatedAt
      FROM tasks
      WHERE queue_name = ?
    `;

    const params: Array<string | number> = [queueName];

    if (status) {
      query += ' AND status = ?';
      params.push(status);
    }

    query += ' ORDER BY priority DESC, created_at ASC';

    if (limit && limit > 0) {
      query += ' LIMIT ?';
      params.push(limit);
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rows = this.db.prepare(query).all(...params) as any[];

    return rows.map(row => {
      if (row.parameters) {
        try {
          row.parameters = JSON.parse(row.parameters);
        } catch {
          row.parameters = null;
        }
      }
      return row as Task;
    });
  }
}
