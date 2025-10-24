/**
 * TaskProgressIndicator - Real-time progress display for IntelligentSupervisor tasks
 *
 * This component subscribes to SSE stream and displays real-time progress updates
 * from IntelligentSupervisor execution.
 *
 * Usage:
 * <TaskProgressIndicator sessionId="session-xxx" />
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
  progress: number; // 0-100
  currentStep?: number;
  totalSteps?: number;
  details?: any;
  timestamp: number;
}

interface TaskProgressIndicatorProps {
  sessionId: string | null;
  onComplete?: () => void;
  onError?: (error: string) => void;
}

export function TaskProgressIndicator({
  sessionId,
  onComplete,
  onError,
}: TaskProgressIndicatorProps) {
  const [progress, setProgress] = useState(0);
  const [currentMessage, setCurrentMessage] = useState('');
  const [updates, setUpdates] = useState<ProgressUpdate[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [receivedStartedEvent, setReceivedStartedEvent] = useState(false);

  // Use refs to track completion state in event handlers (avoid stale closures)
  const isCompletedRef = useRef(false);
  const hasErrorRef = useRef(false);

  const handleUpdate = useCallback((update: ProgressUpdate) => {
    setProgress(update.progress);
    setCurrentMessage(update.message);
    setUpdates(prev => [...prev, update]);

    // Track if we received 'started' event to know task actually began
    if (update.type === 'started') {
      setReceivedStartedEvent(true);
    }

    if (update.type === 'completed') {
      setIsCompleted(true);
      isCompletedRef.current = true; // Update ref for event handlers
      onComplete?.();
    } else if (update.type === 'error') {
      setHasError(true);
      hasErrorRef.current = true; // Update ref for event handlers
      onError?.(update.message);
    }
  }, [onComplete, onError]);

  useEffect(() => {
    if (!sessionId) {
      console.log('[TaskProgressIndicator] No sessionId provided');
      return;
    }

    console.log('[TaskProgressIndicator] Connecting to SSE stream for session:', sessionId);

    // Create EventSource for SSE
    const eventSource = new EventSource(`/api/supervisor/unified/stream?sessionId=${sessionId}`);

    eventSource.onopen = () => {
      console.log('[TaskProgressIndicator] SSE connection opened');
      setIsConnected(true);
    };

    eventSource.onmessage = (event) => {
      try {
        const update: ProgressUpdate = JSON.parse(event.data);
        console.log('[TaskProgressIndicator] Update received:', update);
        handleUpdate(update);
      } catch (error) {
        console.error('[TaskProgressIndicator] Error parsing SSE message:', error);
      }
    };

    eventSource.onerror = (error) => {
      console.error('[TaskProgressIndicator] SSE error:', error);
      setIsConnected(false);

      // Determine if this is a real error or just normal stream closure
      // Use refs to avoid stale closure values
      const taskCompleted = isCompletedRef.current;
      const taskHasError = hasErrorRef.current;

      if (!taskCompleted && !taskHasError) {
        // Real error: connection failed before receiving completion events
        console.warn('[TaskProgressIndicator] Connection closed unexpectedly');
        setHasError(true);
        hasErrorRef.current = true;
        onError?.('Соединение прервано. Попробуйте повторить запрос.');
      } else {
        // Normal closure after completion or explicit error
        console.log('[TaskProgressIndicator] SSE stream closed normally after task completion');
      }

      eventSource.close();
    };

    // Cleanup on unmount
    return () => {
      console.log('[TaskProgressIndicator] Closing SSE connection');
      eventSource.close();
    };
  }, [sessionId, handleUpdate, isCompleted, onError]);

  if (!sessionId) {
    return null; // Don't render if no sessionId
  }

  return (
    <div className="task-progress-indicator bg-gray-800 border border-gray-700 rounded-lg p-4 mb-4">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold text-gray-200">
          {isCompleted ? '✓ Задача выполнена' : hasError ? '✗ Ошибка' : 'Выполнение задачи...'}
        </h3>
        <span className="text-xs text-gray-400">
          {isConnected ? '🟢 Connected' : '🔴 Disconnected'}
        </span>
      </div>

      {/* Progress bar */}
      <div className="w-full bg-gray-700 rounded-full h-2.5 mb-3">
        <div
          className={`h-2.5 rounded-full transition-all duration-300 ${
            hasError ? 'bg-red-500' : isCompleted ? 'bg-green-500' : 'bg-blue-500'
          }`}
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Current message */}
      <p className="text-sm text-gray-300 mb-3">
        {currentMessage || 'Ожидание обновлений...'}
      </p>

      {/* Progress percentage */}
      <div className="text-xs text-gray-400 mb-2">
        Прогресс: {progress}%
      </div>

      {/* Detailed updates (collapsible) */}
      {updates.length > 0 && (
        <details className="mt-3">
          <summary className="text-xs text-gray-400 cursor-pointer hover:text-gray-300">
            Показать детали ({updates.length} обновлений)
          </summary>
          <div className="mt-2 max-h-48 overflow-y-auto space-y-1 text-xs">
            {updates.map((update, idx) => (
              <div
                key={idx}
                className={`p-2 rounded ${
                  update.type === 'error'
                    ? 'bg-red-900/20 text-red-300'
                    : update.type === 'completed'
                    ? 'bg-green-900/20 text-green-300'
                    : 'bg-gray-700 text-gray-300'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs opacity-60">
                    {new Date(update.timestamp).toLocaleTimeString()}
                  </span>
                  <span className="text-xs opacity-75">{update.type}</span>
                </div>
                <p className="mt-1">{update.message}</p>
                {update.details && (
                  <details className="mt-1 opacity-75">
                    <summary className="cursor-pointer">Детали</summary>
                    <pre className="mt-1 text-xs overflow-x-auto">
                      {JSON.stringify(update.details, null, 2)}
                    </pre>
                  </details>
                )}
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}
