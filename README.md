# TaskQ

TaskQ is a durable, concurrency-safe tasks queue service for coding agents to
use for larger workloads when a simple agentic todo-list is insufficient or
unreliable, especially when tasks are high in number and largely repetitive. It
exposes all its features through four interfaces: a Node module, a CLI, an MCP
server, and a local web GUI, all sharing a concurrency-safe SQLite backend.

It's useful when a typical coding agent workflow will not reliably be able to
define, focus on, iteratively accomplish a set of N tasks where N is high
enough that omission occurs (e.g. only 70% of N gets done), or irregularity or
failure occurs (e.g. 30% of N is done incorrectly) because of context window
saturation and compaction.

Example uses:

- Batch processing of text files, images, or other assets, ie. for every file
  in location X do work Y and put the results in Z. For example:
  - Documentation index building: summarize each file in a folder and append
    the summary out to an index or documentation file, when there may be
    hundreds of files in the folder.
  - Text conversion from a folder of screenshots
- Refactoring projects with many instances of a pattern that must be carefully
  updated. For example:
  - Upgrading a test suite to a new assertion library, where there may be
    hundreds or thousands of tests and each test is complex and important
    enough to warrant focus by its own agentic workflow and context window.
  - Refactoring a web frontend to stop using color-specific classnames (e.g.
    "text-red") and instead use semantic selectors ("text-error").
  - Fixing all instances of many deprecation warnings after a core platform
    library upgrade.

In all these cases, giving instructions to a typical coding agent like "for all
X, do Y" is often unreliable unless it has a single metric it can run to find
out if it's done. The deprecation warning example above is one where that
single metric might be available - a build process that rejects deprecation
warnings would work because the agent can keep going until the build passes.
However, many times we do not have a simple test like that, for example when
refactoring in ways that don't fix/break the build. Then a coding agent will
not comprehensively and reliably find all scenarios, may not do the work
consistently per task, and context window fills up quickly which degrades
quality.

TaskQ is quite easy to use, except the "hard part" is populating tasks into
queues accurately, for which it's recommended to ask the LLM to write a script
to do so reliably, with that script using the Node moduler or CLI to add the
tasks. The whole reason for TaskQ is that single-loop LLM-agents, even with
capacity for sub-agents like Claude Code, drop off in reliability as the number
of instances of a task increase. And populating the queue itself is one such
repetitive task that requires reliability we lack in that tool.


