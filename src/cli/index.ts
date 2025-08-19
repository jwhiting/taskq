#!/usr/bin/env node

import { Command } from 'commander';
import { readFileSync } from 'fs';
import { join } from 'path';
import { registerQueueCommands } from './commands/queue';
import { registerTaskCommands } from './commands/task';
import { registerStatusCommands } from './commands/status';

function getVersion(): string {
  try {
    const packagePath = join(__dirname, '../../package.json');
    const packageJson = JSON.parse(readFileSync(packagePath, 'utf-8'));
    return packageJson.version || '0.0.0';
  } catch {
    return '0.0.0';
  }
}

function main(): void {
  try {
    const program = new Command();

    program
      .name('taskq')
      .description('TaskQ - A durable, concurrency-safe task queue service')
      .version(getVersion())
      .option('--db-path <path>', 'Path to SQLite database file');

    // Register command groups
    registerQueueCommands(program);
    registerTaskCommands(program);
    registerStatusCommands(program);

    program.parse();
  } catch (error) {
    const err = error as Error;
    console.error('Error:', err.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

export { main };
