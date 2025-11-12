/**
 * SSE endpoint for progress streaming — Next.js route
 * GET /api/supervisor/unified/stream?sessionId=xxx
 *
 * Version: 1.1
 * Date: 2025-11-12
 */

import { NextRequest } from 'next/server';
import { progressEmitter, ProgressUpdate } from '../progressEmitter';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const sessionId = req.nextUrl.searchParams.get('sessionId');

  if (!sessionId) {
    return new Response(JSON.stringify({ error: 'Missing sessionId parameter' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  console.log(`[SSE Stream] Client connected for session: ${sessionId}`);

  const encoder = new TextEncoder();
  let isClosed = false;
  let controller: ReadableStreamDefaultController<Uint8Array> | undefined;

  // --- Progress handler reference (declared early for cleanup) ---
  const progressHandler = (update: ProgressUpdate) => {
    if (isClosed || !controller) return;

    try {
      // Send update with sequence ID in the data payload only
      // Do NOT use SSE 'id:' field - it's for browser reconnection logic
      const dataLine = `data: ${JSON.stringify(update)}\n\n`;
      controller.enqueue(encoder.encode(dataLine));

      console.log(`[SSE Stream] Sent update [${update.id}] type=${update.type} progress=${update.progress}%`);

      // If update finishes the task, schedule cleanup shortly after sending
      if (update.type === 'completed' || update.type === 'error') {
        setTimeout(() => cleanup('task_finished'), 1000);
      }
    } catch (error) {
      console.error('[SSE Stream] Error sending update:', error);
      cleanup('handler_error');
    }
  };

  // --- Cleanup wrapper ---
  const cleanup = (() => {
    let called = false;
    return (reason: string) => {
      if (called) return;
      called = true;
      isClosed = true;

      try {
        progressEmitter.offProgress(sessionId, progressHandler);
      } catch (e) {
        // ignore
      }

      // Do not force-remove session from completedSessions here; we want to keep completedSessions
      try {
        controller?.close();
      } catch {}

      console.log(`[SSE Stream] Cleaned up session ${sessionId} (${reason})`);
    };
  })();

  const stream = new ReadableStream({
    start(ctrl) {
      controller = ctrl;

      // Subscribe to updates for this session
      progressEmitter.onProgress(sessionId, progressHandler);

      // Send an initial 'connected' event
      // Use seq=0 as initial event (before any real progress events)
      const initial: ProgressUpdate = {
        sessionId,
        type: 'connected' as ProgressUpdate['type'],
        message: 'Connected to progress stream',
        progress: 0,
        timestamp: Date.now(),
        id: 0, // Initial connection has id=0
      };

      const dataLine = `data: ${JSON.stringify(initial)}\n\n`;
      try {
        controller.enqueue(encoder.encode(dataLine));
        console.log(`[SSE Stream] Sent initial connection event for session: ${sessionId}`);
      } catch (e) {
        console.warn('[SSE Stream] initial enqueue failed, aborting', e);
        cleanup('initial_enqueue_failed');
        return;
      }
      
      // Register abort handler (client disconnect)
      const abortHandler = () => cleanup('abort');
      req.signal.addEventListener('abort', abortHandler);

      // Keep-alive ping comment/event to prevent some proxies from timing out
      const keepAlive = setInterval(() => {
        if (isClosed) {
          clearInterval(keepAlive);
          return;
        }
        try {
          // use comment (:) or a ping event — here we send an 'event: ping' to allow client to differentiate
          controller?.enqueue(encoder.encode('event: ping\ndata: keep-alive\n\n'));
        } catch (error) {
          console.error('[SSE Stream] Keep-alive error:', error);
          clearInterval(keepAlive);
          cleanup('keepalive_error');
        }
      }, 30_000);
    },

    cancel() {
      cleanup('cancel');
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
