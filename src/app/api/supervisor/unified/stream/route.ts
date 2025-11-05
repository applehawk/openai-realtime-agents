/**
 * SSE (Server-Sent Events) endpoint for real-time progress tracking
 *
 * GET /api/supervisor/unified/stream?sessionId=xxx
 *
 * This endpoint establishes a persistent connection to stream progress updates
 * from IntelligentSupervisor tasks to the frontend in real-time.
 *
 * Version: 1.0
 * Date: 2025-10-23
 */

import { NextRequest } from 'next/server';
import { progressEmitter, ProgressUpdate } from '../progressEmitter';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const sessionId = req.nextUrl.searchParams.get('sessionId');

  if (!sessionId) {
    return new Response(
      JSON.stringify({ error: 'Missing sessionId parameter' }),
      {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }

  console.log(`[SSE Stream] Client connected for session: ${sessionId}`);

  // Create a TransformStream for SSE
  const encoder = new TextEncoder();
  let isClosed = false;

  const stream = new ReadableStream({
    start(controller) {
      // Send initial connection message
      const initialMessage = `data: ${JSON.stringify({
        type: 'connected',
        message: 'Connected to progress stream',
        sessionId,
        timestamp: Date.now(),
      })}\n\n`;
      controller.enqueue(encoder.encode(initialMessage));

      // Progress update handler
      const progressHandler = (update: ProgressUpdate) => {
        if (isClosed) return;

        try {
          const message = `data: ${JSON.stringify(update)}\n\n`;
          controller.enqueue(encoder.encode(message));

          // If task completed or errored, close the stream after a delay
          if (update.type === 'completed' || update.type === 'error') {
            setTimeout(() => {
              if (!isClosed) {
                controller.close();
                isClosed = true;
                progressEmitter.cleanupSession(sessionId);
                console.log(`[SSE Stream] Stream closed for session: ${sessionId}`);
              }
            }, 1000); // 1 second delay to ensure client receives final message
          }
        } catch (error) {
          console.error('[SSE Stream] Error sending update:', error);
        }
      };

      // Subscribe to progress events
      progressEmitter.onProgress(sessionId, progressHandler);

      // Cleanup on client disconnect
      const cleanup = () => {
        if (!isClosed) {
          isClosed = true;
          progressEmitter.offProgress(sessionId, progressHandler);
          progressEmitter.cleanupSession(sessionId);
          console.log(`[SSE Stream] Client disconnected for session: ${sessionId}`);
        }
      };

      // Handle stream abort (client disconnect)
      req.signal.addEventListener('abort', cleanup);

      // Keep-alive ping every 30 seconds
      const keepAliveInterval = setInterval(() => {
        if (isClosed) {
          clearInterval(keepAliveInterval);
          return;
        }
        try {
          controller.enqueue(encoder.encode(': keep-alive\n\n'));
        } catch (error) {
          console.error('[SSE Stream] Keep-alive error:', error);
          clearInterval(keepAliveInterval);
          cleanup();
        }
      }, 30000);
    },

    cancel() {
      isClosed = true;
      console.log(`[SSE Stream] Stream cancelled for session: ${sessionId}`);
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no', // Disable nginx buffering
    },
  });
}
