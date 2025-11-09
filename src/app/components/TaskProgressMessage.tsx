/**
 * TaskProgressMessage - Chat message component showing real-time task progress
 *
 * This component displays task progress as a message in the chat transcript.
 * It subscribes to SSE updates and updates the progress bar in real-time.
 * Includes interactive task tree visualization.
 *
 * Version: 2.1 - Added task tree visualization
 * Date: 2025-10-24
 */

'use client';

import React, { useEffect, useState } from 'react';
import { useTranscript } from '@/app/contexts/TranscriptContext';
import { useTaskProgress } from '@/app/hooks/useTaskProgress';
import { TaskTreeView, TaskNode } from './TaskTreeView';

export interface TaskProgressMessageProps {
  sessionId: string;
  taskDescription: string;
  timestamp: string;
  initialProgress?: number;
  initialMessage?: string;
  hierarchicalBreakdown?: any; // Hierarchical task breakdown from IntelligentSupervisor
}

export function TaskProgressMessage({
  sessionId,
  taskDescription,
  timestamp,
  initialProgress = 0,
  initialMessage = 'Инициализация задачи...',
  hierarchicalBreakdown,
}: TaskProgressMessageProps) {
  const { updateTaskProgress, addHITLApproval } = useTranscript();
  const { progress, message, isComplete, error, updates } = useTaskProgress(sessionId);
  const [taskTree, setTaskTree] = useState<TaskNode | undefined>(hierarchicalBreakdown);
  const [processedHITLs, setProcessedHITLs] = useState<Set<string>>(new Set());
  const [lastProgress, setLastProgress] = useState({ progress: 0, message: '' });

  // Update transcript context when progress changes
  useEffect(() => {
    // Only update if progress or message actually changed
    if ((progress > 0 || message) &&
        (progress !== lastProgress.progress || message !== lastProgress.message)) {
      updateTaskProgress(sessionId, progress, message || initialMessage);
      setLastProgress({ progress, message });
    }
  }, [progress, message, sessionId, initialMessage]); // Removed updateTaskProgress from deps

  // Extract task tree from progress updates
  useEffect(() => {
    // Look for hierarchicalBreakdown in progress updates (get the LATEST one)
    // Iterate in reverse to find most recent update with tree
    for (let i = updates.length - 1; i >= 0; i--) {
      if (updates[i].details?.hierarchicalBreakdown) {
        const newTree = updates[i].details.hierarchicalBreakdown;
        console.log('[TaskProgressMessage] Updating tree from update:', {
          updateType: updates[i].type,
          eventType: updates[i].details?.eventType,
          taskId: newTree.taskId,
          subtasksCount: newTree.subtasks?.length || 0,
        });
        setTaskTree(newTree);
        break; // Stop after finding the latest one
      }
    }
  }, [updates]);

  // Handle HITL requests from progress updates
  useEffect(() => {
    console.log('[TaskProgressMessage] Checking updates, count:', updates.length, 'sessionId:', sessionId);

    for (const update of updates) {
      console.log('[TaskProgressMessage] Update:', update.type, 'hitlData?', !!update.hitlData);

      if (update.type === 'hitl_request' && update.hitlData) {
        const itemId = update.hitlData.itemId;

        // Check if we already processed this HITL request
        if (!processedHITLs.has(itemId)) {
          console.log('[TaskProgressMessage] ✅ NEW HITL request received:', update.hitlData);

          addHITLApproval(
            sessionId,
            update.hitlData.type,
            update.hitlData.question,
            update.hitlData.content,
            update.hitlData.metadata
          );

          // Mark as processed
          setProcessedHITLs(prev => new Set(prev).add(itemId));
        } else {
          console.log('[TaskProgressMessage] ⏭️ Already processed:', itemId);
        }
      }
    }
  }, [updates, sessionId]); // Removed addHITLApproval and processedHITLs from deps

  const displayProgress = progress || initialProgress;
  const displayMessage = message || initialMessage;
  const progressBarWidth = `${Math.min(Math.max(displayProgress, 0), 100)}%`;

  // Determine status color
  const getStatusColor = () => {
    if (error) return 'border-red-400 bg-red-50';
    if (isComplete) return 'border-green-400 bg-green-50';
    return 'border-blue-400 bg-blue-50';
  };

  const getStatusIcon = () => {
    if (error) return '❌';
    if (isComplete) return '✅';
    return '⏳';
  };

  return (
    <div className="max-w-lg">
      <div className={`rounded-xl border-2 ${getStatusColor()} p-3`}>
        {/* Timestamp */}
        <div className="text-xs text-gray-500 font-mono mb-2">{timestamp}</div>

        {/* Task Description */}
        <div className="text-sm font-medium text-gray-800 mb-2">
          {getStatusIcon()} Задача: {taskDescription.substring(0, 100)}
          {taskDescription.length > 100 ? '...' : ''}
        </div>

        {/* Progress Message */}
        <div className="text-xs text-gray-600 mb-2 font-mono">
          {displayMessage}
        </div>

        {/* Progress Bar */}
        <div className="w-full bg-gray-200 rounded-full h-2 mb-1 overflow-hidden">
          <div
            className={`h-2 rounded-full transition-all duration-300 ${
              error
                ? 'bg-red-500'
                : isComplete
                  ? 'bg-green-500'
                  : 'bg-blue-500'
            }`}
            style={{ width: progressBarWidth }}
          />
        </div>

        {/* Progress Percentage */}
        <div className="text-xs text-right text-gray-500 font-mono">
          {displayProgress}%
        </div>

        {/* Error Message */}
        {error && (
          <div className="mt-2 text-xs text-red-600 bg-red-100 p-2 rounded border border-red-300">
            Ошибка: {error}
          </div>
        )}

        {/* Task Tree Visualization */}
        <TaskTreeView taskTree={taskTree} />

        {/* Session ID (for debugging) */}
        {process.env.NODE_ENV === 'development' && (
          <div className="mt-2 text-xs text-gray-400 font-mono">
            Session: {sessionId}
          </div>
        )}
      </div>
    </div>
  );
}
