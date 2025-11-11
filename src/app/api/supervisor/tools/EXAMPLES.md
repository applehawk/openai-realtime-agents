# Perplexity Research Tool - Quick Examples

## Setup

```bash
# 1. Add API key to .env
echo "PERPLEXITY_API_KEY=your_key_here" >> .env

# 2. Tool is already integrated in executorAgent
# No additional setup needed!
```

## Example 1: Basic Integration in Any Agent

```typescript
import { Agent } from '@openai/agents';
import { perplexityResearch } from '../tools';

export const myAgent = new Agent({
  name: 'MyAgent',
  model: 'gpt-4o',
  instructions: 'You are a helpful assistant with web research capabilities',
  tools: [perplexityResearch],
});
```

## Example 2: Add to WorkflowOrchestrator

```typescript
// File: src/app/api/supervisor/agents/workflowOrchestrator.ts
import { Agent } from '@openai/agents';
import { workflowOrchestratorInstructions } from '../prompts';
import { perplexityResearch } from '../tools';

export const workflowOrchestratorAgent = new Agent({
  name: 'WorkflowOrchestratorAgent',
  model: 'gpt-4o',
  instructions: workflowOrchestratorInstructions,
  tools: [perplexityResearch],
});
```

## Example 3: Add to Realtime Voice Agent

```typescript
// File: src/app/agentConfigs/myVoiceAgent.ts
import { RealtimeAgent } from '@openai/agents/realtime';
import { perplexityResearch } from '../api/supervisor/tools';

export const voiceResearchAgent = new RealtimeAgent({
  name: 'VoiceResearchAgent',
  instructions: `You are a voice assistant with web research capabilities.
When users ask about current events or information you don't know, use perplexityResearch tool.`,
  tools: [perplexityResearch],
});
```

## Example 4: Manual Tool Usage

```typescript
import { perplexityResearch } from './tools';

async function research() {
  // Simple query
  const result1 = await perplexityResearch.execute({
    query: 'Latest features in Next.js 15',
  }, {});

  // With advanced options
  const result2 = await perplexityResearch.execute({
    query: 'React Server Components best practices',
    model: 'sonar-pro', // Use advanced model
    searchRecency: 'month', // Only recent results
    searchDomains: ['react.dev', 'nextjs.org'], // Specific domains
    maxTokens: 3000, // Longer response
  }, {});

  if (result2.success) {
    console.log('Answer:', result2.answer);
    console.log('Sources:', result2.citations);
    console.log('Related:', result2.relatedQuestions);
  }
}
```

## Example 5: Integration with severstalAssistantAgent

```typescript
// File: src/app/agentConfigs/severstalAssistantAgent/index.ts
import { RealtimeAgent } from '@openai/agents/realtime';
import { perplexityResearch } from '../../api/supervisor/tools';
import { intelligentSupervisorTool } from './tools/intelligentSupervisorTool';

export const routerAgent = new RealtimeAgent({
  name: 'SeverstalAssistant',
  instructions: `You are an AI assistant with access to:
1. Complex task execution via intelligentSupervisorTool
2. Web research via perplexityResearch

When user asks about current information or topics you're uncertain about, use perplexityResearch.`,
  tools: [
    intelligentSupervisorTool,
    perplexityResearch, // Add web research
  ],
});
```

## Example 6: Combining with Other Tools

```typescript
import { Agent } from '@openai/agents';
import { perplexityResearch } from '../tools';
import { tool } from '@openai/agents';

// Custom tool
const saveToDatabase = tool({
  name: 'saveToDatabase',
  description: 'Save research results to database',
  parameters: {
    type: 'object',
    properties: {
      content: { type: 'string' },
    },
    required: ['content'],
  },
  execute: async (input) => {
    // Save logic here
    return { success: true };
  },
});

