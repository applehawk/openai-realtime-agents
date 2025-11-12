/**
 * Supervisor Tools Index
 *
 * Central export point for all supervisor agent tools.
 * Import tools from here to use in any agent configuration.
 *
 * Example usage:
 * ```typescript
 * import { perplexityResearch } from '../tools';
 *
 * export const myAgent = new Agent({
 *   name: 'MyAgent',
 *   model: 'gpt-4o',
 *   instructions: 'You are a helpful assistant with web research capabilities',
 *   tools: [perplexityResearch],
 * });
 * ```
 */

export { perplexityResearch, type PerplexityResearchResult } from './perplexityResearch';
