/**
 * useTaskProgress - React hook for tracking IntelligentSupervisor task progress
 *
 * This hook manages SSE connection lifecycle and provides progress state.
 *
 * Usage:
 * const { progress, message, updates, isComplete, error } = useTaskProgress(sessionId);
 *
 * Version: 1.0
 * Date: 2025-10-23
 */

'use client';

import { useEffect, useState, useCallback, useRef } from 'react';

export interface ProgressUpdate {
  sessionId: string;
  type: 'connected' | 'started' | 'complexity_assessed' | 'strategy_selected' | 'step_started' | 'step_completed' | 'completed' | 'error';
  message: string;
  progress: number;
  currentStep?: number;
  totalSteps?: number;
  details?: any;
  timestamp: number;
}

export interface TaskProgressState {
  progress: number;
  message: string;
  updates: ProgressUpdate[];
  isConnected: boolean;
  isComplete: boolean;
  error: string | null;
}

export function useTaskProgress(sessionId: string | null): TaskProgressState {
  const [state, setState] = useState<TaskProgressState>({
    progress: 0,
    message: '',
    updates: [],
    isConnected: false,
    isComplete: false,
    error: null,
  });

  // Use refs to track completion state in event handlers (avoid stale closures)
  const isCompleteRef = useRef(false);
  const hasErrorRef = useRef(false);

  const handleUpdate = useCallback((update: ProgressUpdate) => {
    setState(prev => {
      const newIsComplete = prev.isComplete || update.type === 'completed';
      const newError = update.type === 'error' ? update.message : prev.error;

      // Update refs for event handlers
      if (newIsComplete) {
        isCompleteRef.current = true;
      }
      if (newError) {
        hasErrorRef.current = true;
      }

      return {
        ...prev,
        progress: update.progress,
        message: update.message,
        updates: [...prev.updates, update],
        isComplete: newIsComplete,
        error: newError,
      };
    });
  }, []);

  useEffect(() => {
    if (!sessionId) {
      return;
    }

    console.log('[useTaskProgress] Connecting to SSE for session:', sessionId);

    const eventSource = new EventSource(`/api/supervisor/unified/stream?sessionId=${sessionId}`);

    eventSource.onopen = () => {
      console.log('[useTaskProgress] SSE connection opened');
      setState(prev => ({ ...prev, isConnected: true }));
    };

    eventSource.onmessage = (event) => {
      try {
        const update: ProgressUpdate = JSON.parse(event.data);
        console.log('[useTaskProgress] Update:', update);
        handleUpdate(update);
      } catch (error) {
        console.error('[useTaskProgress] Parse error:', error);
      }
    };

    eventSource.onerror = (error) => {
      console.error('[useTaskProgress] SSE error:', error);

      // Use refs to avoid stale closure values
      const taskComplete = isCompleteRef.current;
      const taskHasError = hasErrorRef.current;

      setState(prev => {
        if (!taskComplete && !taskHasError) {
          // Real error: connection failed before receiving completion events
          console.warn('[useTaskProgress] Connection closed unexpectedly');
          hasErrorRef.current = true;
          return {
            ...prev,
            isConnected: false,
            error: 'Соединение прервано. Попробуйте повторить запрос.',
          };
        } else {
          // Normal closure after completion or explicit error
          console.log('[useTaskProgress] SSE stream closed normally after task completion');
          return {
            ...prev,
            isConnected: false,
          };
        }
      });

      eventSource.close();
    };

    return () => {
      console.log('[useTaskProgress] Cleanup: closing SSE');
      eventSource.close();
    };
  }, [sessionId]); // handleUpdate is stable via useCallback, no need in deps

  return state;
}
