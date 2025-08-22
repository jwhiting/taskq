# TaskQ Development Plan

## Overview

This development plan breaks TaskQ implementation into phases of approximately 5-10 hours each. Each phase builds incrementally, with full test coverage using real databases (no mocks). Phases are only complete when all tests pass.

## Testing Strategy

- **No Mocks**: All tests exercise the full system to the database
- **Test Database**: Environment variable `NODE_ENV=test` enables alternate database
- **Full Stack Testing**: Every component tested with real dependencies
- **Cypress E2E**: Web interface tested with complete stack integration

---

## Phase 1: Project Foundation & Core Database ✅ COMPLETED (8 hours)

### Goals ✅

- Set up TypeScript project structure
- Implement SQLite database layer with schema
- Create basic configuration management
- Establish testing infrastructure
- **Configure development container environment**

### Deliverables ✅

- **Yarn Berry** (Yarn 4.x) package manager setup with PnP and local cache
- `package.json` with all dependencies and scripts
- TypeScript configuration with strict settings and Node.js types
- **ESLint configuration** (simplified, compatible with TypeScript 5.9.2)
- **Prettier configuration** for consistent formatting
- **Build process** with TypeScript compiler and watch mode
- **DevContainer configuration** for consistent development environment
- **VS Code workspace settings** and recommended extensions
- SQLite database schema implementation with full table structure
- Configuration resolution system (args → env → config → defaults)
- Mock-free testing infrastructure with isolated test databases
- **Data models** for Queue, Task, and TaskJournal

### Key Files ✅

- **DevContainer Setup:**
  - `.devcontainer/devcontainer.json` - Container configuration with Yarn Berry support
  - `.devcontainer/Dockerfile` - Container image with corepack enabled
  - `.vscode/extensions.json` - Recommended extensions including Dev Containers
  - `.vscode/settings.json` - Workspace settings for TypeScript/Yarn Berry
- **Yarn Berry Configuration:**
  - `.yarnrc.yml` - Yarn Berry PnP configuration with local cache
  - `package.json` - Dependencies, scripts, and package manager lock
  - `yarn.lock` - Yarn Berry lockfile
  - `.yarn/sdks/` - Yarn SDK for VS Code TypeScript integration
- **TypeScript & Linting:**
  - `tsconfig.json` - Strict TypeScript with Node.js and Jest types
  - `.eslintrc.json` - ESLint with TypeScript support
  - `.prettierrc` - Code formatting rules
- **Core Implementation:**
  - `src/core/database/Database.ts` - SQLite connection, schema, and transactions
  - `src/core/config/Configuration.ts` - Platform-aware configuration resolution
  - `src/core/models/` - TypeScript interfaces for Queue, Task, TaskJournal
- **Testing:**
  - `tests/setup.ts` - Test environment configuration
  - `tests/core/database.test.ts` - Database operation tests (6 tests passing)
  - `jest.config.js` - Jest configuration for TypeScript
- **Project Files:**
  - `.gitignore` - Yarn Berry optimized ignore patterns
  - `.editorconfig` - Consistent editor settings

### Builds On

- Nothing (foundation phase)

### Enables

- All subsequent phases depend on database and configuration
- **DevContainer provides consistent development environment**
- **Yarn Berry PnP ensures deterministic dependency resolution**

### Completion Criteria ✅

- [x] **Yarn Berry (4.x) configured with Plug'n'Play and local cache**
- [x] **All dependencies install correctly with Yarn**
- [x] **TypeScript compiles with strict settings and no errors**
- [x] **ESLint passes with no warnings or errors**
- [x] **Prettier formatting is consistent across all files**
- [x] **Build process works (compile, watch, clean)**
- [x] **DevContainer builds and runs successfully**
- [x] **VS Code TypeScript integration works with Yarn PnP**
- [x] **SQLite database creates all tables correctly**
- [x] **Configuration loads from all sources in correct precedence**
- [x] **Test database isolation works properly**
- [x] **All database operations are atomic and thread-safe**
- [x] **6/6 database tests passing**

### Actual Implementation Notes

- **Simplified ESLint config** due to version compatibility issues with Airbnb rules
- **Added Yarn SDK** for proper VS Code TypeScript integration with PnP
- **Enhanced DevContainer setup** with corepack and non-interactive configuration
- **Comprehensive gitignore** optimized for Yarn Berry (ignores cache, keeps essentials)
- **Platform-specific configuration paths** for Windows/macOS/Linux support
- **Mock-free testing strategy** successfully implemented with isolated test databases

