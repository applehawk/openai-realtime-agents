# Supervisor Agents Architecture v3.0

**Date:** October 24, 2025  
**Version:** 3.0 - Modular Structure

## 📁 Directory Structure

```
src/app/api/supervisor/
├── types.ts                    # Shared TypeScript types
├── agent.ts                    # DEPRECATED - Re-exports for backward compatibility
│
├── prompts/                    # Agent instructions (prompts)
│   ├── index.ts               # Central export point
│   ├── decision.ts            # DecisionAgent instructions
│   ├── executor.ts            # ExecutorAgent instructions
│   ├── complexityAssessor.ts  # ComplexityAssessorAgent instructions
│   ├── delegationReviewer.ts  # DelegationReviewerAgent instructions
│   ├── taskPlanner.ts         # TaskPlannerAgent instructions
│   ├── workflowOrchestrator.ts # WorkflowOrchestratorAgent instructions
│   └── reportGenerator.ts     # ReportGeneratorAgent instructions
│
├── agents/                     # Agent instances
│   ├── index.ts               # Central export point
│   ├── decision.ts            # DecisionAgent (gpt-4o)
│   ├── executor.ts            # ExecutorAgent (gpt-4o)
│   ├── complexityAssessor.ts  # ComplexityAssessorAgent (gpt-4o-mini)
│   ├── delegationReviewer.ts  # DelegationReviewerAgent (gpt-4o-mini)
│   ├── taskPlanner.ts         # TaskPlannerAgent (gpt-4o)
│   ├── workflowOrchestrator.ts # WorkflowOrchestratorAgent (gpt-4o)
│   └── reportGenerator.ts     # ReportGeneratorAgent (gpt-4o)
│
├── unified/
│   ├── intelligentSupervisor.ts # Main orchestration logic
│   ├── progressEmitter.ts     # SSE progress tracking
│   └── route.ts               # API route handler
│
├── taskOrchestrator.ts        # Hierarchical task execution
└── taskTypes.ts               # Task-related types
```

---

## 🎯 Design Philosophy

### Separation of Concerns

The new structure separates:
1. **Types** (`types.ts`) - Shared data structures
2. **Prompts** (`prompts/`) - Agent instructions (pure text)
3. **Agents** (`agents/`) - Agent instances with model configs
4. **Logic** (`unified/`, `taskOrchestrator.ts`) - Orchestration

### Benefits

✅ **Maintainability**: Each agent and prompt in its own file  
✅ **Reusability**: Prompts can be tested independently  
✅ **Clarity**: Clear separation between configuration and logic  
✅ **Scalability**: Easy to add new agents  
✅ **Version Control**: Smaller diffs, easier reviews  

---

## 📚 Agent Catalog

### 1. DecisionAgent (`decision.ts`)
**Model:** gpt-4o  
**Purpose:** Decides if task needs breakdown  
**Tools:** None (pure reasoning)

**When to use:**
- Before executing any task
- To minimize expensive decomposition

**Key principle:** Say "NO" to breakdown most of the time!

---

### 2. ExecutorAgent (`executor.ts`)
**Model:** gpt-4o  
**Purpose:** Executes tasks directly or aggregates results  
**Tools:** Calendar MCP (email, calendar operations)

**When to use:**
- When task doesn't need breakdown
- To aggregate subtask results

**Modes:**
- Direct execution (no subtasks)
- Aggregation (after subtasks completed)

---

### 3. ComplexityAssessorAgent (`complexityAssessor.ts`)
**Model:** gpt-4o-mini ⚡ (94% cost savings)  
**Purpose:** Assesses task complexity  
**Tools:** None (classification only)

**Output:** `simple` | `medium` | `complex`

**Why mini?**
- Simple classification task
- High volume (called for EVERY task)
- Clear criteria
- Fast response needed

---

### 4. DelegationReviewerAgent (`delegationReviewer.ts`)
**Model:** gpt-4o-mini ⚡ (94% cost savings)  
**Purpose:** Decides delegation back vs handle personally  
**Tools:** None (decision-making only)

**Output:** `delegateBack` | `handlePersonally`

