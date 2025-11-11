# Supervisor Tools

This directory contains reusable tools for OpenAI Agents in the supervisor system.

## Available Tools

### perplexityResearch

Web research and information synthesis using Perplexity AI.

**Features:**
- Real-time web search with AI-powered synthesis
- Citation and source tracking
- Domain filtering for specialized searches
- Recency filtering for time-sensitive queries
- Support for multiple Perplexity models (sonar, sonar-pro)

**Use cases:**
- Research current events or recent information
- Find factual data from reliable sources
- Get comprehensive answers with citations
- Explore topics that require web search

## Installation & Setup

### 1. Install Perplexity SDK (optional)

The tool uses direct HTTP API calls, so SDK installation is optional:

```bash
npm install @perplexity-ai/sdk
```

### 2. Configure API Key

Add your Perplexity API key to `.env`:

```bash
PERPLEXITY_API_KEY=your_api_key_here
```

Get your API key from: https://www.perplexity.ai/settings/api

## Usage Examples

### Basic Integration

Add the tool to any agent:

```typescript
import { Agent } from '@openai/agents';
import { perplexityResearch } from '../tools';

export const myAgent = new Agent({
  name: 'MyResearchAgent',
  model: 'gpt-4o',
  instructions: 'You are a research assistant with web access',
  tools: [perplexityResearch],
});
```

### Usage in executorAgent

The tool is already integrated in `executorAgent`:

```typescript
import { executorAgent } from './agents/executor';

// The executorAgent now has web research capabilities
// It will automatically use perplexityResearch when needed
```

### Manual Tool Call Example

```typescript
import { perplexityResearch } from './tools';

// Execute a research query
const result = await perplexityResearch.execute({
  query: 'What are the latest features in Next.js 15?',
  model: 'sonar', // or 'sonar-pro' for deeper research
  searchRecency: 'month', // optional: 'month', 'week', 'day', 'hour'
  searchDomains: ['nextjs.org', 'github.com'], // optional domain filter
  maxTokens: 2000, // optional, default is 2000
}, {});

if (result.success) {
  console.log('Answer:', result.answer);
  console.log('Citations:', result.citations);
  console.log('Related Questions:', result.relatedQuestions);
} else {
  console.error('Error:', result.error);
}
```

### Integration in Other Agents

You can add the tool to any agent that needs research capabilities:

#### workflowOrchestratorAgent

```typescript
import { Agent } from '@openai/agents';
import { workflowOrchestratorInstructions } from '../prompts';
import { perplexityResearch } from '../tools';

export const workflowOrchestratorAgent = new Agent({
  name: 'WorkflowOrchestratorAgent',
  model: 'gpt-4o',
  instructions: workflowOrchestratorInstructions,
  tools: [perplexityResearch], // Add web research capability
});
```

#### Custom Realtime Agent

```typescript
import { RealtimeAgent } from '@openai/agents/realtime';
import { perplexityResearch } from '../api/supervisor/tools';

export const researchAssistant = new RealtimeAgent({
  name: 'ResearchAssistant',
  instructions: 'You help users research topics using web search',
  tools: [perplexityResearch],
});
```

## Tool Parameters

### Required Parameters

- **query** (string): The research query or question to search for

### Optional Parameters

- **model** (string): Perplexity model to use
  - `"sonar"` (default): Fast, cost-effective
  - `"sonar-pro"`: Advanced reasoning with deep research

- **searchRecency** (string): Filter results by recency
  - `"month"`: Last month
  - `"week"`: Last week
  - `"day"`: Last 24 hours
  - `"hour"`: Last hour

- **searchDomains** (string[]): Filter to specific domains
  - Example: `["github.com", "stackoverflow.com"]`

- **maxTokens** (number): Maximum tokens for response
  - Default: 2000
  - Increase for more detailed answers

## Response Format

```typescript
{
  success: boolean;
  answer?: string;              // Synthesized answer
  citations?: string[];         // Source URLs
  relatedQuestions?: string[]; // Follow-up questions
  metadata?: {
    model: string;             // Model used
    tokensUsed: number;        // Total tokens
    promptTokens: number;      // Input tokens
    completionTokens: number;  // Output tokens
  };
  error?: string;              // Error message if failed
}
```

## Example Agent Queries

When an agent has this tool, it can automatically answer queries like:

```
User: "What are the latest developments in AI agents?"
Agent: [Uses perplexityResearch to search and synthesize information]

User: "Find information about Next.js 15 new features"
Agent: [Searches with recency filter for up-to-date information]

User: "Search for TypeScript best practices on GitHub"
Agent: [Uses domain filter to search github.com specifically]
```

## Best Practices

1. **Be Specific**: Write clear, focused queries
   - Good: "Compare Next.js 14 vs Next.js 15 performance features"
   - Bad: "Tell me about Next.js"

2. **Use Recency Filters**: For time-sensitive information
   ```typescript
   query: "Latest AI model releases",
   searchRecency: "week"
   ```

3. **Domain Filtering**: For specialized searches
   ```typescript
   query: "React performance optimization",
   searchDomains: ["react.dev", "github.com"]
   ```

4. **Model Selection**:
   - Use `sonar` for quick facts and general queries
   - Use `sonar-pro` for complex research requiring deep analysis

5. **Error Handling**: Always check `success` before using results
   ```typescript
   const result = await perplexityResearch.execute({...});
   if (!result.success) {
     console.error('Research failed:', result.error);
     return;
   }
   ```

## Troubleshooting

### "PERPLEXITY_API_KEY is not configured"

- Add `PERPLEXITY_API_KEY` to your `.env` file
- Restart your development server after adding the key

### Rate Limits

Perplexity has rate limits depending on your plan:
- Free tier: Limited requests per day
- Standard tier: Higher limits
- Pro tier: Even higher limits

Check your usage at: https://www.perplexity.ai/settings/api

### Search Quality

If results are not relevant:
- Make queries more specific
- Use domain filters to narrow down sources
- Adjust recency filters for time-sensitive topics
- Try `sonar-pro` model for complex queries

## Cost Optimization

1. **Use `sonar` model** for most queries (cheaper)
2. **Reserve `sonar-pro`** for complex research
3. **Set appropriate `maxTokens`** (don't request more than needed)
4. **Cache results** for repeated queries (implement in your code)

## API Documentation

- Perplexity API: https://docs.perplexity.ai/guides/chat-completions-sdk
- TypeScript SDK: https://github.com/perplexityai/perplexity-node
- API Reference: https://docs.perplexity.ai/api-reference

## Contributing

To add new tools to this directory:

1. Create a new file: `tools/yourTool.ts`
2. Follow the pattern from `perplexityResearch.ts`
3. Export from `tools/index.ts`
4. Add documentation to this README
5. Add to relevant agents

## License

Follow the same license as the main project.
