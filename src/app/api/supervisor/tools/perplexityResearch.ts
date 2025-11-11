/**
 * Perplexity Research Tool
 *
 * Enables AI agents to search and synthesize information from the web using Perplexity AI.
 * Uses OpenAI SDK configured to point at Perplexity's Sonar API endpoint.
 *
 * Based on: https://docs.perplexity.ai/cookbook/articles/openai-agents-integration/README
 *
 * Version: 2.0
 * Date: 2025-11-11
 */

import { tool } from '@openai/agents';
import OpenAI from 'openai';

// Perplexity API configuration
const PERPLEXITY_API_KEY = process.env.PERPLEXITY_API_KEY;
const PERPLEXITY_BASE_URL = process.env.PERPLEXITY_BASE_URL || 'https://api.perplexity.ai';

/**
 * Initialize OpenAI client configured for Perplexity
 */
let perplexityClient: OpenAI | null = null;

function getPerplexityClient(): OpenAI {
  if (!PERPLEXITY_API_KEY) {
    throw new Error('PERPLEXITY_API_KEY is not configured in environment variables');
  }

  if (!perplexityClient) {
    perplexityClient = new OpenAI({
      apiKey: PERPLEXITY_API_KEY,
      baseURL: PERPLEXITY_BASE_URL,
    });
  }

  return perplexityClient;
}

/**
 * Available Perplexity models
 * - sonar: Fast, cost-effective online model
 * - sonar-pro: Advanced reasoning with deep research (default)
 * - sonar-reasoning-pro: Deep reasoning tasks
 */
type PerplexityModel = 'sonar' | 'sonar-pro' | 'sonar-reasoning-pro';

/**
 * Execute Perplexity search using OpenAI SDK
 */
async function executePerplexitySearch(
  query: string,
  model: PerplexityModel = 'sonar-pro',
  systemPrompt: string = 'You are a helpful research assistant. Provide accurate, well-sourced information.'
) {
  const client = getPerplexityClient();

  console.log('[perplexityResearch] Executing search:', {
    query: query.substring(0, 100) + (query.length > 100 ? '...' : ''),
    model,
  });

  try {
    const response = await client.chat.completions.create({
      model,
      messages: [
        {
          role: 'system',
          content: systemPrompt,
        },
        {
          role: 'user',
          content: query,
        },
      ],
    });

    const answer = response.choices[0]?.message?.content || 'No answer received';
    const usage = response.usage;

    console.log('[perplexityResearch] Search completed:', {
      tokensUsed: usage?.total_tokens || 0,
      model: response.model,
    });

    return {
      success: true,
      answer,
      metadata: {
        model: response.model,
        tokensUsed: usage?.total_tokens || 0,
        promptTokens: usage?.prompt_tokens || 0,
        completionTokens: usage?.completion_tokens || 0,
      },
    };
  } catch (error) {
    console.error('[perplexityResearch] Search failed:', error);
    throw error;
  }
}

/**
 * Perplexity Research Tool Definition
 *
 * Simple, reusable tool for web research using Perplexity AI.
 */
export const perplexityResearch = tool({
  name: 'perplexityResearch',
  description: `Search and synthesize information from the web using Perplexity AI.

This tool provides real-time access to web information with AI-powered synthesis.

Use it when you need to:
- Research current events or recent information
- Find factual data from reliable sources
- Get comprehensive answers about topics you're uncertain about
- Look up technical documentation or API details
- Verify or expand your knowledge on a subject

The tool returns synthesized answers with web context.

Best practices:
- Be specific and clear in your query
- Use natural language questions
- For technical topics, include relevant context

Example queries:
- "What are the latest features in Next.js 15?"
- "Explain React Server Components"
- "How to handle errors in TypeScript async functions"
- "Current trends in AI agent development"`,

  parameters: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'The research query or question. Be specific and use natural language.',
      },
    },
    required: ['query'],
    additionalProperties: false,
  },

  execute: async (input: unknown, _details?: unknown) => {
    // Type guard and validation
    if (!input || typeof input !== 'object' || !('query' in input) || typeof input.query !== 'string') {
      return {
        success: false,
        error: 'Invalid input: query is required and must be a string',
      };
    }

    const { query, model, systemPrompt } = input as {
      query: string;
      model?: PerplexityModel;
      systemPrompt?: string;
    };

    // Validate query
    if (query.trim().length === 0) {
      return {
        success: false,
        error: 'Query cannot be empty',
      };
    }

    if (query.length > 4000) {
      return {
        success: false,
        error: 'Query is too long (max 4000 characters)',
      };
    }

    try {
      const result = await executePerplexitySearch(
        query,
        model || 'sonar-pro',
        systemPrompt
      );

      return result;
    } catch (error) {
      console.error('[perplexityResearch] Execution error:', error);

      // Handle specific error types
      if (error instanceof Error) {
        if (error.message.includes('API_KEY')) {
          return {
            success: false,
            error: 'Perplexity API key is not configured. Please add PERPLEXITY_API_KEY to your environment variables.',
          };
        }

        if (error.message.includes('rate limit')) {
          return {
            success: false,
            error: 'Perplexity API rate limit reached. Please try again later.',
          };
        }

        return {
          success: false,
          error: `Research failed: ${error.message}`,
        };
      }

      return {
        success: false,
        error: 'Unknown error occurred during research',
      };
    }
  },
});

/**
 * Export type for tool response
 */
export type PerplexityResearchResult = {
  success: boolean;
  answer?: string;
  metadata?: {
    model: string;
    tokensUsed: number;
    promptTokens: number;
    completionTokens: number;
  };
  error?: string;
};