**Why mini?**
- Binary decision
- Clear criteria
- High volume
- Cost efficiency

---

### 5. TaskPlannerAgent (`taskPlanner.ts`)
**Model:** gpt-4o  
**Purpose:** Generates execution plans (PLAN FIRST mode)  
**Tools:** None (planning only)

**When to use:**
- Complex tasks (5+ steps)
- Irreversible actions
- User confirmation needed

**Why gpt-4o?**
- Quality critical (user sees plans)
- Creative planning needed
- Complex reasoning required

---

### 6. WorkflowOrchestratorAgent (`workflowOrchestrator.ts`)
**Model:** gpt-4o  
**Purpose:** Orchestrates multi-step workflows  
**Tools:** Calendar MCP (email, calendar operations)

**Handles:**
- Sequential workflows
- Conditional logic
- Data synthesis
- Error recovery

**Why gpt-4o?**
- Complex multi-tool coordination
- Conditional logic handling
- Quality critical (actual execution)

---

### 7. ReportGeneratorAgent (`reportGenerator.ts`)
**Model:** gpt-4o  
**Purpose:** Generates comprehensive final reports  
**Tools:** None (synthesis only)

**When to use:**
- After hierarchical execution
- Multiple subtasks completed
- Comprehensive summary needed

**Why gpt-4o?**
- Quality critical (final output)
- Complex synthesis
- User-facing content

---

## 🔄 Import Guidelines

### ✅ Recommended (New Structure)

```typescript
// Import agents
import { 
  decisionAgent,
  executorAgent,
  complexityAssessorAgent 
} from './agents';

// Import prompts (for testing/customization)
import {
  decisionAgentInstructions,
  executorAgentInstructions
} from './prompts';

// Import types
import {
  SupervisorDecision,
  SupervisorRequest,
  SupervisorResponse
} from './types';
```

### ⚠️ Deprecated (Old Structure)

```typescript
// Still works but discouraged
import {
  decisionAgent,
  executorAgent,
  decisionAgentInstructions
} from './agent';
```

---

## 💰 Cost Optimization

### Model Selection

| Agent | Model | Rationale |
|-------|-------|-----------|
| **DecisionAgent** | gpt-4o | Critical decisions, low volume |
| **ExecutorAgent** | gpt-4o | Tool coordination + complexity |
| **ComplexityAssessor** | **gpt-4o-mini** | Simple classification, high volume |
| **DelegationReviewer** | **gpt-4o-mini** | Binary decision, high volume |
| **TaskPlanner** | gpt-4o | Quality critical, user-facing |
| **WorkflowOrchestrator** | gpt-4o | Complex orchestration + tools |
| **ReportGenerator** | gpt-4o | Quality critical, synthesis |

### Cost Savings

**Using gpt-4o-mini for 2 agents:**
- ComplexityAssessor: $240/year savings
- DelegationReviewer: $240/year savings (if integrated)
- **Total: $480/year potential savings**

Combined with v3.0 specialization: **$6,720/year total**

---

## 🧪 Testing

### Testing Prompts Independently

```typescript
import { decisionAgentInstructions } from './prompts';

// Test prompt with mock data
const testPrompt = `
Task: "Прочитай письмо от Анны"
Context: {...}
`;

const fullPrompt = decisionAgentInstructions + '\n\n' + testPrompt;
// Test with LLM...
```

### Testing Agents

```typescript
import { decisionAgent } from './agents';
import { run } from '@openai/agents';

// Test agent
const result = await run(decisionAgent, 'Your test prompt here');
```

---

## 📝 Adding New Agents

### Step 1: Create Prompt

`prompts/myNewAgent.ts`:
```typescript
export const myNewAgentInstructions = `
# Role
You are...

# Instructions
...
`;
```

### Step 2: Export Prompt

`prompts/index.ts`:
```typescript
export { myNewAgentInstructions } from './myNewAgent';
```

### Step 3: Create Agent