---

## Phase 2: Core Task Store Library ✅ COMPLETED (4 hours)

### Goals ✅

- Implement complete TaskStore API
- All queue and task operations with atomic transactions
- Full business logic with validation
- Comprehensive test coverage

### Deliverables ✅

- Complete TaskStore class with all operations
- Queue operations (create, update, delete, list, inspect)
- Task operations (add, update, checkout, complete, reset, delete, list)
- Journal operations for task status tracking
- Input validation and error handling

### Key Files ✅

- `src/core/TaskStore.ts` - Main API class
- `src/core/models/` - Data models and interfaces
- `src/core/operations/` - Business logic operations
  - `QueueOperations.ts` - Queue CRUD with validation
  - `TaskOperations.ts` - Task management with atomic checkout
  - `JournalOperations.ts` - Task status tracking
- `src/core/utils/validation.ts` - Input validation
- `src/core/utils/errors.ts` - Custom error types
- `src/core/index.ts` - Public API exports
- `tests/core/TaskStore.test.ts` - Comprehensive API tests (47 tests)
- `tests/core/concurrency.test.ts` - Concurrent operation tests (11 tests)

### Builds On

- Phase 1: Database layer and configuration

### Enables

- All interfaces (CLI, MCP, Web) can use the core library
- Programmatic usage by developers and agents

### Completion Criteria ✅

- [x] All queue operations work correctly
- [x] All task operations work correctly
- [x] Checkout operations are atomic (race condition free)
- [x] Priority-based task ordering works
- [x] Status journal tracking functions properly
- [x] Concurrent operations are safe
- [x] Input validation catches all edge cases
- [x] Error messages are clear and actionable

### Actual Implementation Notes

- **63 tests passing** with real SQLite database (no mocks)
- **146 assertions** verifying core functionality
- **Atomic checkout** prevents race conditions with database transactions
- **Partial update semantics** using CASE WHEN for field updates
- **Custom error hierarchy** for clear error reporting
- **TypeScript strict mode** with full type safety
- **Transaction support** via better-sqlite3 transaction API
- **Concurrency tests** simulate real race conditions and verify atomicity

---

## Phase 3: CLI Interface ✅ COMPLETED (8 hours)

### Goals ✅

- Complete command-line interface
- All queue and task commands
- Comprehensive help system
- Readable output formatting

### Deliverables ✅

- Full CLI with Commander.js 14.0.0 structure
- **Queue commands**: create-queue, update-queue, delete-queue, list-queues, inspect-queue
- **Task commands**: add-task, update-task, checkout-task, complete-task, reset-task, fail-task, delete-task, list-tasks, inspect-task
- **Status commands**: status (system-wide and queue-specific), journal
- **Parameter parsing**: Dual format support (key=value and JSON)
- **Table formatting**: ASCII tables for list commands
- **Error handling**: Proper stderr output and exit codes

### Key Files ✅

- `src/cli/index.ts` - CLI entry point with version and help
- `src/cli/commands/` - Command implementations:
  - `queue.ts` - Queue management commands (5 commands)
  - `task.ts` - Task management commands (9 commands) 
  - `status.ts` - Status and monitoring commands (2 commands)
- `src/cli/utils/formatting.ts` - Output formatting and parameter parsing
- `tests/cli/cli.test.ts` - CLI integration tests (27 tests)
- `dist/cli/index.js` - Compiled CLI executable

### Builds On ✅

- Phase 2: Core TaskStore library provides all functionality

### Enables ✅

- Direct command-line usage
- Scripting and automation
- Development and debugging workflows

### Completion Criteria ✅

- [x] **All CLI commands work correctly** (16 total commands)
- [x] **Help system provides comprehensive guidance** (built-in Commander.js help)
- [x] **Output formatting is clear and consistent** (ASCII tables for lists)
- [x] **Error handling provides helpful messages** (stderr + proper exit codes)
- [x] **Configuration override works via CLI args** (--db-path option)
- [x] **Integration tests pass** (27/27 CLI tests passing)

### Actual Implementation Notes ✅

- **Single-token commands** (create-queue, not queue create) for better CLI UX
- **Dual parameter parsing**: Supports both `key=value,key2=value2` and JSON formats
- **Table formatting**: Uses ASCII tables for readable list output
- **Commander.js 14.0.0**: Latest version with full TypeScript support
- **No colored output**: Clean, simple output as requested
- **Comprehensive testing**: 27 CLI tests covering all commands and edge cases
- **Error architecture**: Proper stderr output with non-zero exit codes

