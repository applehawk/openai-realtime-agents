/**
 * Progress Event Emitter for IntelligentSupervisor
 *
 * Provides a singleton EventEmitter to broadcast real-time progress updates
 * from IntelligentSupervisor to SSE clients.
 *
 * Version: 1.0
 * Date: 2025-10-23
 */

import { EventEmitter } from 'events';

/**
 * Progress update event data
 */
export interface ProgressUpdate {
  sessionId: string;
  type: 'started' | 'delegation_review' | 'delegate_back' | 'complexity_assessed' | 'strategy_selected' | 'step_started' | 'step_completed' | 'completed' | 'error';
  message: string;
  progress: number; // 0-100
  currentStep?: number;
  totalSteps?: number;
  details?: any;
  timestamp: number;
}

/**
 * Singleton EventEmitter for progress updates
 */
class ProgressEventEmitter extends EventEmitter {
  private static instance: ProgressEventEmitter;

  private constructor() {
    super();
    this.setMaxListeners(100); // Support multiple concurrent tasks
  }

  public static getInstance(): ProgressEventEmitter {
    if (!ProgressEventEmitter.instance) {
      ProgressEventEmitter.instance = new ProgressEventEmitter();
    }
    return ProgressEventEmitter.instance;
  }

  /**
   * Emit a progress update for a specific session
   */
  public emitProgress(update: ProgressUpdate): void {
    this.emit(`progress:${update.sessionId}`, update);
    console.log(`[ProgressEmitter] Session ${update.sessionId}: ${update.type} - ${update.message} (${update.progress}%)`);
  }

  /**
   * Subscribe to progress updates for a specific session
   */
  public onProgress(sessionId: string, callback: (update: ProgressUpdate) => void): void {
    this.on(`progress:${sessionId}`, callback);
  }

  /**
   * Unsubscribe from progress updates for a specific session
   */
  public offProgress(sessionId: string, callback: (update: ProgressUpdate) => void): void {
    this.off(`progress:${sessionId}`, callback);
  }

  /**
   * Remove all listeners for a specific session (cleanup)
   */
  public cleanupSession(sessionId: string): void {
    this.removeAllListeners(`progress:${sessionId}`);
    console.log(`[ProgressEmitter] Cleaned up session ${sessionId}`);
  }
}

// Export singleton instance
export const progressEmitter = ProgressEventEmitter.getInstance();
