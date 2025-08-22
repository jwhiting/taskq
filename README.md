# TaskQ

**What:** A durable task queue system that enables reliable batch processing for coding agents and parallel workers. Provides CLI, MCP server, and Node.js interfaces backed by atomic SQLite operations.

**When to use:** When you have repetitive tasks where single-agent workflows become unreliable due to context window saturation, omission, or inconsistency. Typically when N > ~10-20 similar tasks.

**Key insight:** Agents drop off in reliability as task count increases, but TaskQ solves this by breaking work into atomic, tracked operations with guaranteed checkout semantics.

## Common Use Cases

- **Batch file processing:** Convert/analyze/index many files systematically
- **Large refactoring:** Update hundreds of test cases, deprecation fixes, pattern migrations  
- **Documentation builds:** Process many files into summaries, indexes, or cross-references

## Quick Start

```bash
# 1. Create queue with detailed instructions
taskq create-queue my-work "Complete instructions for workers..."

# 2. Populate systematically (CRITICAL: use script, not manual)
python3 -c "
import json, subprocess, glob
for file in glob.glob('src/**/*.js', recursive=True):
    task = json.dumps({'file': file})
    subprocess.run(['taskq', 'add-task', 'my-work', task])
"

# 3. Workers process atomically
taskq checkout-task my-work    # Gets task + instructions
# ... do the work ...
taskq complete-task my-work <task-id>

# 4. Monitor progress
taskq status my-work
```

## Critical Success Factor: Reliable Population

**The hard part isn't the work—it's populating ALL tasks reliably.** Agents miss items when manually adding tasks. Solution: **Always use a script** (Python recommended) to systematically find and add every task as JSON.

### Population Script Pattern

```python
import json, subprocess, glob, os

# Find all work items systematically
queue_name = "my-queue"
for item in glob.glob("pattern/**/*", recursive=True):
    # Define task as JSON with all needed data
    task_data = json.dumps({"file": item, "type": "process"})
    
    # Add to queue atomically
    result = subprocess.run(
        ["taskq", "add-task", queue_name, task_data],
        capture_output=True, text=True
    )
    
    if result.returncode == 0:
        print(f"✓ Added: {os.path.basename(item)}")
    else:
        print(f"✗ Failed: {item} - {result.stderr.strip()}")

# Check final status
subprocess.run(["taskq", "status", queue_name])
```

## Writing Effective Instructions

**Queue-level instructions** define the work that ALL tasks in the queue should follow. These should be complete and self-contained since workers may have no prior context:

- **WHAT:** Clear description of the task to perform
- **WHERE:** Full paths to input files/directories and output locations  
- **HOW:** Specific steps or methodology to follow
- **FORMAT:** Expected output format with examples
- **CONTEXT:** Any background information needed

**Example queue instructions:**
```
"You have been given a file path from /project/src. Read the file contents, 
identify all TODO comments, and append each one to /project/todos.md using 
the format '- **filename:line** — TODO text'. Preserve the original file 
unchanged. Look at existing entries in todos.md for formatting examples."
```

**Task-level instructions** (advanced): Individual tasks can optionally include additional instructions that supplement the queue instructions. These are shown alongside queue instructions at checkout time. Use sparingly for tasks that need specific variations.

## Interfaces

### CLI
Direct command-line usage for scripts and manual work:
```bash
taskq create-queue <name> <instructions>
taskq add-task <queue> <json-task-data>
taskq checkout-task <queue>
taskq complete-task <queue> <task-id>
taskq status <queue>
```

### MCP Server
AI assistant integration via Model Context Protocol:
```bash
# Start server for Claude Desktop or other MCP clients
node dist/mcp-server/index.js
```

### Node.js API  
Programmatic usage in applications:
```javascript
import { TaskStore } from 'taskq';

const store = new TaskStore();
await store.createQueue('my-queue', 'Instructions...');       // Create queue
await store.updateQueue('my-queue', { description: 'New...' }); // Update queue
await store.addTask('my-queue', { file: 'example.js' });      // Add task
const task = await store.checkoutTask('my-queue');            // Get next task
await store.completeTask('my-queue', task.id);               // Mark complete
await store.resetTask('my-queue', task.id);                  // Reset to pending
await store.failTask('my-queue', task.id);                   // Mark failed
await store.deleteTask('my-queue', task.id);                 // Delete task
await store.listTasks('my-queue');                           // List all tasks
await store.getStatus('my-queue');                           // Queue status
await store.deleteQueue('my-queue');                         // Delete queue
```

## Worker Agent Pattern

### Spawning Parallel Workers

Tell your coding agent to spawn multiple parallel worker sub-agents:

> "Spawn 5 TaskQ worker sub-agents to process the 'my-queue' queue in parallel. Each worker should follow the TaskQ worker pattern: checkout task, do the work, mark complete, repeat until queue empty."

### Individual Worker Workflow

Each worker agent should follow this pattern:

```
Worker Agent Loop:
1. Run: taskq checkout-task my-queue
2. If output is "All tasks completed!" → STOP and report completion
3. Parse the task JSON and instructions from checkout output
4. Do the work described in the instructions using the task data
5. Run: taskq complete-task my-queue <task-id>
6. Repeat from step 1

Example worker session:
> taskq checkout-task file-processing
{"id": "task_123", "data": {"file": "src/utils.js"}, "instructions": "Queue instructions: Read file and extract all function names... [Task instructions: This file may have TypeScript generics]"}

... agent does the work ...

> taskq complete-task file-processing task_123
Task marked as complete

> taskq checkout-task file-processing  
All tasks completed!

✓ Queue empty - worker stops
```

**CRITICAL for AI agents:** When `checkout-task` returns exactly `"All tasks completed!"`, your work is done. Do NOT continue checkout attempts. Report that all tasks are complete and stop the worker loop.

## Parallel Processing

Multiple workers can safely operate on the same queue simultaneously. Each checkout atomically assigns a unique task to prevent conflicts or duplicate work.

## Installation

```bash
npm install -g taskq
```

All interfaces share the same atomic SQLite backend, supporting concurrent workers without conflicts or data loss.