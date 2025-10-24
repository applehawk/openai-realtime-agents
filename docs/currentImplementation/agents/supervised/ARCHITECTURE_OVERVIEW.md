# Supervised Agent Architecture Overview

Documentation for the multi-agent supervised architecture with hierarchical task execution.

**Version:** 3.0 (with Hierarchical Task System)
**Last Updated:** 2025-10-22

---

## Quick Links

### Core Documentation

- **[Supervisor Agent Planning](../../agents/realtime/prompts/README.md)** - plannedSteps vs workflowSteps
- **[WorkflowSteps Usage Guide](../../../src/app/api/supervisor/WORKFLOW_STEPS_USAGE.md)** - How to use workflowSteps and plannedSteps
- **[Hierarchical Task Execution](./HIERARCHICAL_TASKS.md)** - ⭐ NEW: Recursive task breakdown & execution

### API Documentation

- **[Supervisor Agent API](../../../src/app/api/supervisor/agent.ts)** - SupervisorAgent instructions and interface
- **[Task Management API](../../../src/app/api/tasks/route.ts)** - Endpoints for hierarchical task execution

---

## Architecture Layers

```
┌──────────────────────────────────────────────────────────────┐
│                  Layer 1: RealtimeAgent                       │
│  - Fast, voice-optimized (gpt-4o-realtime-mini)              │
│  - Handles simple tasks directly                              │
│  - Delegates complex tasks to supervisor                      │
│  - Delegates VERY complex tasks to hierarchical system        │
└────────────────────┬─────────────────────────────────────────┘
                     │
          ┌──────────┴──────────┐
          ▼                     ▼
┌──────────────────┐  ┌─────────────────────────────────────────┐
│  Layer 2:        │  │  Layer 2.5:                             │
│  SupervisorAgent │  │  Hierarchical Task System (NEW)         │
│                  │  │                                          │
│  - Smart (GPT-4o)│  │  - TaskOrchestrator                     │
│  - Multi-step    │  │  - Recursive breakdown                  │
│  - Planning mode │  │  - Dependency management                │
│  - Execution mode│  │  - Result collection                    │
└──────────────────┘  └─────────────────────────────────────────┘
          │                     │
          └──────────┬──────────┘
                     ▼
┌──────────────────────────────────────────────────────────────┐
│              Layer 3: Tools & Data Sources                    │
│  - MCP Tools (calendar, email)                               │
│  - LightRAG (knowledge retrieval)                            │
│  - External APIs                                              │
└──────────────────────────────────────────────────────────────┘
```

---

## Task Complexity Decision Tree

```
User Request
    │
    ▼
Is it 1 simple action?
    │
    ├─ YES → RealtimeAgent executes directly with MCP/RAG tools
    │
    └─ NO → Is it 2-4 steps, straightforward?
            │
            ├─ YES → delegateToSupervisor (EXECUTE IMMEDIATELY)
            │         └─ Returns workflowSteps (past tense)
            │
            └─ NO → Is it 5+ steps, complex, or affects many people?
                    │
                    ├─ YES (complex but manageable)
                    │    → delegateToSupervisor (PLAN FIRST)
                    │       └─ Returns plannedSteps (future tense)
                    │           └─ After confirmation: workflowSteps
                    │
                    └─ YES (VERY complex: 8+ steps)
                         → executeComplexTask (Hierarchical System)
                            └─ Recursive breakdown
                               └─ Execute subtasks
                                  └─ Collect results
                                     └─ Generate report
```

---

## Three Modes of Operation

### Mode 1: Direct Execution
**Handler:** RealtimeAgent + MCP tools
**When:** Single, simple action
**Example:** "Прочитай последнее письмо"

### Mode 2: Supervisor Delegation
**Handler:** SupervisorAgent
**Modes:** PLAN FIRST or EXECUTE IMMEDIATELY
**When:** 2-7 steps, moderate to high complexity
**Example:** "Прочитай письмо от Анны и создай встречу"

### Mode 3: Hierarchical Execution (NEW)
**Handler:** TaskOrchestrator + SupervisorAgent
**When:** 8+ steps, mass operations, multiple sources
**Example:** "Найди участников, проверь календари, найди время, отправь приглашения"

---

## Documentation

See [HIERARCHICAL_TASKS.md](./HIERARCHICAL_TASKS.md) for full documentation.

---

**Ready to use!** 🎉
