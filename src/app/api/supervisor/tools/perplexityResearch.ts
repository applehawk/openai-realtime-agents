/**
 * Perplexity Research Tool
 *
 * Enables AI agents to search and synthesize information from the web using Perplexity AI.
 * This tool provides real-time web research capabilities with intelligent source synthesis.
 *
 * Features:
 * - Web search with AI-powered synthesis
 * - Support for citations and sources
 * - Configurable search domains
 * - Multiple model options (sonar, sonar-pro)
 *
 * Version: 1.0
 * Date: 2025-11-11
 *
 * Documentation:
 * - Perplexity API: https://docs.perplexity.ai/guides/chat-completions-sdk
 * - TypeScript SDK: https://github.com/perplexityai/perplexity-node
 */

import { tool } from '@openai/agents';

// Perplexity API configuration
const PERPLEXITY_API_KEY = process.env.PERPLEXITY_API_KEY;
const PERPLEXITY_API_URL = 'https://api.perplexity.ai/chat/completions';

/**
 * Available Perplexity models
 * - sonar: Fast, cost-effective online model
 * - sonar-pro: Advanced reasoning with deep research
 */
type PerplexityModel = 'sonar' | 'sonar-pro';

/**
 * Perplexity API request payload
 */
interface PerplexityRequest {
  model: string;
  messages: Array<{
    role: 'system' | 'user' | 'assistant';
    content: string;
  }>;
  max_tokens?: number;
  temperature?: number;
  top_p?: number;
  return_citations?: boolean;
  return_images?: boolean;
  return_related_questions?: boolean;
  search_domain_filter?: string[];
  search_recency_filter?: 'month' | 'week' | 'day' | 'hour';
  stream?: boolean;
}

/**
 * Perplexity API response structure
 */
interface PerplexityResponse {
  id: string;
  model: string;
  object: string;
  created: number;
  choices: Array<{
    index: number;
    finish_reason: string;
    message: {
      role: string;
      content: string;
    };
    delta: {
      role: string;
      content: string;
    };
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  citations?: string[];
  images?: string[];
  related_questions?: string[];
}

/**
 * Execute Perplexity search request
 */
async function executePerplexitySearch(
  query: string,
  options: {
    model?: PerplexityModel;
    systemPrompt?: string;
    maxTokens?: number;
    returnCitations?: boolean;
    returnRelatedQuestions?: boolean;
    searchDomainFilter?: string[];
    searchRecencyFilter?: 'month' | 'week' | 'day' | 'hour';
  } = {}
): Promise<PerplexityResponse> {
  if (!PERPLEXITY_API_KEY) {
    throw new Error('PERPLEXITY_API_KEY is not configured in environment variables');
  }

  const {
    model = 'sonar',
    systemPrompt = 'You are a helpful research assistant. Provide accurate, well-sourced information.',
    maxTokens = 2000,
    returnCitations = true,
    returnRelatedQuestions = true,
    searchDomainFilter,
    searchRecencyFilter,
  } = options;

  const payload: PerplexityRequest = {
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
    max_tokens: maxTokens,
    temperature: 0.2, // Lower temperature for more focused research
    top_p: 0.9,
    return_citations: returnCitations,
    return_images: false, // Images not typically needed for text research
    return_related_questions: returnRelatedQuestions,
    stream: false,
  };

  // Add optional filters
  if (searchDomainFilter && searchDomainFilter.length > 0) {
    payload.search_domain_filter = searchDomainFilter;
  }

  if (searchRecencyFilter) {
    payload.search_recency_filter = searchRecencyFilter;
  }

  console.log('[perplexityResearch] Executing search:', {
    query: query.substring(0, 100) + '...',
    model,
    filters: {
      domains: searchDomainFilter?.length || 0,
      recency: searchRecencyFilter,
    },
  });

  try {
    const response = await fetch(PERPLEXITY_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${PERPLEXITY_API_KEY}`,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Perplexity API error (${response.status}): ${errorText}`);
    }

    const data: PerplexityResponse = await response.json();

    console.log('[perplexityResearch] Search completed:', {
      tokensUsed: data.usage?.total_tokens || 0,
      citationsCount: data.citations?.length || 0,
      relatedQuestionsCount: data.related_questions?.length || 0,
    });

    return data;
  } catch (error) {
    console.error('[perplexityResearch] Search failed:', error);
    throw error;
  }
}

