# TaskQ - Product Requirements Document

## Overview

TaskQ is a multi-interface task queue management system designed for agent delegation and concurrent worker operations. It provides CLI, MCP server, and web interfaces for managing named task queues with atomic SQLite operations.

## Core Features

### 1. Task Queue Management

#### Queue Operations
- **Create Queue**: Create a named queue with description and instructions
- **Delete Queue**: Remove a queue and all its tasks
- **List Queues**: Display all queues with metadata
- **Inspect Queue**: View queue details and task list

#### Queue Properties
- **Name**: Unique identifier (string)
- **Description**: Human-readable description (optional)
- **Instructions**: Default instructions for all tasks in queue (optional)
- **Created timestamp**
- **Updated timestamp**

### 2. Task Management

#### Task Operations
- **Add Task**: Create new task in specified queue
- **Checkout Task**: Mark task as checked out (atomic operation)
  - By specific task ID
  - Or get next highest priority pending task
- **Complete Task**: Mark task as completed
- **Reset Task**: Reset checked-out task back to pending
- **Delete Task**: Remove task from queue
- **List Tasks**: Display tasks in queue with filters
- **Inspect Task**: View detailed task information
- **Update Task**: Modify task properties (upsert pattern)
- **Update Queue**: Modify queue properties (upsert pattern)

#### Task Properties
- **ID**: Auto-incrementing unique identifier
- **Queue Name**: Parent queue reference
- **Title**: Task title (required)
- **Description**: Task description (optional)
- **Priority**: Integer 1-10, default 5
- **Parameters**: Key-value bag (JSON object)
- **Instructions**: Task-specific instructions (optional)
- **Status**: `pending`, `checked_out`, `completed`, `failed`
- **Status Journal**: Optional status history with timestamps
- **Created timestamp**
- **Checked out timestamp** (when applicable)
- **Completed timestamp** (when applicable)
- **Updated timestamp**

#### Task Instructions Resolution
- Final instructions = Queue instructions + Task instructions
- Either field can be empty
- Task instructions append to queue instructions

### 3. Concurrency & Safety

#### Atomic Operations
- All database operations use SQLite transactions
- Checkout operations are atomic to prevent race conditions
- Multiple workers can safely operate on same queue
- Database locking prevents corruption

#### Worker Safety
- Checkout operation atomically marks task as unavailable
- Failed workers can have tasks reset by other processes
- Status transitions are logged with timestamps

## Interface Requirements

### 1. Command Line Interface (CLI)

#### Queue Commands
```bash
taskq queue create <name> [--description "desc"] [--instructions "inst"]
taskq queue update <name> [--description "desc"] [--instructions "inst"]
taskq queue delete <name>
taskq queue list
taskq queue inspect <name>
```

#### Task Commands
```bash
taskq task add <queue> <title> [options]
  --description "desc"
  --priority 1-10
  --parameters key=value,key2=value2
  --instructions "task instructions"

taskq task update <task-id> [options]
  --title "new title"
  --description "desc"
  --priority 1-10
  --parameters key=value,key2=value2
  --instructions "task instructions"

taskq task checkout <queue|task-id> [--worker-id "worker"]
  # If queue name: get next highest priority pending task
  # If task-id: checkout specific task

taskq task complete <task-id>
taskq task reset <task-id>
taskq task delete <task-id>
taskq task list <queue> [--status pending|checked_out|completed|failed]
taskq task inspect <task-id>
```

#### Status Commands
```bash
taskq status                    # Overall system status
taskq status <queue>           # Queue-specific status
taskq journal <task-id>        # View task status journal
```

### 2. MCP Server Interface

#### Tools Available
- `create_queue(name, description?, instructions?)`
- `update_queue(name, description?, instructions?)`
- `delete_queue(name)`
- `list_queues()`
- `inspect_queue(name)`
- `add_task(queue, title, description?, priority?, parameters?, instructions?)`
- `update_task(task_id, title?, description?, priority?, parameters?, instructions?)`
- `checkout_task(queue_or_task_id, worker_id?)`
  - If queue name: returns next highest priority pending task
  - If task ID: checks out specific task
- `complete_task(task_id)`
- `reset_task(task_id)`
- `delete_task(task_id)`
- `list_tasks(queue, status?, limit?)`
- `inspect_task(task_id)`
- `get_status(queue?)`
- `update_task_journal(task_id, status, notes?)`

