/**
 * TaskTreeView - Interactive task tree visualization
 *
 * Displays hierarchical task breakdown from intelligentSupervisor
 * with different icons for complexity, strategy, mode, and status.
 *
 * Version: 1.0
 * Date: 2025-10-24
 */

'use client';

import React, { useState, useEffect } from 'react';

// Types for task visualization
export type TaskComplexity = 'simple' | 'medium' | 'complex' | 'moderate';
export type ExecutionStrategy = 'direct' | 'flat' | 'hierarchical';
export type ExecutionMode = 'auto' | 'plan' | 'execute';
export type SupervisorDecision = 'approve' | 'modify' | 'reject' | 'delegateBack';
export type TaskStatus =
  | 'planned'
  | 'in_progress'
  | 'completed'
  | 'failed'
  | 'needUserInput'     // v2.0 - waiting for user input
  | 'needsResearch'     // v2.0 - requires web research
  | 'researchFailed'    // v2.0 - research attempted but failed
  | 'toolError'         // v2.0 - MCP tool execution error
  | 'blocked'
  | 'skipped';

export interface TaskNode {
  taskId: string;
  description: string;
  status: TaskStatus;
  complexity?: TaskComplexity;
  executionStrategy?: ExecutionStrategy;
  executionMode?: ExecutionMode;
  supervisorDecision?: SupervisorDecision;
  result?: string;
  error?: string;
  subtasks?: TaskNode[];
  level?: number;
}

export interface TaskTreeViewProps {
  taskTree?: TaskNode;
}

// Icon mappings
const complexityIcons: Record<TaskComplexity, string> = {
  simple: '🟢',
  moderate: '🟡',
  medium: '🟡',
  complex: '🔴',
};

const strategyIcons: Record<ExecutionStrategy, string> = {
  direct: '➡️',
  flat: '📋',
  hierarchical: '🌳',
};

const executionModeIcons: Record<ExecutionMode, string> = {
  auto: '⚡',
  plan: '📝',
  execute: '▶️',
};

const supervisorDecisionIcons: Record<SupervisorDecision, string> = {
  approve: '✅',
  modify: '✏️',
  reject: '❌',
  delegateBack: '↩️',
};

const statusIcons: Record<TaskStatus, { icon: string; color: string }> = {
  planned: { icon: '⏳', color: 'text-gray-500' },
  in_progress: { icon: '🔄', color: 'text-blue-500' },
  completed: { icon: '✅', color: 'text-green-500' },
  failed: { icon: '❌', color: 'text-red-500' },
  needUserInput: { icon: '❓', color: 'text-yellow-600' },      // v2.0 - waiting for user
  needsResearch: { icon: '🔍', color: 'text-cyan-600' },        // v2.0 - needs web research
  researchFailed: { icon: '🔎', color: 'text-red-400' },        // v2.0 - research failed
  toolError: { icon: '⚠️', color: 'text-orange-600' },          // v2.0 - tool error
  blocked: { icon: '🚫', color: 'text-orange-500' },
  skipped: { icon: '⏭️', color: 'text-purple-500' },
};

/**
 * Single task node component
 */