### Testing Architecture Issues

**Note**: CLI tests use mocking for `process.exit`, `console.log`, and `console.error` due to testing constraints. This deviates from the no-mock requirement but was necessary to test CLI behavior without terminating the test runner. The mock interference with try/catch blocks created the test inconsistency issue that was debugged and resolved.

- **90 total tests passing** (63 core + 27 CLI)
- **Core tests remain completely mock-free** as per original requirements
- **CLI tests use system-level mocks** for process.exit and console capture

---

## Phase 4: MCP Server ✅ COMPLETED (6-8 hours)

### Goals ✅

- Complete MCP server implementation using the official TypeScript SDK
- All core operations exposed as MCP tools with rich schemas
- Comprehensive testing using SDK-native approaches
- Robust error handling with structured responses

### Technical Approach

#### MCP TypeScript SDK Usage
- **Framework**: `@modelcontextprotocol/sdk` for server implementation
- **Transport**: `StdioServerTransport` for AI assistant communication
- **Validation**: Zod schemas for all tool parameters
- **Architecture**: Direct integration with TaskStore core library

#### Server Implementation Pattern
```typescript
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const server = new McpServer({
  name: "taskq-mcp-server",
  version: "0.1.0"
});

// Register tools with rich schemas
server.registerTool("create_queue", {
  title: "Create Task Queue",
  description: "Create a new named task queue",
  inputSchema: {
    name: z.string().describe("Queue name"),
    description: z.string().optional(),
    instructions: z.string().optional()
  }
}, async ({ name, description, instructions }) => {
  // Direct TaskStore integration
});
```

#### Testing Strategy: SDK-Native Mockless Testing

**Philosophy**: Maintain TaskQ's no-mock approach using MCP SDK's built-in testing capabilities.

**Core Testing Pattern**:
```typescript
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";

// Real MCP server + real TaskStore + real test database
const taskStore = new TaskStore({ dbPath: testDbPath });
const server = new TaskQMcpServer(taskStore);

// Real transport pair (no mocks, no CLI)
const { client, server: serverTransport } = InMemoryTransport.createLinkedPair();
await server.connect(serverTransport);

// Test real MCP protocol with real database operations
const response = await sendMcpRequest(client, {
  method: "tools/call",
  params: { name: "create_queue", arguments: { name: "test" } }
});
```

**Testing Benefits**:
- **Full integration**: Tests complete MCP protocol flow
- **Real concurrency**: Multiple transport pairs test race conditions
- **Atomic transactions**: Same-process database access
- **Debuggable**: Stack traces and breakpoints work
- **Fast**: No subprocess overhead

#### mcptools Consideration

**Why we considered mcptools**: The `f/mcptools` CLI provides end-to-end testing of MCP servers from an external client perspective.

**Why we chose SDK-native testing instead**:
- **Consistency**: Maintains TaskQ's established no-mock testing philosophy
- **Performance**: Direct API calls vs subprocess overhead
- **Reliability**: No CLI parsing or external process dependencies
- **Integration**: Better alignment with existing Jest test infrastructure
- **Development**: Easier debugging and development workflow

**Note**: mcptools remains valuable for manual testing and documentation examples, but is not required for comprehensive test coverage.

### Deliverables ✅

- MCP server with stdio transport and full tool suite
- All queue and task operations as MCP tools (16 tools total)
- Zod schemas with rich parameter descriptions and validation
- Structured error handling with meaningful context
- Comprehensive tool metadata serving as embedded documentation
- SDK-native integration tests with real database operations

### Key Files ✅

- `src/mcp-server/index.ts` - MCP server entry point with transport setup
- `src/mcp-server/tools/` - MCP tool implementations:
  - `queue-tools.ts` - Queue operations (create, update, delete, list, inspect) - 5 tools
  - `task-tools.ts` - Task operations (add, update, checkout, complete, reset, fail, delete, list, inspect) - 9 tools
  - `status-tools.ts` - Status and journal operations (get_status, update_task_journal) - 2 tools
- `src/mcp-server/utils/responses.ts` - Response formatting utilities
- `tests/mcp-server/` - MCP server integration tests:
  - `mcp-server.test.ts` - Full protocol integration tests (comprehensive tool testing)
  - `mcp-concurrency.test.ts` - Multi-client concurrent operation tests (MCP-specific concurrency)

### Builds On ✅

- Phase 2: Core TaskStore library provides all functionality
- MCP TypeScript SDK for server implementation and testing

