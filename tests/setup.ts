import path from 'path';
import os from 'os';
import fs from 'fs';

// Test environment setup
beforeAll(() => {
  // Ensure we're in test mode
  if (process.env['NODE_ENV'] !== 'test') {
    process.env['NODE_ENV'] = 'test';
  }

  // Create test database path if not set
  if (!process.env['TASKQ_DB_PATH']) {
    const testDbPath = path.join(
      os.tmpdir(),
      'taskq-test',
      `test-${Date.now()}-${Math.random().toString(36).substring(7)}.db`
    );
    process.env['TASKQ_DB_PATH'] = testDbPath;

    // Ensure test directory exists
    fs.mkdirSync(path.dirname(testDbPath), { recursive: true });
  }
});

// Cleanup after all tests
afterAll(() => {
  // Clean up test database if it exists
  if (process.env['TASKQ_DB_PATH'] && fs.existsSync(process.env['TASKQ_DB_PATH'])) {
    try {
      fs.unlinkSync(process.env['TASKQ_DB_PATH']);
    } catch (error) {
      console.warn('Failed to cleanup test database:', error);
    }
  }
});