`agents/myNewAgent.ts`:
```typescript
import { Agent } from '@openai/agents';
import { myNewAgentInstructions } from '../prompts';

export const myNewAgent = new Agent({
  name: 'MyNewAgent',
  model: 'gpt-4o', // or 'gpt-4o-mini'
  instructions: myNewAgentInstructions,
  tools: [],
});
```

### Step 4: Export Agent

`agents/index.ts`:
```typescript
export { myNewAgent } from './myNewAgent';
```

### Step 5: Use in Logic

`unified/intelligentSupervisor.ts`:
```typescript
import { myNewAgent } from '../agents';

// Use in your logic
const result = await run(myNewAgent, prompt);
```

---

## 🔍 Debugging

### Enable Agent Logging

Each agent file includes `console.log()` on initialization:

```bash
[decisionAgent] Agent initialized: { name: 'DecisionAgent', ... }
[executorAgent] Agent initialized: { name: 'ExecutorAgent', ... }
[complexityAssessorAgent] Agent initialized (gpt-4o-mini for cost savings)
...
```

### Check Imports

```typescript
import * as agents from './agents';
import * as prompts from './prompts';

console.log('Available agents:', Object.keys(agents));
console.log('Available prompts:', Object.keys(prompts));
```

---

## 🚀 Migration Guide

### From Old Structure

**Before (v2.0):**
```typescript
import { supervisorAgent, decisionAgent } from './agent';
```

**After (v3.0):**
```typescript
import { decisionAgent, executorAgent } from './agents';
import { complexityAssessorAgent } from './agents';
```

### Backward Compatibility

The old `agent.ts` file re-exports everything for backward compatibility:

```typescript
// Still works
import { decisionAgent } from './agent';

// But recommended
import { decisionAgent } from './agents';
```

---

## 📊 Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                   IntelligentSupervisor                      │
│                  (Orchestration Layer)                       │
└─────────────────────┬───────────────────────────────────────┘
                      │
           ┌──────────┴──────────┐
           │                     │
    ┌──────▼──────┐      ┌──────▼──────┐
    │   Prompts   │      │   Agents    │
    │   (Text)    │─────▶│ (Instances) │
    └─────────────┘      └──────┬──────┘
                                 │
                    ┌────────────┼────────────┐
                    │            │            │
            ┌───────▼───┐  ┌─────▼────┐  ┌───▼──────┐
            │ Decision  │  │ Executor │  │Complexity│
            │  Agent    │  │  Agent   │  │ Assessor │
            │ (gpt-4o)  │  │(gpt-4o)  │  │  (mini)  │
            └───────────┘  └──────────┘  └──────────┘
                    │            │            │
                    └────────────┼────────────┘
                                 │
                         ┌───────▼────────┐
                         │  MCP Tools     │
                         │  Calendar/RAG  │
                         └────────────────┘
```

---

## 📖 Documentation

- **Agent Details**: See individual files in `agents/` folder
- **Prompt Engineering**: See individual files in `prompts/` folder
- **Integration Guide**: `docs/changeReports/AGENT_INTEGRATION_V3_COMPLETED.md`
- **Cost Analysis**: `docs/changeReports/MODEL_OPTIMIZATION_COMPLETED.md`
- **Token Savings**: `docs/changeReports/AGENT_DECOMPOSITION_TOKEN_ANALYSIS.md`

---

## ✅ Checklist for Contributors

When modifying agents:
- [ ] Update prompt file in `prompts/`
- [ ] Update agent configuration in `agents/` (if model/tools change)
- [ ] Update exports in `index.ts` files
- [ ] Run linter: `npm run lint`
- [ ] Test imports: `import { agent } from './agents'`
- [ ] Update this README if adding new agent
- [ ] Document changes in `docs/changeReports/`

---

## 🎯 Summary

The new modular structure provides:
- ✅ Clear separation of concerns
- ✅ Easy maintenance and testing
- ✅ Optimal model selection (cost efficiency)
- ✅ Backward compatibility
- ✅ Scalability for future agents

**Total Cost Savings: $6,720/year**  
**Token Reduction: 62%**  
**Accuracy Improvement: +10%**

---

**Questions?** See `docs/changeReports/V3_OPTIMIZATION_SUMMARY.md`

