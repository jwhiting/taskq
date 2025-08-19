import { Queue } from '../../core/models/Queue.js';
import { Task } from '../../core/models/Task.js';
import { TaskJournalEntry } from '../../core/models/TaskJournal.js';

export function formatQueue(queue: Queue): string {
  const lines = [
    `Name: ${queue.name}`,
    `Description: ${queue.description || '(none)'}`,
    `Instructions: ${queue.instructions || '(none)'}`,
    `Created: ${queue.createdAt}`,
    `Updated: ${queue.updatedAt}`,
  ];
  return lines.join('\n');
}

export function formatQueueTable(queues: Queue[]): string {
  if (queues.length === 0) {
    return 'No queues found.';
  }

  const headers = ['Name', 'Description', 'Created'];
  const maxWidths = {
    name: Math.max('Name'.length, ...queues.map(q => q.name.length)),
    description: Math.max(
      'Description'.length,
      ...queues.map(q => (q.description || '(none)').length)
    ),
    created: 'Created'.length,
  };

  const separator = `+${'-'.repeat(maxWidths.name + 2)}+${'-'.repeat(maxWidths.description + 2)}+${'-'.repeat(maxWidths.created + 2)}+`;

  let output = separator + '\n';
  output += `| ${headers[0]!.padEnd(maxWidths.name)} | ${headers[1]!.padEnd(maxWidths.description)} | ${headers[2]!.padEnd(maxWidths.created)} |\n`;
  output += separator + '\n';

  for (const queue of queues) {
    const description = queue.description || '(none)';
    const created = new Date(queue.createdAt).toLocaleDateString();
    output += `| ${queue.name.padEnd(maxWidths.name)} | ${description.padEnd(maxWidths.description)} | ${created.padEnd(maxWidths.created)} |\n`;
  }

  output += separator;
  return output;
}

export function formatTask(task: Task): string {
  const lines = [
    `ID: ${task.id}`,
    `Queue: ${task.queueName}`,
    `Title: ${task.title}`,
    `Description: ${task.description || '(none)'}`,
    `Priority: ${task.priority}`,
    `Parameters: ${task.parameters ? JSON.stringify(task.parameters, null, 2) : '(none)'}`,
    `Instructions: ${task.instructions || '(none)'}`,
    `Status: ${task.status}`,
    `Worker ID: ${task.workerId || '(none)'}`,
    `Created: ${task.createdAt}`,
    `Checked Out: ${task.checkedOutAt || '(none)'}`,
    `Completed: ${task.completedAt || '(none)'}`,
    `Updated: ${task.updatedAt}`,
  ];
  return lines.join('\n');
}

export function formatTaskTable(tasks: Task[]): string {
  if (tasks.length === 0) {
    return 'No tasks found.';
  }

  const headers = ['ID', 'Title', 'Status', 'Priority', 'Worker', 'Created'];
  const maxWidths = {
    id: Math.max('ID'.length, ...tasks.map(t => t.id.toString().length)),
    title: Math.max('Title'.length, ...tasks.map(t => t.title.length)),
    status: Math.max('Status'.length, ...tasks.map(t => t.status.length)),
    priority: 'Priority'.length,
    worker: Math.max('Worker'.length, ...tasks.map(t => (t.workerId || '(none)').length)),
    created: 'Created'.length,
  };

  const separator = `+${'-'.repeat(maxWidths.id + 2)}+${'-'.repeat(maxWidths.title + 2)}+${'-'.repeat(maxWidths.status + 2)}+${'-'.repeat(maxWidths.priority + 2)}+${'-'.repeat(maxWidths.worker + 2)}+${'-'.repeat(maxWidths.created + 2)}+`;

  let output = separator + '\n';
  output += `| ${headers[0]!.padEnd(maxWidths.id)} | ${headers[1]!.padEnd(maxWidths.title)} | ${headers[2]!.padEnd(maxWidths.status)} | ${headers[3]!.padEnd(maxWidths.priority)} | ${headers[4]!.padEnd(maxWidths.worker)} | ${headers[5]!.padEnd(maxWidths.created)} |\n`;
  output += separator + '\n';

  for (const task of tasks) {
    const worker = task.workerId || '(none)';
    const created = new Date(task.createdAt).toLocaleDateString();
    output += `| ${task.id.toString().padEnd(maxWidths.id)} | ${task.title.padEnd(maxWidths.title)} | ${task.status.padEnd(maxWidths.status)} | ${task.priority.toString().padEnd(maxWidths.priority)} | ${worker.padEnd(maxWidths.worker)} | ${created.padEnd(maxWidths.created)} |\n`;
  }

  output += separator;
  return output;
}

export function formatJournalTable(journal: TaskJournalEntry[]): string {
  if (journal.length === 0) {
    return 'No journal entries found.';
  }

  const headers = ['Status', 'Notes', 'Timestamp'];
  const maxWidths = {
    status: Math.max('Status'.length, ...journal.map(j => j.status.length)),
    notes: Math.max('Notes'.length, ...journal.map(j => (j.notes || '(none)').length)),
    timestamp: 'Timestamp'.length,
  };

  const separator = `+${'-'.repeat(maxWidths.status + 2)}+${'-'.repeat(maxWidths.notes + 2)}+${'-'.repeat(maxWidths.timestamp + 2)}+`;

  let output = separator + '\n';
  output += `| ${headers[0]!.padEnd(maxWidths.status)} | ${headers[1]!.padEnd(maxWidths.notes)} | ${headers[2]!.padEnd(maxWidths.timestamp)} |\n`;
  output += separator + '\n';

  for (const entry of journal) {
    const notes = entry.notes || '(none)';
    const timestamp = new Date(entry.timestamp).toLocaleString();
    output += `| ${entry.status.padEnd(maxWidths.status)} | ${notes.padEnd(maxWidths.notes)} | ${timestamp.padEnd(maxWidths.timestamp)} |\n`;
  }

  output += separator;
  return output;
}

export function formatQueueStats(stats: {
  total: number;
  pending: number;
  checkedOut: number;
  completed: number;
  failed: number;
}): string {
  return [
    `Total: ${stats.total}`,
    `Pending: ${stats.pending}`,
    `Checked Out: ${stats.checkedOut}`,
    `Completed: ${stats.completed}`,
    `Failed: ${stats.failed}`,
  ].join('\n');
}

export function parseParameters(paramString: string): Record<string, unknown> {
  // Try parsing as JSON first
  if (paramString.trim().startsWith('{')) {
    try {
      const parsed = JSON.parse(paramString);
      if (typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw new Error('Parameters must be a JSON object');
      }
      return parsed;
    } catch (error) {
      throw new Error(`Invalid JSON parameters: ${(error as Error).message}`);
    }
  }

  // Parse key=value,key2=value2 format
  const params: Record<string, unknown> = {};
  const pairs = paramString.split(',');

  for (const pair of pairs) {
    const equalIndex = pair.indexOf('=');
    if (equalIndex === -1) {
      throw new Error(`Invalid parameter format: ${pair}. Use key=value or JSON format.`);
    }

    const key = pair.slice(0, equalIndex).trim();
    const value = pair.slice(equalIndex + 1).trim();

    if (!key) {
      throw new Error(`Empty parameter key in: ${pair}`);
    }

    // Try to parse value as JSON (for numbers, booleans, etc.)
    try {
      params[key] = JSON.parse(value);
    } catch {
      // If JSON parsing fails, treat as string
      params[key] = value;
    }
  }

  return params;
}