#### MCP Server Configuration
- Runs as stdio transport
- Handles all core operations
- Returns structured JSON responses
- Error handling with meaningful messages

### 3. Web Interface

#### Pages/Views
- **Dashboard**: Overview of all queues and their status
- **Queue List**: Browse all queues with create/delete actions
- **Queue Detail**: View queue with task list and management
- **Task Detail**: Edit task properties, view journal
- **Create Queue**: Form to create new queue
- **Create Task**: Form to add task to queue

#### Features
- Real-time updates (polling-based)
- Responsive design
- Form validation
- Confirmation dialogs for destructive actions
- Status indicators with color coding
- Sortable/filterable task lists
- Bulk operations support

#### Technical Stack
- Express.js server
- HTML/CSS/JavaScript frontend
- Server-sent events for real-time updates
- Runs on localhost with configurable port

## Database Schema

### Tables

#### queues
```sql
CREATE TABLE queues (
  name TEXT PRIMARY KEY,
  description TEXT,
  instructions TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

#### tasks
```sql
CREATE TABLE tasks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  queue_name TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  priority INTEGER DEFAULT 5,
  parameters JSON,
  instructions TEXT,
  status TEXT DEFAULT 'pending',
  worker_id TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  checked_out_at DATETIME,
  completed_at DATETIME,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (queue_name) REFERENCES queues(name) ON DELETE CASCADE
);
```

#### task_journal
```sql
CREATE TABLE task_journal (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  task_id INTEGER NOT NULL,
  status TEXT NOT NULL,
  notes TEXT,
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
);
```

#### Indexes
```sql
CREATE INDEX idx_tasks_queue_status ON tasks(queue_name, status);
CREATE INDEX idx_tasks_priority ON tasks(priority);
CREATE INDEX idx_tasks_created_at ON tasks(created_at);
CREATE INDEX idx_journal_task_id ON task_journal(task_id);
```

## Configuration

### Database Location Priority (highest to lowest)
1. Command line argument: `--db-path /path/to/db`
2. Environment variable: `TASKQ_DB_PATH`
3. Config file (platform-specific location)
4. Default user data directory

### Config File Format
Configuration file supports:
- **Database settings**: Custom database path
- **Web server settings**: Port and host configuration  
- **MCP server settings**: Worker timeout and other MCP-specific options
- **JSON format** for easy editing and validation

### Platform-Specific Paths

#### Database Default Locations
- **Windows**: `%APPDATA%\taskq\taskq.db`
- **macOS**: `~/Library/Application Support/taskq/taskq.db`
- **Linux**: `~/.local/share/taskq/taskq.db`

#### Config File Locations
- **Windows**: `%APPDATA%\taskq\config.json`
- **macOS**: `~/.config/taskq/config.json`
- **Linux**: `~/.config/taskq/config.json`

## Architecture

### Modular Design

TaskQ follows a **layered modular architecture** with clear separation of concerns:

```
┌─────────────────────────────────────────────────────────────┐
│                    Interface Layer                          │
├─────────────────┬─────────────────┬─────────────────────────┤
│   CLI Interface │   MCP Server    │   Web Interface         │
│   (cli/)        │   (mcp-server/) │   (web-server/)         │
└─────────────────┴─────────────────┴─────────────────────────┘
┌─────────────────────────────────────────────────────────────┐
│                    Core Library                             │
│   TaskStore + Queue/Task Operations (core/)                │
│   - Database management                                     │
│   - Business logic                                          │
│   - Atomic operations                                       │
│   - Configuration                                           │
└─────────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────────┐
│                    Data Layer                               │
│   SQLite Database + Schema (data/)                         │
└─────────────────────────────────────────────────────────────┘
```

### Component Specifications

#### 1. Core Library (`src/core/`)
**Purpose**: Encapsulated business logic and data operations
**Exports**:
- `TaskStore` class - Main API for all operations
- `Queue`, `Task`, `TaskJournal` interfaces
- `Configuration` management
- Error types and validation

**Key Features**:
- Database connection management
- Atomic queue/task operations
- Configuration resolution (args → env → config → defaults)
- Thread-safe concurrent operations
- Input validation and sanitization

#### 2. CLI Interface (`src/cli/`)
**Purpose**: Command-line interface
**Dependencies**: Core Library only
**Features**:
- Commander.js-based command structure
- Colorized output with Chalk
- Table formatting for lists
- Progress indicators for long operations
- Error handling with helpful messages

#### 3. MCP Server (`src/mcp-server/`)
**Purpose**: Model Context Protocol server
**Dependencies**: Core Library + MCP SDK
**Features**:
- Stdio transport for AI assistant communication
- All core operations exposed as tools
- Structured JSON responses
- Error handling with context

#### 4. Web Interface (`src/web-server/`)
**Purpose**: HTTP server + web UI
**Dependencies**: Core Library + Express.js
**Features**:
- RESTful API backend
- Static file serving for frontend
- Real-time updates via Server-Sent Events
- CORS configuration for localhost
- Responsive web UI

### File Structure
```
src/
├── core/
│   ├── TaskStore.ts           # Main API class
│   ├── models/                # Data models & interfaces
│   │   ├── Queue.ts
│   │   ├── Task.ts
│   │   └── TaskJournal.ts
│   ├── database/              # Database layer
│   │   ├── Database.ts        # SQLite connection & schema
│   │   └── migrations.ts      # Schema definitions
│   ├── operations/            # Business logic
│   │   ├── QueueOperations.ts
│   │   ├── TaskOperations.ts
│   │   └── JournalOperations.ts
│   ├── config/
│   │   └── Configuration.ts   # Config resolution
│   └── utils/
│       ├── validation.ts
│       └── errors.ts
├── cli/
│   ├── index.ts              # CLI entry point
│   ├── commands/             # Command implementations
│   │   ├── queue.ts
│   │   ├── task.ts
│   │   └── status.ts
│   └── utils/
│       └── formatting.ts     # Output formatting
├── mcp-server/
│   ├── index.ts              # MCP server entry point
│   ├── tools/                # MCP tool implementations
│   │   ├── queue-tools.ts
│   │   ├── task-tools.ts
│   │   └── status-tools.ts
│   └── utils/
│       └── responses.ts      # Response formatting
├── web-server/
│   ├── index.ts              # Web server entry point
│   ├── routes/               # API routes
│   │   ├── queues.ts
│   │   ├── tasks.ts
│   │   └── status.ts
│   ├── middleware/
│   │   ├── cors.ts
│   │   └── error-handler.ts
│   └── public/               # Static web assets
│       ├── index.html
│       ├── css/
│       └── js/
└── types/                    # Shared TypeScript types
    └── index.ts
