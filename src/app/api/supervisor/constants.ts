/**
 * Response Length Constants (v2.0 - Optimized for Aggregation)
 *
 * Defines limits for generating sentences/words for different task complexities.
 * These limits guide the AI agents on how detailed their responses should be.
 *
 * KEY PRINCIPLE: Limits should grow as we aggregate up the tree
 * - Leaf nodes: compact (30-80 words)
 * - Parent nodes: moderate (100-200 words) - aggregate children
 * - Root aggregation: large (200-400 words) - synthesize all subtasks
 * - Final report: comprehensive (400+ words) - complete user-facing summary
 *
 * Version: 2.0
 * Date: 2025-10-27
 */

/**
 * Word count limits for different response types
 */
export const WORD_LIMITS = {
  /** Executive summary or brief overview (user-facing, concise) */
  EXECUTIVE_SUMMARY: {
    min: 20,
    max: 40,
  },

  /** Initial user-facing response (голосовой ответ пользователю) */
  INITIAL_RESPONSE: {
    min: 40,
    max: 80,
  },

  /** Simple task explanation or leaf node result */
  SIMPLE_EXPLANATION: {
    min: 150,
    max: 300,
  },

  /** Simple report (single task, no aggregation) */
  SIMPLE_REPORT: {
    min: 100,
    max: 200,
  },

  /** Workflow result (multi-step workflow, 3-7 steps) */
  WORKFLOW_RESULT: {
    min: 150,  // INCREASED from 40 - multi-step workflows need more detail
    max: 300,  // INCREASED from 100 - each step needs description
  },

  /** Parent node aggregation (collecting 2-5 child results) */
  PARENT_AGGREGATION: {
    min: 150,
    max: 300,
  },

  /** Root aggregation (synthesizing entire task tree) */
  ROOT_AGGREGATION: {
    min: 250,
    max: 500,
  },

  /** Final detailed report (most comprehensive, user-facing) */
  FINAL_REPORT: {
    min: 400,
    max: 1000,  // Can be extensive for complex tasks
  },
} as const;

/**
 * Sentence count limits for different task complexities
 *
 * These map to task complexity levels and guide response length
 */
export const SENTENCE_LIMITS = {
  /** Simple tasks - straightforward, single-step operations */
  SIMPLE: {
    min: 0,
    max: 50,
    description: 'Simple tasks: straightforward, single-step operations',
  },

  /** Medium tasks - multi-step workflows with moderate complexity */
  MEDIUM: {
    min: 30,   // Slightly raised min to ensure detail
    max: 100,
    description: 'Medium tasks: multi-step workflows with moderate complexity',
  },

  /** Complex tasks - hierarchical structures with many subtasks */
  COMPLEX: {
    min: 80,   // Raised min to ensure comprehensive coverage
    max: 250,  // Slightly reduced max to avoid verbosity
    description: 'Complex tasks: hierarchical structures requiring exhaustive details',
  },

  /** Hierarchical complex - tasks with deep nesting and aggregation */
  HIERARCHICAL_COMPLEX: {
    min: 200,  // Reduced from 300 - be comprehensive but not excessive
    max: 500,  // Set reasonable upper bound (was Infinity)
    description: 'Hierarchical complex: tasks with deep nesting requiring complete documentation',
  },
} as const;

/**
 * Response length by execution context
 *
 * Different agents and execution modes need different response lengths
 */
export const CONTEXT_LIMITS = {
  /** ExecutorAgent - Leaf task execution (no children) */
  EXECUTOR_LEAF: {
    min: 30,
    max: 100,
    description: 'Leaf task execution - focused, single task result',
  },

  /** ExecutorAgent - Parent aggregation (2-5 children) */
  EXECUTOR_PARENT: {
    min: 100,
    max: 250,
    description: 'Parent aggregation - synthesize 2-5 child results',
  },

  /** ExecutorAgent - Root aggregation (entire subtree) */
  EXECUTOR_ROOT: {
    min: 200,
    max: 400,
    description: 'Root aggregation - synthesize entire task tree',
  },

  /** WorkflowOrchestrator - Sequential workflow result */
  WORKFLOW_SEQUENTIAL: {
    min: 150,
    max: 300,
    description: 'Sequential workflow - describe steps and results',
  },

  /** ReportGenerator - Final comprehensive report */
  REPORT_FINAL: {
    min: 400,
    max: 1000,
    description: 'Final report - most detailed, user-facing summary',
  },
} as const;

/**
 * Helper text for prompts explaining length guidelines
 */
export const LENGTH_GUIDELINES = {
  /** No length limit - comprehensive response */
  NO_LIMIT: 'NO LENGTH LIMIT',

  /** Simple tasks guideline */
  SIMPLE_TASKS: `up to ${SENTENCE_LIMITS.SIMPLE.max} sentences`,

  /** Medium tasks guideline */
  MEDIUM_TASKS: `${SENTENCE_LIMITS.MEDIUM.min}-${SENTENCE_LIMITS.MEDIUM.max} sentences`,

  /** Complex tasks guideline */
  COMPLEX_TASKS: `${SENTENCE_LIMITS.COMPLEX.min}-${SENTENCE_LIMITS.COMPLEX.max} sentences with exhaustive details`,

  /** Hierarchical tasks guideline */
  HIERARCHICAL_TASKS: `${SENTENCE_LIMITS.HIERARCHICAL_COMPLEX.min}-${SENTENCE_LIMITS.HIERARCHICAL_COMPLEX.max} sentences with ALL details`,

  /** General comprehensive guideline */
  COMPREHENSIVE: `${WORD_LIMITS.SIMPLE_EXPLANATION.min}+ words for simple explanations, ${SENTENCE_LIMITS.HIERARCHICAL_COMPLEX.min}+ sentences for complex hierarchical task aggregation`,
} as const;