### Enables ✅

- AI assistant integration (Claude Desktop, etc.)
- Agent-driven task management workflows
- MCP client usage across all compatible AI tools
- Programmatic MCP server deployment

### Completion Criteria ✅

- [x] MCP server implements all 16 required tools
- [x] All tools have comprehensive Zod schemas with descriptions
- [x] Tool descriptions provide clear usage guidance and examples
- [x] Error responses are structured and informative
- [x] Stdio transport handles all MCP protocol operations
- [x] SDK-native integration tests cover all tools and edge cases
- [x] Concurrent operation tests verify thread safety
- [x] Server starts and connects reliably with AI assistants

### Actual Implementation Notes ✅

- **16 MCP tools implemented** using correct MCP TypeScript SDK patterns
- **5 queue management tools**: create_queue, update_queue, delete_queue, list_queues, inspect_queue
- **9 task management tools**: add_task, update_task, checkout_task, complete_task, reset_task, fail_task, delete_task, list_tasks, inspect_task
- **2 status tools**: get_status (system/queue status), update_task_journal
- **Full Zod schema validation** for all tool parameters with rich descriptions
- **Structured JSON responses** with proper error handling and meaningful context
- **27 comprehensive integration tests** via real MCP protocol using InMemoryTransport pairs
- **Real SQLite databases** in all test scenarios - zero mocks maintaining TaskQ's testing philosophy
- **MCP-specific concurrency tests**: tool discovery, concurrent clients, error handling
- **Core library concurrency** already tested separately - no duplication
- **All 118 tests passing** across entire project (63 core + 27 CLI + 27 MCP + 1 database)
- **Correct McpServer.registerTool() API usage** (not legacy setRequestHandler)
- **StdioServerTransport** for AI assistant integration
- **Direct TaskStore integration** maintains data consistency
- **Proper import path resolution** for Yarn PnP compatibility
- **Better-sqlite3 rebuilt** for dev container architecture compatibility

### Migration to npm ✅

- **Yarn PnP to npm migration** completed for simplified distribution
- **Package structure optimized** for npm publishing and broader compatibility
- **All dependencies verified** working with standard npm resolution
- **Build process streamlined** for production deployment

---

## Phase 5: Web Interface (8-10 hours) - POSTPONED

**Status: Postponed** - Focusing on CLI and MCP server polishing first.

### Goals

- Complete web interface with server-side rendering
- Simple, robust architecture without complex client-side frameworks
- Polling-based updates for real-time feel
- Form-based interactions with minimal JavaScript

### Technical Architecture

**Server-Side Rendering Approach:**
- Express.js with Handlebars templating engine
- Server renders HTML pages with data pre-loaded from TaskStore
- Traditional form submissions for all data modifications
- Simple JavaScript polling for live updates (page refreshes)
- No REST API needed - direct TaskStore integration in route handlers

**Styling Strategy:**
- Vanilla CSS (no frameworks) for maximum control and minimal dependencies
- CSS Grid and Flexbox for responsive layout
- Clean, functional design focused on data readability
- Simple color scheme prioritizing functionality over aesthetics

**Testing Requirements:**
- All Cypress E2E tests MUST use `data-testid` attributes for element selection
- NO text-based selectors to ensure tests remain stable across UI copy changes
- Test ID format: `data-testid="functional-element-description"`
- Examples: `data-testid="create-queue-button"`, `data-testid="task-status-pending"`

### Deliverables

- Express.js server with Handlebars template rendering
- Server-side route handlers for all operations
- HTML templates with embedded data and semantic markup
- Vanilla CSS styling with responsive design
- Minimal JavaScript for polling updates and form enhancement
- Comprehensive Cypress E2E tests using data-testid selectors

### HTTP Endpoints

**Page Routes (GET - Server-Rendered HTML):**
- `GET /` - Dashboard with queue overview
- `GET /queue/:id` - Queue detail page with tasks

**Form Action Routes (POST - Form Submissions):**
- `POST /queue/create` - Create new queue
- `POST /queue/:id/update` - Update queue properties
- `POST /queue/:id/delete` - Delete queue
- `POST /task/create` - Create new task
- `POST /task/:id/update` - Update task properties
- `POST /task/:id/checkout` - Checkout task for work
- `POST /task/:id/complete` - Mark task complete
- `POST /task/:id/reset` - Reset task to pending
- `POST /task/:id/fail` - Mark task failed
- `POST /task/:id/delete` - Delete task

### Key Files