```

## Package Structure

### NPM Package Configuration
Package structure requirements:
- **Main export**: Core library as default export
- **Multiple binaries**: CLI, MCP server, and web server executables
- **Subpath exports**: Allow importing specific components
- **TypeScript support**: Include type definitions
- **Single package**: All components distributed together

### Distribution
- **Single npm package** with multiple entry points
- **Core library** can be imported by other Node.js projects
- **CLI tool** available via `npx taskq`
- **MCP server** via `npx taskq-mcp-server`
- **Web server** via `npx taskq-web`

## Development Requirements

### Technology Stack
- **Language**: TypeScript with strict type checking
- **Database**: SQLite with better-sqlite3
- **CLI Framework**: Commander.js
- **Web Framework**: Express.js
- **MCP SDK**: @modelcontextprotocol/sdk
- **Testing**: Jest for unit tests, Cypress for E2E
- **Code Quality**: ESLint + Prettier
- **Build**: TypeScript compiler

### Code Quality Standards
- 100% TypeScript coverage
- ESLint configuration with strict rules
- Prettier for consistent formatting
- Pre-commit hooks for linting/formatting
- Comprehensive error handling
- Input validation and sanitization

### Testing Strategy

#### Philosophy: No Mocks, Real Testing
TaskQ uses a **mock-free testing approach** for maximum confidence:
- **Unit tests** test pure functions and isolated logic
- **Integration/E2E tests** use real databases and components
- **Test database** activated via `NODE_ENV=test` environment variable
- **Temporary test databases** created/destroyed for each test suite

#### Test Environment Configuration
- Test databases stored in system temp directory with unique names
- Test mode activated via `NODE_ENV=test` environment variable
- Test databases automatically created and destroyed for each test suite
- Complete isolation from user data during testing

#### Testing Requirements by Component

##### 1. Core Library Tests (`tests/core/`)
**Framework**: Jest
**Type**: Unit + Integration
**Coverage**:
- Pure business logic functions (unit tests)
- Database operations with real SQLite (integration)
- Configuration resolution logic
- Concurrent operation safety
- Error handling and validation
- Atomic transaction behavior

##### 2. CLI Interface Tests (`tests/cli/`)
**Framework**: Jest + child_process
**Type**: Integration
**Coverage**:
- Command parsing and execution
- Output formatting and colors
- Error message display
- Configuration override behavior
- Real database operations via CLI commands

##### 3. MCP Server Tests (`tests/mcp-server/`)
**Framework**: Jest + MCP test harness
**Type**: Integration
**Coverage**:
- Tool schema validation
- Request/response handling
- Error propagation
- Real database operations via MCP tools
- Stdio transport communication

##### 4. Web Interface Tests (`tests/web/`)
**Framework**: Cypress
**Type**: End-to-End
**Coverage**:
- Complete user workflows
- API endpoint functionality
- Real-time updates
- Form validation and submission
- Error handling in UI
- Cross-browser compatibility
- Responsive design behavior

##### 5. Cross-Interface Tests (`tests/integration/`)
**Framework**: Jest
**Type**: Integration
**Coverage**:
- Data consistency across CLI/MCP/Web
- Concurrent access from multiple interfaces
- Configuration sharing
- Database locking behavior

### Test Database Management

#### Automatic Test Database Setup
- Each test suite gets a fresh, isolated database
- Automatic cleanup after test completion
- No manual database management required for tests
- Consistent test environment across all test runs

#### Test Data Factories
- Consistent test data builders for queues and tasks
- Configurable test data with sensible defaults
- Support for test scenario variations through overrides
- Standardized test data across all test suites

#### Concurrency Testing Requirements
- Multiple simultaneous operations must be tested for atomicity
- Checkout operations must be proven to be race-condition free
- Database locking behavior must be validated under load
- Worker safety must be demonstrated through concurrent access tests

### Performance Requirements
- Database operations < 10ms for typical workloads
- Web interface responsive < 200ms page loads
- Support for 10,000+ tasks per queue
- Concurrent worker operations without conflicts
- Efficient indexing for large datasets

## Security Considerations

### Data Protection
- Local-only storage (no network exposure by default)
- SQLite file permissions restricted to user
- Input sanitization for all interfaces
- SQL injection prevention
- XSS protection in web interface

### Access Control
- File system permissions for database access
- Web interface only on localhost by default
- No authentication required (local-only system)

## Update/Upsert Semantics

### Best Practice Pattern
Both CLI and MCP interfaces use **partial update semantics**:
- Only specified fields are updated
- Unspecified fields remain unchanged
- Empty strings `""` clear the field value
- Omitted parameters preserve existing values

### Update Examples
- Create queue with minimal information, enhance later
- Add instructions to existing queue while preserving description
- Clear specific fields while maintaining other data
- Update individual task properties without affecting others

### Implementation Notes
- Use `COALESCE` in SQL for partial updates
- Validate that at least one field is provided for updates
- Return updated entity after successful operation
- Maintain audit trail via `updated_at` timestamp

## Future Enhancements (Out of Scope)

- Network-based queue sharing
- Authentication/authorization
- Task scheduling/cron functionality
- Advanced reporting/analytics
- Plugin system for custom task types
- Distributed queue operations
- Real-time WebSocket updates
- Database schema migrations

## Success Criteria

1. **Functionality**: All core operations work across all interfaces
2. **Reliability**: Zero data corruption under concurrent access
3. **Performance**: Handles large queues (10k+ tasks) efficiently
4. **Usability**: Intuitive CLI and web interfaces
5. **Quality**: >95% test coverage, passes all linting
6. **Documentation**: Complete API docs and usage examples
7. **Distribution**: Easy installation via npm/npx

## Acceptance Tests

### Core Functionality
- [ ] Create/delete queues via all interfaces
- [ ] Add/checkout/complete tasks atomically
- [ ] Concurrent worker operations without conflicts
- [ ] Priority-based task ordering
- [ ] Status journal tracking
- [ ] Configuration override hierarchy

### Interface Consistency
- [ ] Same operations available in CLI, MCP, and web
- [ ] Consistent data representation across interfaces
- [ ] Error messages are clear and actionable

### Quality Assurance
- [ ] All tests pass (unit, integration, E2E)
- [ ] Code passes linting and formatting checks
- [ ] Documentation is complete and accurate
- [ ] Package installs and runs on all target platforms
