import path from 'path';
import os from 'os';
import fs from 'fs';

export interface DatabaseConfig {
  readonly path: string;
}

export interface WebConfig {
  readonly port: number;
  readonly host: string;
}

export interface McpConfig {
  readonly workerTimeout: number;
}

export interface TaskQConfig {
  readonly database: DatabaseConfig;
  readonly web: WebConfig;
  readonly mcp: McpConfig;
}

export interface ConfigOptions {
  readonly dbPath?: string;
  readonly configPath?: string;
}

/**
 * Configuration resolution with priority:
 * 1. Command line arguments (via options)
 * 2. Environment variables
 * 3. Config file (platform-specific location)
 * 4. Default values
 */
export class Configuration {
  private readonly config: TaskQConfig;

  constructor(options: ConfigOptions = {}) {
    this.config = this.resolveConfiguration(options);
  }

  public getConfig(): TaskQConfig {
    return this.config;
  }

  public getDatabasePath(): string {
    return this.config.database.path;
  }

  public getWebConfig(): WebConfig {
    return this.config.web;
  }

  public getMcpConfig(): McpConfig {
    return this.config.mcp;
  }

  private resolveConfiguration(options: ConfigOptions): TaskQConfig {
    // Load config file
    const fileConfig = this.loadConfigFile(options.configPath);

    // Resolve database path with priority
    const databasePath = this.resolveDatabasePath(options.dbPath, fileConfig?.database?.path);

    return {
      database: {
        path: databasePath,
      },
      web: {
        port: Number(process.env['TASKQ_WEB_PORT']) || fileConfig?.web?.port || 3000,
        host: process.env['TASKQ_WEB_HOST'] || fileConfig?.web?.host || 'localhost',
      },
      mcp: {
        workerTimeout:
          Number(process.env['TASKQ_WORKER_TIMEOUT']) || fileConfig?.mcp?.workerTimeout || 3600,
      },
    };
  }

  private resolveDatabasePath(cliPath?: string, configPath?: string): string {
    // 1. Command line argument (highest priority)
    if (cliPath) {
      return path.resolve(cliPath);
    }

    // 2. Environment variable
    if (process.env['TASKQ_DB_PATH']) {
      return path.resolve(process.env['TASKQ_DB_PATH']);
    }

    // 3. Config file
    if (configPath) {
      return path.resolve(configPath);
    }

    // 4. Default user data directory (lowest priority)
    return this.getDefaultDatabasePath();
  }

  private getDefaultDatabasePath(): string {
    const appName = 'taskq';

    switch (process.platform) {
      case 'win32': {
        const appData = process.env['APPDATA'] || path.join(os.homedir(), 'AppData', 'Roaming');
        return path.join(appData, appName, 'taskq.db');
      }
      case 'darwin': {
        return path.join(os.homedir(), 'Library', 'Application Support', appName, 'taskq.db');
      }
      default: {
        const xdgData = process.env['XDG_DATA_HOME'] || path.join(os.homedir(), '.local', 'share');
        return path.join(xdgData, appName, 'taskq.db');
      }
    }
  }

  private getDefaultConfigPath(): string {
    const appName = 'taskq';

    switch (process.platform) {
      case 'win32': {
        const appData = process.env['APPDATA'] || path.join(os.homedir(), 'AppData', 'Roaming');
        return path.join(appData, appName, 'config.json');
      }
      default: {
        // Both macOS and Linux use ~/.config
        return path.join(os.homedir(), '.config', appName, 'config.json');
      }
    }
  }

  private loadConfigFile(configPath?: string): Partial<TaskQConfig> | null {
    const filePath = configPath || this.getDefaultConfigPath();

    try {
      if (!fs.existsSync(filePath)) {
        return null;
      }

      const content = fs.readFileSync(filePath, 'utf-8');
      const parsed = JSON.parse(content) as Partial<TaskQConfig>;

      return parsed;
    } catch (error) {
      // If config file is invalid, warn but continue with defaults
      console.warn(`Warning: Failed to load config file ${filePath}:`, error);
      return null;
    }
  }
}