/**
 * Perplexity Research Tool Definition
 *
 * This tool can be added to any agent that needs web research capabilities.
 */
export const perplexityResearch = tool({
  name: 'perplexityResearch',
  description: `Search and synthesize information from the web using Perplexity AI.

This tool provides real-time access to web information with AI-powered synthesis.
Use it when you need to:
- Research current events or recent information
- Find factual data from reliable sources
- Get comprehensive answers with citations
- Explore topics that require web search

The tool returns:
- Synthesized answer from multiple sources
- Citations and source URLs
- Related questions for further research

Best practices:
- Be specific in your query
- Use natural language questions
- Specify recency if time-sensitive (e.g., "last week")
- Use domain filters for specialized searches

Example queries:
- "What are the latest developments in AI agents?"
- "Compare Next.js 14 vs Next.js 15 features"
- "Best practices for TypeScript error handling"`,

  parameters: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'The research query or question to search for. Be specific and use natural language.',
      },
      model: {
        type: 'string',
        enum: ['sonar', 'sonar-pro'],
        description: 'Perplexity model to use. "sonar" is fast and cost-effective, "sonar-pro" provides deeper research. Default: sonar',
      },
      searchRecency: {
        type: 'string',
        enum: ['month', 'week', 'day', 'hour'],
        description: 'Filter results by recency. Use for time-sensitive queries. Optional.',
      },
      searchDomains: {
        type: 'array',
        items: {
          type: 'string',
        },
        description: 'Filter results to specific domains (e.g., ["github.com", "stackoverflow.com"]). Optional.',
      },
      maxTokens: {
        type: 'number',
        description: 'Maximum tokens for response. Default: 2000. Increase for more detailed answers.',
      },
    },
    required: ['query'],
    additionalProperties: false,
  },

  execute: async (input, details) => {
    // Type guard and validation
    if (!input || typeof input !== 'object' || !('query' in input) || typeof input.query !== 'string') {
      return {
        success: false,
        error: 'Invalid input: query is required and must be a string',
      };
    }

    const { query, model, searchRecency, searchDomains, maxTokens } = input as {
      query: string;
      model?: PerplexityModel;
      searchRecency?: 'month' | 'week' | 'day' | 'hour';
      searchDomains?: string[];
      maxTokens?: number;
    };

    // Validate query length
    if (query.trim().length === 0) {
      return {
        success: false,
        error: 'Query cannot be empty',
      };
    }

    if (query.length > 2000) {
      return {
        success: false,
        error: 'Query is too long (max 2000 characters)',
      };
    }

    try {
      const result = await executePerplexitySearch(query, {
        model,
        maxTokens,
        returnCitations: true,
        returnRelatedQuestions: true,
        searchDomainFilter: searchDomains,
        searchRecencyFilter: searchRecency,
      });

      // Extract the answer from the response
      const answer = result.choices[0]?.message?.content || 'No answer received';

      return {
        success: true,
        answer,
        citations: result.citations || [],
        relatedQuestions: result.related_questions || [],
        metadata: {
          model: result.model,
          tokensUsed: result.usage?.total_tokens || 0,
          promptTokens: result.usage?.prompt_tokens || 0,
          completionTokens: result.usage?.completion_tokens || 0,
        },
      };
    } catch (error) {
      console.error('[perplexityResearch] Execution error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred during research',
      };
    }
  },
});

/**
 * Export type for tool response (useful for type checking in consuming code)
 */
export type PerplexityResearchResult = {
  success: boolean;
  answer?: string;
  citations?: string[];
  relatedQuestions?: string[];
  metadata?: {
    model: string;
    tokensUsed: number;
    promptTokens: number;
    completionTokens: number;
  };
  error?: string;
};
