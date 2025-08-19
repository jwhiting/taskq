export type TaskStatus = 'pending' | 'checked_out' | 'completed' | 'failed';

export interface Task {
  readonly id: number;
  readonly queueName: string;
  readonly title: string;
  readonly description?: string;
  readonly priority: number;
  readonly parameters?: Record<string, unknown>;
  readonly instructions?: string;
  readonly status: TaskStatus;
  readonly workerId?: string;
  readonly createdAt: string;
  readonly checkedOutAt?: string;
  readonly completedAt?: string;
  readonly updatedAt: string;
}

export interface CreateTaskRequest {
  readonly queueName: string;
  readonly title: string;
  readonly description?: string;
  readonly priority?: number;
  readonly parameters?: Record<string, unknown>;
  readonly instructions?: string;
}

export interface UpdateTaskRequest {
  readonly title?: string;
  readonly description?: string;
  readonly priority?: number;
  readonly parameters?: Record<string, unknown>;
  readonly instructions?: string;
}
