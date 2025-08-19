/* eslint-disable no-dupe-class-members */
import { TaskQDatabase } from './database/Database.js';
import { Configuration, ConfigOptions } from './config/Configuration.js';
import { QueueOperations } from './operations/QueueOperations.js';
import { TaskOperations } from './operations/TaskOperations.js';
import { JournalOperations } from './operations/JournalOperations.js';
import { Queue, CreateQueueRequest, UpdateQueueRequest } from './models/Queue.js';
import { Task, TaskStatus, CreateTaskRequest, UpdateTaskRequest } from './models/Task.js';
import { TaskJournalEntry, CreateTaskJournalRequest } from './models/TaskJournal.js';

export class TaskStore {
  private readonly db: TaskQDatabase;
  private readonly queueOps: QueueOperations;
  private readonly taskOps: TaskOperations;
  private readonly journalOps: JournalOperations;

  constructor(options?: ConfigOptions) {
    const config = new Configuration(options);
    this.db = new TaskQDatabase(config);
    const sqliteDb = this.db.getDatabase();
    this.queueOps = new QueueOperations(sqliteDb);
    this.taskOps = new TaskOperations(sqliteDb);
    this.journalOps = new JournalOperations(sqliteDb);
  }

  createQueue(request: CreateQueueRequest): Queue {
    return this.queueOps.createQueue(request);
  }

  updateQueue(name: string, request: UpdateQueueRequest): Queue {
    return this.queueOps.updateQueue(name, request);
  }

  deleteQueue(name: string): void {
    return this.queueOps.deleteQueue(name);
  }

  getQueue(name: string): Queue | null {
    return this.queueOps.getQueue(name);
  }

  listQueues(): Queue[] {
    return this.queueOps.listQueues();
  }

  getQueueStats(name: string): {
    total: number;
    pending: number;
    checkedOut: number;
    completed: number;
    failed: number;
  } {
    return this.queueOps.getQueueStats(name);
  }

  addTask(request: CreateTaskRequest): Task {
    return this.taskOps.addTask(request);
  }

  updateTask(id: number, request: UpdateTaskRequest): Task {
    return this.taskOps.updateTask(id, request);
  }

  checkoutTask(queueName: string, workerId?: string): Task | null;
  checkoutTask(taskId: number, workerId?: string): Task;
  checkoutTask(queueNameOrTaskId: string | number, workerId?: string): Task | null {
    return this.taskOps.checkoutTask(queueNameOrTaskId, workerId);
  }

  completeTask(id: number): Task {
    return this.taskOps.completeTask(id);
  }

  resetTask(id: number): Task {
    return this.taskOps.resetTask(id);
  }

  failTask(id: number): Task {
    return this.taskOps.failTask(id);
  }

  deleteTask(id: number): void {
    return this.taskOps.deleteTask(id);
  }

  getTask(id: number): Task | null {
    return this.taskOps.getTask(id);
  }

  listTasks(queueName: string, status?: TaskStatus, limit?: number): Task[] {
    return this.taskOps.listTasks(queueName, status, limit);
  }

  addJournalEntry(request: CreateTaskJournalRequest): TaskJournalEntry {
    return this.journalOps.addJournalEntry(request);
  }

  getTaskJournal(taskId: number): TaskJournalEntry[] {
    return this.journalOps.getTaskJournal(taskId);
  }

  clearTaskJournal(taskId: number): void {
    return this.journalOps.clearTaskJournal(taskId);
  }

  close(): void {
    this.db.close();
  }

  getDatabase(): TaskQDatabase {
    return this.db;
  }

  runInTransaction<T>(fn: () => T): T {
    return this.db.getDatabase().transaction(fn)();
  }
}
