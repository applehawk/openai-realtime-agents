/**
 * Central export point for all supervisor agents
 * 
 * Architecture v3.0:
 * - DecisionAgent: Decides if task needs breakdown
 * - ExecutorAgent: Executes tasks or aggregates results
 * - ComplexityAssessorAgent: Assesses task complexity (gpt-4o-mini)
 * - DelegationReviewerAgent: Decides delegation (gpt-4o-mini)
 * - TaskPlannerAgent: Generates execution plans
 * - WorkflowOrchestratorAgent: Orchestrates workflows
 * - ReportGeneratorAgent: Generates final reports
 */

export { decisionAgent } from './decision';
export { executorAgent } from './executor';
export { complexityAssessorAgent } from './complexityAssessor';
export { delegationReviewerAgent } from './delegationReviewer';
export { taskPlannerAgent } from './taskPlanner';
export { workflowOrchestratorAgent } from './workflowOrchestrator';
export { reportGeneratorAgent } from './reportGenerator';

// Log initialization summary
console.log('[v3.0 Agents] All specialized agents initialized:');
console.log('  ├─ DecisionAgent: Task decomposition decisions');
console.log('  ├─ ExecutorAgent: Direct execution and aggregation');
console.log('  ├─ ComplexityAssessorAgent: Complexity assessment (gpt-4o-mini)');
console.log('  ├─ DelegationReviewerAgent: Delegation decisions (gpt-4o-mini)');
console.log('  ├─ TaskPlannerAgent: Execution planning');
console.log('  ├─ WorkflowOrchestratorAgent: Workflow orchestration');
console.log('  └─ ReportGeneratorAgent: Report generation');