export const researchAndSaveAgent = new Agent({
  name: 'ResearchAndSave',
  model: 'gpt-4o',
  instructions: 'Research topics and save results',
  tools: [
    perplexityResearch,
    saveToDatabase,
  ],
});
```

## Example 7: Error Handling

```typescript
async function safeResearch(query: string) {
  try {
    const result = await perplexityResearch.execute({ query }, {});

    if (!result.success) {
      console.error('Research failed:', result.error);

      // Handle specific errors
      if (result.error?.includes('API_KEY')) {
        return 'Please configure PERPLEXITY_API_KEY';
      }

      if (result.error?.includes('rate limit')) {
        return 'Rate limit reached, please try again later';
      }

      return 'Research failed, please try again';
    }

    return result.answer;
  } catch (error) {
    console.error('Unexpected error:', error);
    return 'An unexpected error occurred';
  }
}
```

## Example 8: TypeScript Type Safety

```typescript
import { perplexityResearch, type PerplexityResearchResult } from './tools';

async function typedResearch(query: string): Promise<string> {
  const result: PerplexityResearchResult = await perplexityResearch.execute({
    query,
    model: 'sonar',
  }, {});

  if (result.success && result.answer) {
    return result.answer;
  }

  throw new Error(result.error || 'Unknown error');
}
```

## Common Query Patterns

### Technology Research
```typescript
query: "Compare TypeScript 5.3 vs 5.4 new features"
model: "sonar"
searchRecency: "month"
searchDomains: ["typescriptlang.org", "github.com"]
```

### Current Events
```typescript
query: "Latest developments in AI agents"
model: "sonar-pro"
searchRecency: "week"
```

### Documentation Lookup
```typescript
query: "How to use React Server Components in Next.js 15"
searchDomains: ["nextjs.org", "react.dev"]
```

### Troubleshooting
```typescript
query: "Fix TypeError: Cannot read property of undefined in TypeScript"
searchDomains: ["stackoverflow.com", "github.com"]
```

### Market Research
```typescript
query: "AI startup funding trends 2024"
model: "sonar-pro"
searchRecency: "month"
maxTokens: 3000
```

## Pro Tips

1. **Specific Queries Get Better Results**
   - ❌ "Tell me about AI"
   - ✅ "What are the key differences between GPT-4 and Claude 3?"

2. **Use Recency for Time-Sensitive Info**
   - Latest news: `searchRecency: "day"`
   - Recent updates: `searchRecency: "week"`
   - Current trends: `searchRecency: "month"`

3. **Domain Filtering for Quality**
   - Official docs: `["react.dev", "nextjs.org"]`
   - Technical: `["github.com", "stackoverflow.com"]`
   - Research: `["arxiv.org", "scholar.google.com"]`

4. **Model Selection Strategy**
   - Simple facts → `sonar` (faster, cheaper)
   - Complex analysis → `sonar-pro` (deeper, more accurate)

5. **Parse Citations for Sources**
   ```typescript
   if (result.success && result.citations) {
     console.log('Sources used:');
     result.citations.forEach(url => console.log(`- ${url}`));
   }
   ```

## Testing

```typescript
// Quick test
async function test() {
  const result = await perplexityResearch.execute({
    query: 'What is Next.js?',
  }, {});

  console.log('Success:', result.success);
  console.log('Answer:', result.answer?.substring(0, 100));
  console.log('Tokens:', result.metadata?.tokensUsed);
}
```

## Debugging

Enable console logs to see execution details:

```typescript
// Tool automatically logs:
// - Query being executed
// - Model and filters used
// - Tokens consumed
// - Citations count

// Check console output for:
// [perplexityResearch] Executing search: ...
// [perplexityResearch] Search completed: ...
```

## Next Steps

1. Add your API key to `.env`
2. Start using in `executorAgent` (already configured)
3. Add to other agents as needed
4. Monitor usage and costs at https://www.perplexity.ai/settings/api

For detailed documentation, see [README.md](./README.md)
