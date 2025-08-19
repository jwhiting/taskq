export interface Queue {
  readonly name: string;
  readonly description?: string;
  readonly instructions?: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface CreateQueueRequest {
  readonly name: string;
  readonly description?: string;
  readonly instructions?: string;
}

export interface UpdateQueueRequest {
  readonly description?: string;
  readonly instructions?: string;
}
