/**
 * useTaskCompletionSync - Synchronizes task progress and completion to RealtimeSession context
 *
 * This hook listens to SSE progress updates for a specific task session.
 * - Syncs 'step_completed' events with important step results
 * - Syncs final 'completed' event with full task results
 *
 * This allows the agent to track task progress in real-time and access results.
 *
 * Usage:
 * useTaskCompletionSync(sessionId, addContextMessage);
 *
 * Version: 1.1
 * Date: 2025-11-12
 */

'use client';

import { useEffect, useRef } from 'react';
import { ProgressUpdate } from './useTaskProgress';

export interface TaskCompletionSyncOptions {
  sessionId: string | null;
  addContextMessage: (role: 'user' | 'assistant' | 'system', content: string) => void;
  sendUserText?: (text: string) => void; // Optional: Send text to agent to trigger response
  enabled?: boolean;
  syncStepCompletions?: boolean; // Whether to sync individual step completions
}

/**
 * Hook to sync task progress and completion to RealtimeSession context
 */
export function useTaskCompletionSync({
  sessionId,
  addContextMessage,
  sendUserText,
  enabled = true,
  syncStepCompletions = true,
}: TaskCompletionSyncOptions) {
  const hasCompletedRef = useRef(false);
  const processedStepsRef = useRef(new Set<string>()); // Track processed steps to avoid duplicates
  const sentNotificationsRef = useRef(new Set<string>()); // Track sent notifications to avoid duplicates

  useEffect(() => {
    if (!sessionId || !enabled) {
      return;
    }

    console.log('[useTaskCompletionSync] Starting sync for session:', sessionId);

    // Reset flags for new session
    hasCompletedRef.current = false;
    processedStepsRef.current.clear();
    sentNotificationsRef.current.clear();

    const eventSource = new EventSource(`/api/supervisor/unified/stream?sessionId=${sessionId}`);

    eventSource.onmessage = (event) => {
      try {
        const update: ProgressUpdate = JSON.parse(event.data);

        // Log all events for debugging
        console.log('[useTaskCompletionSync] Received event:', {
          type: update.type,
          progress: update.progress,
          sessionId: update.sessionId,
        });

        // Handle step_completed events (intermediate progress)
        if (syncStepCompletions && (update.type === 'step_completed' || update.type === 'task_completed') && !hasCompletedRef.current) {
          // Create a unique key for this step to avoid duplicates
          const stepKey = `${update.timestamp}-${update.message}`;

          if (!processedStepsRef.current.has(stepKey)) {
            processedStepsRef.current.add(stepKey);

            console.log('[useTaskCompletionSync] Step completed, syncing to RealtimeSession:', {
              sessionId: update.sessionId,
              message: update.message,
              progress: update.progress,
            });

            // Format step completion as a brief message
            const stepMessage = `[ШАГ ЗАВЕРШЕН] Session ID: ${update.sessionId} - ${update.message}`;

            // Add to context for history (only for record keeping)
            addContextMessage('assistant', stepMessage);

            // DISABLED: Agent notification for step completion
            // Reason: Causes infinite loops - agent responds to every step, triggering new events
            // Future: Re-enable only for critical steps or with rate limiting
            const notificationKey = `step-${stepKey}`;
            if (sendUserText && !sentNotificationsRef.current.has(notificationKey)) {
              sentNotificationsRef.current.add(notificationKey);
              const agentNotification = `Шаг задачи завершен (Session ID: ${update.sessionId}): ${update.message}. Прокомментируй прогресс кратко.`;
              console.log('[useTaskCompletionSync] Sending step completion to agent:', agentNotification);
              sendUserText(agentNotification);
            }

            console.log('[useTaskCompletionSync] Step progress sent to RealtimeSession');
          }
        }

        // Handle final completion: either explicit 'completed' type OR progress reached 100%
        const isCompleted = update.type === 'completed' || update.progress >= 100;

        if (isCompleted && !hasCompletedRef.current) {
          hasCompletedRef.current = true;

          console.log('[useTaskCompletionSync] Task completed, syncing to RealtimeSession:', {
            sessionId: update.sessionId,
            type: update.type,
            progress: update.progress,
            hasDetails: !!update.details,
          });

          // Extract only essential information for voice agent context
          const finalResult = update.details?.finalResult;

          // Format concise context message with only relevant data
          // NOTE: Do NOT fallback to update.message - it contains technical progress messages
          const contextMessage = `[ЗАДАЧА ЗАВЕРШЕНА]
Session ID: ${update.sessionId}

${finalResult?.nextResponse || 'Задача успешно выполнена. Результаты доступны в системе.'}

${finalResult?.workflowSteps && finalResult.workflowSteps.length > 0 ? `\nВыполненные шаги:\n${finalResult.workflowSteps.map((step: string, i: number) => `${i + 1}. ${step}`).join('\n')}` : ''}

${finalResult?.plannedSteps && finalResult.plannedSteps.length > 0 ? `\nЗапланированные шаги:\n${finalResult.plannedSteps.map((step: string, i: number) => `${i + 1}. ${step}`).join('\n')}` : ''}`;

          // Add to context for history
          addContextMessage('assistant', contextMessage);

          const notificationKey = `completion-${update.sessionId}`;
          if (sendUserText && !sentNotificationsRef.current.has(notificationKey)) {
            sentNotificationsRef.current.add(notificationKey);
            const agentNotification = `Задача завершена (Session ID: ${update.sessionId}). ${finalResult?.nextResponse || 'Задача успешно выполнена'}. Сообщи пользователю о результате.`;
            sendUserText(agentNotification);
            console.log('[useTaskCompletionSync] Sent completion to agent:', agentNotification);
          }

          console.log('[useTaskCompletionSync] Context message sent to RealtimeSession');

          // Close EventSource after completion
          eventSource.close();
        }
      } catch (error) {
        console.error('[useTaskCompletionSync] Error processing SSE event:', error);
      }
    };

    eventSource.onerror = (error) => {
      console.error('[useTaskCompletionSync] SSE connection error:', error);
      eventSource.close();
    };

    // Cleanup on unmount or sessionId change
    return () => {
      console.log('[useTaskCompletionSync] Cleaning up SSE connection for session:', sessionId);
      eventSource.close();
    };
  }, [sessionId, addContextMessage, sendUserText, enabled, syncStepCompletions]);
}
