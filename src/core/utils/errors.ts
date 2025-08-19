export class TaskQError extends Error {
  constructor(
    message: string,
    public code: string
  ) {
    super(message);
    this.name = 'TaskQError';
  }
}

export class ValidationError extends TaskQError {
  constructor(message: string) {
    super(message, 'VALIDATION_ERROR');
    this.name = 'ValidationError';
  }
}

export class NotFoundError extends TaskQError {
  constructor(resource: string, identifier: string) {
    super(`${resource} not found: ${identifier}`, 'NOT_FOUND');
    this.name = 'NotFoundError';
  }
}

export class ConflictError extends TaskQError {
  constructor(message: string) {
    super(message, 'CONFLICT');
    this.name = 'ConflictError';
  }
}

export class DatabaseError extends TaskQError {
  constructor(
    message: string,
    public originalError?: Error
  ) {
    super(message, 'DATABASE_ERROR');
    this.name = 'DatabaseError';
  }
}

export class CheckoutError extends TaskQError {
  constructor(message: string) {
    super(message, 'CHECKOUT_ERROR');
    this.name = 'CheckoutError';
  }
}
