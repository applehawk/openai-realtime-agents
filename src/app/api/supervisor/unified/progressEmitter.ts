/**
 * ProgressEventEmitter — singleton emitter with per-session seq (event id)
 *
 * This module attaches a monotonically increasing `id` to each emitted update for a session.
 *
 * Version: 1.1
 * Date: 2025-11-12
 */

import { EventEmitter } from 'events';

export interface ProgressUpdate {
  sessionId: string;
  type: 'started' | 'delegation_review' | 'delegate_back' | 'complexity_assessed' | 'strategy_selected' | 'step_started' | 'step_completed' | 'completed' | 'error' | 'connected';
  message: string;
  progress: number;
  currentStep?: number;
  totalSteps?: number;
  details?: any;
  timestamp: number;
  id?: string | number; // server-assigned monotonic sequence id (per-session)
}

class ProgressEventEmitter extends EventEmitter {
  private static instance: ProgressEventEmitter;
  private completedSessions = new Set<string>();
  private lastEmittedEvent = new Map<string, string>(); // sessionId -> hash of last event
  private sessionSeq = new Map<string, number>(); // sessionId -> seq number

  private constructor() {
    super();
    this.setMaxListeners(200);
  }

  public static getInstance(): ProgressEventEmitter {
    if (!ProgressEventEmitter.instance) {
      ProgressEventEmitter.instance = new ProgressEventEmitter();
    }
    return ProgressEventEmitter.instance;
  }

  private nextSeq(sessionId: string): number {
    const current = this.sessionSeq.get(sessionId) ?? 0;
    const next = current + 1;
    this.sessionSeq.set(sessionId, next);
    return next;
  }

  /**
   * Peek current seq for session without incrementing.
   * Returns 0 if no events emitted yet for this session.
   */
  public peekSeq(sessionId: string): number {
    return this.sessionSeq.get(sessionId) ?? 0;
  }

  /**
   * Emit a progress update for a specific session
   * This method attaches a per-session monotonically increasing `id` to the payload.
   */
  public emitProgress(update: ProgressUpdate): void {
    const { sessionId, type } = update;

    // Skip already completed sessions
    if (this.completedSessions.has(sessionId)) {
      console.log(`[ProgressEmitter] Ignoring emit for completed session ${sessionId}`);
      return;
    }

    // Deduplication: event hash
    const eventHash = `${type}:${update.message}:${update.progress}`;
    const lastHash = this.lastEmittedEvent.get(sessionId);
    if (lastHash === eventHash) {
      console.log(`[ProgressEmitter] SKIPPED DUPLICATE - Session ${sessionId}: ${type} (${update.progress}%)`);
      return;
    }
    this.lastEmittedEvent.set(sessionId, eventHash);

    // Attach per-session seq id
    const seq = this.nextSeq(sessionId);
    const payload: ProgressUpdate = { ...update, id: seq };

    // Emit the event for listeners
    this.emit(`progress:${sessionId}`, payload);
    console.log(`[ProgressEmitter] Emitted [${seq}] Session ${sessionId}: ${type} - ${update.message} (${update.progress}%)`);

    // Mark finished sessions
    if (type === 'completed' || type === 'error') {
      this.completedSessions.add(sessionId);
      // We keep sessionSeq and completedSessions to avoid re-emitting old events if sessionId reused unexpectedly
      this.lastEmittedEvent.delete(sessionId);
      console.log(`[ProgressEmitter] Marked session ${sessionId} as completed`);
    }
  }

  /**
   * Subscribe to progress updates for a specific session
   */
  public onProgress(sessionId: string, callback: (update: ProgressUpdate) => void): void {
    this.on(`progress:${sessionId}`, callback);
    console.log(`[ProgressEmitter] onProgress → ${sessionId} (${this.listenerCount(`progress:${sessionId}`)} listeners)`);
  }

  /**
   * Unsubscribe from progress updates for a specific session
   */
  public offProgress(sessionId: string, callback: (update: ProgressUpdate) => void): void {
    this.off(`progress:${sessionId}`, callback);
    console.log(`[ProgressEmitter] offProgress → ${sessionId} (${this.listenerCount(`progress:${sessionId}`)} remaining)`);
  }

  /**
   * Remove all listeners for a session; keep completedSessions flag to prevent re-emits.
   */
  public cleanupSession(sessionId: string): void {
    this.removeAllListeners(`progress:${sessionId}`);
    this.lastEmittedEvent.delete(sessionId);
    console.log(`[ProgressEmitter] Cleaned up listeners for session ${sessionId}`);
  }

  /**
   * Force-remove a session (including completedSessions and seq)
   */
  public forceRemoveSession(sessionId: string): void {
    this.removeAllListeners(`progress:${sessionId}`);
    this.completedSessions.delete(sessionId);
    this.lastEmittedEvent.delete(sessionId);
    this.sessionSeq.delete(sessionId);
    console.log(`[ProgressEmitter] Force removed session ${sessionId}`);
  }
}

export const progressEmitter = ProgressEventEmitter.getInstance();