/**
 * Task complexity classifications
 */
export const TASK_COMPLEXITY = {
  SIMPLE: 'simple',
  MEDIUM: 'medium',
  COMPLEX: 'complex',
  HIERARCHICAL_COMPLEX: 'hierarchical_complex',
} as const;

/**
 * Gets sentence limit range for a given task complexity
 */
export function getSentenceLimitForComplexity(complexity: keyof typeof TASK_COMPLEXITY): {
  min: number;
  max: number;
  description: string;
} {
  switch (complexity) {
    case 'SIMPLE':
      return SENTENCE_LIMITS.SIMPLE;
    case 'MEDIUM':
      return SENTENCE_LIMITS.MEDIUM;
    case 'COMPLEX':
      return SENTENCE_LIMITS.COMPLEX;
    case 'HIERARCHICAL_COMPLEX':
      return SENTENCE_LIMITS.HIERARCHICAL_COMPLEX;
    default:
      return SENTENCE_LIMITS.MEDIUM;
  }
}

/**
 * Gets word limit range for a given execution context
 */
export function getWordLimitForContext(
  context: 'leaf' | 'parent' | 'root' | 'workflow' | 'report'
): { min: number; max: number } {
  switch (context) {
    case 'leaf':
      return CONTEXT_LIMITS.EXECUTOR_LEAF;
    case 'parent':
      return CONTEXT_LIMITS.EXECUTOR_PARENT;
    case 'root':
      return CONTEXT_LIMITS.EXECUTOR_ROOT;
    case 'workflow':
      return CONTEXT_LIMITS.WORKFLOW_SEQUENTIAL;
    case 'report':
      return CONTEXT_LIMITS.REPORT_FINAL;
    default:
      return CONTEXT_LIMITS.EXECUTOR_LEAF;
  }
}

/**
 * Formats a length guideline string for prompt instructions
 */
export function formatLengthGuideline(
  simpleLimit: string,
  complexLimit: string
): string {
  return `${LENGTH_GUIDELINES.NO_LIMIT} - ${simpleLimit} for simple tasks, ${complexLimit} for complex tasks`;
}

/**
 * Common length descriptions used across prompts
 */
export const LENGTH_DESCRIPTIONS = {
  /** For detailed results in reports (MOST COMPREHENSIVE) */
  DETAILED_RESULTS: formatLengthGuideline(
    `${WORD_LIMITS.SIMPLE_REPORT.min}-${WORD_LIMITS.SIMPLE_REPORT.max} words`,
    `${WORD_LIMITS.FINAL_REPORT.min}+ words with ALL details`
  ),

  /** For workflow/execution responses */
  EXECUTION_RESPONSE: formatLengthGuideline(
    `up to ${SENTENCE_LIMITS.MEDIUM.max} sentences`,
    `${SENTENCE_LIMITS.COMPLEX.min}-${SENTENCE_LIMITS.COMPLEX.max} sentences`
  ),

  /** For comprehensive summaries (workflows with many steps) */
  COMPREHENSIVE_SUMMARY: formatLengthGuideline(
    `${WORD_LIMITS.WORKFLOW_RESULT.min}-${WORD_LIMITS.WORKFLOW_RESULT.max} words`,
    `${WORD_LIMITS.ROOT_AGGREGATION.min}+ words with many steps`
  ),

  /** For leaf task execution (ExecutorAgent in leaf mode) */
  LEAF_EXECUTION: `${CONTEXT_LIMITS.EXECUTOR_LEAF.min}-${CONTEXT_LIMITS.EXECUTOR_LEAF.max} words`,

  /** For parent aggregation (ExecutorAgent collecting children) */
  PARENT_AGGREGATION: `${CONTEXT_LIMITS.EXECUTOR_PARENT.min}-${CONTEXT_LIMITS.EXECUTOR_PARENT.max} words`,

  /** For root aggregation (ExecutorAgent at tree root) */
  ROOT_AGGREGATION: `${CONTEXT_LIMITS.EXECUTOR_ROOT.min}-${CONTEXT_LIMITS.EXECUTOR_ROOT.max} words`,
} as const;

/**
 * Aggregation multiplier logic:
 * When aggregating N child results, the parent should be approximately:
 * - If N <= 3: sum of children * 0.6 (moderate compression)
 * - If N <= 5: sum of children * 0.5 (more compression)
 * - If N > 5: sum of children * 0.4 (significant compression)
 *
 * Example:
 * - 3 children @ 80 words each = 240 words total
 * - Parent should be: 240 * 0.6 = 144 words (within 100-250 range)
 */
export function calculateAggregationTarget(
  childCount: number,
  avgChildWords: number
): { min: number; max: number } {
  const totalWords = childCount * avgChildWords;

  let multiplier: number;
  if (childCount <= 3) {
    multiplier = 0.6;
  } else if (childCount <= 5) {
    multiplier = 0.5;
  } else {
    multiplier = 0.4;
  }

  const target = Math.round(totalWords * multiplier);

  return {
    min: Math.max(100, Math.round(target * 0.8)),  // 80% of target, min 100
    max: Math.max(250, Math.round(target * 1.2)),  // 120% of target, min 250
  };
}