function TaskNodeView({ 
  node, 
  depth = 0 
}: { 
  node: TaskNode; 
  depth?: number 
}) {
  const [isExpanded, setIsExpanded] = useState(true); // Auto-expand all levels by default
  const hasSubtasks = node.subtasks && node.subtasks.length > 0;
  const status = statusIcons[node.status] || statusIcons.planned;

  // Auto-expand when new subtasks appear (tree updates via SSE)
  useEffect(() => {
    if (hasSubtasks && !isExpanded) {
      console.log('[TaskTreeView] Auto-expanding node:', node.taskId, 'subtasks:', node.subtasks?.length);
      setIsExpanded(true);
    }
  }, [hasSubtasks, node.subtasks?.length]); // Trigger when subtasks are added

  // Debug: log when node has subtasks
  useEffect(() => {
    if (hasSubtasks) {
      console.log('[TaskTreeView] Rendering node with subtasks:', {
        taskId: node.taskId,
        depth,
        subtasksCount: node.subtasks?.length,
        isExpanded,
        status: node.status,
      });
    }
  }, [node.taskId, node.subtasks?.length, isExpanded, depth]);

  // Calculate indentation
  const indentClass = depth > 0 ? 'ml-6 border-l-2 border-gray-300 pl-4' : '';

  return (
    <div className={`${indentClass} mb-2`}>
      {/* Task Header */}
      <div
        className={`
          flex items-start gap-2 p-2 rounded-lg cursor-pointer
          transition-colors duration-200
          hover:bg-gray-100
          ${node.status === 'in_progress' ? 'bg-blue-50 border border-blue-200' : ''}
          ${node.status === 'completed' ? 'bg-green-50' : ''}
          ${node.status === 'failed' ? 'bg-red-50 border border-red-200' : ''}
          ${node.status === 'needUserInput' ? 'bg-yellow-50 border border-yellow-300' : ''}
          ${node.status === 'needsResearch' ? 'bg-cyan-50 border border-cyan-200' : ''}
          ${node.status === 'researchFailed' ? 'bg-red-50 border border-red-300' : ''}
          ${node.status === 'toolError' ? 'bg-orange-50 border border-orange-300' : ''}
          ${node.status === 'blocked' ? 'bg-orange-50 border border-orange-200' : ''}
          ${node.status === 'skipped' ? 'bg-purple-50 border border-purple-200' : ''}
        `}
        onClick={() => hasSubtasks && setIsExpanded(!isExpanded)}
      >
        {/* Expand/Collapse indicator */}
        {hasSubtasks && (
          <span className="text-gray-400 text-sm mt-1 select-none">
            {isExpanded ? '▼' : '▶'}
          </span>
        )}
        {!hasSubtasks && <span className="w-4"></span>}

        {/* Task content */}
        <div className="flex-1 min-w-0">
          {/* First row: Status, Complexity, Strategy */}
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className={`text-lg ${status.color}`} title={`Статус: ${node.status}`}>
              {status.icon}
            </span>

            {node.complexity && (
              <span 
                className="text-sm" 
                title={`Сложность: ${node.complexity}`}
              >
                {complexityIcons[node.complexity]}
              </span>
            )}

            {node.executionStrategy && (
              <span 
                className="text-sm" 
                title={`Стратегия: ${node.executionStrategy}`}
              >
                {strategyIcons[node.executionStrategy]}
              </span>
            )}

            {node.executionMode && (
              <span 
                className="text-sm" 
                title={`Режим: ${node.executionMode}`}
              >
                {executionModeIcons[node.executionMode]}
              </span>
            )}

            {node.supervisorDecision && (
              <span 
                className="text-sm" 
                title={`Решение: ${node.supervisorDecision}`}
              >
                {supervisorDecisionIcons[node.supervisorDecision]}
              </span>
            )}

            <span className="text-xs text-gray-400 font-mono">
              {node.taskId}
            </span>
          </div>

          {/* Second row: Description */}
          <div className="text-sm text-gray-800 font-medium">
            {node.description}
          </div>

          {/* Third row: Result or Error */}
          {node.result && (
            <div className="text-xs text-gray-600 mt-1 italic">
              ✓ {node.result}
            </div>
          )}
          {node.error && (
            <div className="text-xs text-red-600 mt-1 bg-red-100 p-1 rounded">
              ✗ Ошибка: {node.error}
            </div>
          )}

          {/* Subtasks count */}
          {hasSubtasks && node.subtasks && (
            <div className="text-xs text-gray-500 mt-1">
              {node.subtasks.length} {node.subtasks.length === 1 ? 'подзадача' : 'подзадач'}
            </div>
          )}
        </div>
      </div>

      {/* Subtasks (recursive) */}
      {isExpanded && hasSubtasks && node.subtasks && (
        <div className="mt-2">
          {node.subtasks.map((subtask, index) => (
            <TaskNodeView
              key={subtask.taskId || index}
              node={subtask}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Main TaskTreeView component
 */
export function TaskTreeView({ taskTree }: TaskTreeViewProps) {
  if (!taskTree) {
    return (
      <div className="text-sm text-gray-500 italic p-3 bg-gray-50 rounded-lg">
        Дерево задач будет отображено после декомпозиции...
      </div>
    );
  }

  return (
    <div className="task-tree-view mt-3 p-3 bg-white rounded-lg border border-gray-200">
      {/* Header */}
      <div className="mb-3 pb-2 border-b border-gray-200">
        <div className="text-sm font-semibold text-gray-700 mb-2">
          📊 Иерархия задач
        </div>
        
        {/* Legend */}
        <div className="text-xs text-gray-500 space-y-1">
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            <span title="Сложность">🟢 простая | 🟡 средняя | 🔴 сложная</span>
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            <span title="Стратегия">➡️ прямое | 📋 плоское | 🌳 иерархия</span>
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            <span title="Статус базовые">⏳ план | 🔄 выполн. | ✅ готово | ❌ ошибка | ⏭️ пропущено</span>
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            <span title="Статус v2.0">❓ ждёт юзера | 🔍 нужен поиск | 🔎 поиск неудачен | ⚠️ ошибка инструм.</span>
          </div>
        </div>
      </div>

      {/* Task Tree */}
      <TaskNodeView node={taskTree} depth={0} />
    </div>
  );
}