- `src/web-server/index.ts` - Web server entry point with Express setup
- `src/web-server/routes/` - Route handlers:
  - `pages.ts` - Page rendering routes (dashboard, queue details)
  - `forms.ts` - Form submission handlers for all operations
- `src/web-server/templates/` - Handlebars templates:
  - `layout.hbs` - Base layout template
  - `dashboard.hbs` - Queue overview page
  - `queue.hbs` - Queue detail page
- `src/web-server/public/` - Static assets:
  - `css/main.css` - Core styles and layout
  - `css/components.css` - Reusable UI components
  - `css/responsive.css` - Mobile and tablet breakpoints
  - `js/polling.js` - Simple polling for live updates
- `tests/web-server/` - Server tests:
  - `routes.test.ts` - Route handler integration tests
  - `rendering.test.ts` - Template rendering tests
- `cypress/e2e/web-interface.cy.ts` - End-to-end tests with data-testid selectors

### Builds On

- Phase 2: Core TaskStore library provides all functionality

### Enables

- Visual task queue management interface
- Non-technical user access to TaskQ functionality
- Browser-based monitoring and administration

### Completion Criteria

- [ ] Express server serves all page routes with correct data
- [ ] All form submissions work correctly and redirect appropriately
- [ ] Handlebars templates render data cleanly and semantically
- [ ] CSS provides clean, responsive design across devices
- [ ] JavaScript polling updates page content without full reload
- [ ] All HTML elements have appropriate data-testid attributes
- [ ] Cypress E2E tests cover all user workflows using data-testid selectors
- [ ] Integration tests use real database (no mocks)
- [ ] Error handling provides user-friendly feedback
- [ ] Server starts reliably and handles concurrent requests

---

## Phase 6: Documentation & Polish (6-8 hours)

### Goals

- Polish self-documenting interfaces (CLI and MCP tools)
- Rewrite README for clarity and agent comprehension
- Final testing and bug fixes
- Package preparation for distribution
- Performance optimization

### Deliverables

- Clear, concise README.md focused on what/when/how
- Self-documenting CLI with improved help output
- Self-documenting MCP server with clear tool descriptions
- Package.json optimization for distribution
- Performance testing and optimization

### Key Files

- `README.md` - Primary project documentation (what/when/how focus)
- `src/cli/index.ts` - CLI help system improvements
- `src/mcp-server/tools/` - MCP tool description enhancements
- `package.json` - Final package configuration

### Builds On

- Phase 1-4: Complete CLI, MCP server, and core functionality

### Enables

- Clear agent understanding of TaskQ capabilities
- Intuitive CLI usage without external documentation
- Self-explanatory MCP tools for AI assistants
- Public distribution via npm

### Completion Criteria

- [ ] README clearly explains what TaskQ does, when to use it, and how
- [ ] CLI help output is comprehensive and guides users effectively
- [ ] MCP tool descriptions are clear and actionable for AI agents
- [ ] All examples in documentation are tested and working
- [ ] Package is ready for npm publication
- [ ] Performance meets requirements (>10k tasks, <10ms ops)
- [ ] Self-documenting interfaces require no external documentation

---

## Phase Dependencies

```
Phase 1 (Foundation)
    ↓
Phase 2 (Core Library) ← Foundation for all interfaces
    ↓
┌─────────────────┬─────────────────┬─────────────────┐
│   Phase 3       │   Phase 4       │   Phase 5       │
│   (CLI)         │   (MCP Server)  │   (Web Backend) │
└─────────────────┴─────────────────┤                 │
                                    ↓                 │
                                Phase 6               │
                                (Web Frontend)        │
                                    ↓                 │
                                    └─────────────────┘
                                            ↓
                                        Phase 7
                                    (Documentation)
```

## Testing Philosophy

Each phase includes comprehensive testing:

- **Unit Tests**: Pure business logic and isolated functions
- **Integration Tests**: Full system tests with real database
- **E2E Tests**: Complete workflows (Cypress for web)
- **Concurrency Tests**: Multi-threaded operation safety
- **Performance Tests**: Load testing with large datasets

No mocks are used - all tests exercise the complete system to ensure real-world reliability.

## Success Metrics

Each phase is only complete when:

1. All functionality works as specified
2. All tests pass consistently
3. Code passes linting and formatting
4. Documentation is complete and accurate
5. Performance meets requirements
6. Error handling is robust and informative

This ensures each phase delivers production-ready, fully-tested functionality that builds a solid foundation for subsequent phases.
