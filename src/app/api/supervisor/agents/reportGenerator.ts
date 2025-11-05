import { Agent } from '@openai/agents';
import { reportGeneratorInstructions } from '../prompts';

/**
 * ReportGeneratorAgent - Generates final reports
 * Uses gpt-4o for quality-critical synthesis
 */
export const reportGeneratorAgent = new Agent({
  name: 'ReportGeneratorAgent',
  model: 'gpt-4o',
  instructions: reportGeneratorInstructions,
  tools: [], // No tools needed - synthesis only
});

// Log agent initialization
console.log('[reportGeneratorAgent] Agent initialized (comprehensive report generation)');

