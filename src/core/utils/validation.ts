import { ValidationError } from './errors';

export function validateQueueName(name: string): void {
  if (!name || typeof name !== 'string') {
    throw new ValidationError('Queue name is required and must be a string');
  }
  if (name.trim().length === 0) {
    throw new ValidationError('Queue name cannot be empty');
  }
  if (name.length > 255) {
    throw new ValidationError('Queue name cannot exceed 255 characters');
  }
  if (!/^[\w\-.]+$/.test(name)) {
    throw new ValidationError(
      'Queue name can only contain letters, numbers, hyphens, underscores, and dots'
    );
  }
}

export function validateTaskTitle(title: string): void {
  if (!title || typeof title !== 'string') {
    throw new ValidationError('Task title is required and must be a string');
  }
  if (title.trim().length === 0) {
    throw new ValidationError('Task title cannot be empty');
  }
  if (title.length > 500) {
    throw new ValidationError('Task title cannot exceed 500 characters');
  }
}

export function validatePriority(priority: number): void {
  if (typeof priority !== 'number' || !Number.isInteger(priority)) {
    throw new ValidationError('Priority must be an integer');
  }
  if (priority < 1 || priority > 10) {
    throw new ValidationError('Priority must be between 1 and 10');
  }
}

export function validateTaskStatus(status: string): void {
  const validStatuses = ['pending', 'checked_out', 'completed', 'failed'];
  if (!validStatuses.includes(status)) {
    throw new ValidationError(
      `Invalid task status: ${status}. Must be one of: ${validStatuses.join(', ')}`
    );
  }
}

export function validateParameters(params: unknown): Record<string, unknown> | undefined {
  if (params === undefined || params === null) {
    return undefined;
  }

  if (typeof params === 'string') {
    try {
      const parsed = JSON.parse(params);
      if (typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw new ValidationError('Parameters must be a JSON object');
      }
      return parsed;
    } catch {
      throw new ValidationError('Invalid JSON in parameters');
    }
  }

  if (typeof params !== 'object' || Array.isArray(params)) {
    throw new ValidationError('Parameters must be an object');
  }

  return params as Record<string, unknown>;
}

export function validateTaskId(id: number): void {
  if (typeof id !== 'number' || !Number.isInteger(id) || id <= 0) {
    throw new ValidationError('Task ID must be a positive integer');
  }
}
