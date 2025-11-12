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
  type: 'connected' | 'started' | 'complexity_assessed' | 'strategy_selected' | 'step_started' | 'step_completed' | 'completed' | 'error' | 'task_completed';
  message: string;
  progress: number;
  currentStep?: number;
  totalSteps?: number;
  details?: any;
  timestamp: number;
  // optional server-provided sequence/id (helpful if you also include it in payload)
  id?: string | number;
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

  // Deduplication using server-provided sequence ID only
  // We trust server's monotonically increasing ID to prevent duplicates
  const lastSeqIdRef = useRef<number>(-1);

  const handleUpdate = useCallback((update: ProgressUpdate) => {
    // Check refs BEFORE processing to avoid stale state
    if (isCompleteRef.current || hasErrorRef.current) {
      console.log('[useTaskProgress] Ignoring update - task already complete');
      return;
    }

    // Deduplication: Use server-provided sequence ID
    // If update has ID, check if we've already processed this sequence number
    if (update.id != null) {
      const seqId = typeof update.id === 'number' ? update.id : parseInt(String(update.id), 10);
      if (seqId <= lastSeqIdRef.current) {
        console.log('[useTaskProgress] Ignoring duplicate/old update - seq:', seqId, 'last:', lastSeqIdRef.current);
        return;
      }
      lastSeqIdRef.current = seqId;
      console.log('[useTaskProgress] Processing update seq:', seqId, 'type:', update.type);
    } else {
      console.warn('[useTaskProgress] Update missing sequence ID:', update.type);
    }

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

    // Reset completion refs for new session
    isCompleteRef.current = false;
    hasErrorRef.current = false;
    lastSeqIdRef.current = -1; // Reset sequence tracking

    const eventSource = new EventSource(`/api/supervisor/unified/stream?sessionId=${sessionId}`);

    eventSource.onopen = () => {
      console.log('[useTaskProgress] SSE connection opened');
      setState(prev => ({ ...prev, isConnected: true }));
    };

    eventSource.onmessage = (event) => {
      try {
        // Parse payload
        const dataText = event.data;
        if (!dataText) {
          console.warn('[useTaskProgress] Received empty event.data');
          return;
        }

        const update: ProgressUpdate = JSON.parse(dataText);

        console.log('[useTaskProgress] Received SSE event:', {
          type: update.type,
          progress: update.progress,
          id: update.id,
        });

        // handleUpdate will perform deduplication based on sequence ID
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

      // Ensure connection is closed locally — EventSource may auto-retry; closing prevents immediate retry loops
      try {
        eventSource.close();
      } catch (e) {
        // ignore
      }
    };

    // Cleanup on unmount or sessionId change
    return () => {
      console.log('[useTaskProgress] Cleanup: closing SSE for session:', sessionId);
      try {
        eventSource.close();
      } catch (e) {
        // ignore
      }
      // Reflect disconnected state
      setState(prev => ({ ...prev, isConnected: false }));
    };
    // handleUpdate is stable (useCallback with no deps), so safe to omit.
  }, [sessionId]);

  return state;
}
