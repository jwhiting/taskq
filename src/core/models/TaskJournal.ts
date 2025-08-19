export interface TaskJournalEntry {
  readonly id: number;
  readonly taskId: number;
  readonly status: string;
  readonly notes?: string;
  readonly timestamp: string;
}

export interface CreateTaskJournalRequest {
  readonly taskId: number;
  readonly status: string;
  readonly notes?: string;
}
