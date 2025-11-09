import { NextRequest, NextResponse } from 'next/server';
import { hitlStore } from '../../hitlStore';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sessionId, itemId, decision, modifiedContent, feedback } = body;

    if (!sessionId || !itemId) {
      return NextResponse.json(
        { error: 'Missing sessionId or itemId' },
        { status: 400 }
      );
    }

    console.log('[HITL Approve API] Approving:', { sessionId, itemId, decision });

    const success = hitlStore.resolveApproval(
      itemId,
      decision || 'approved',
      modifiedContent,
      feedback
    );

    if (!success) {
      return NextResponse.json(
        { error: 'Approval not found or already resolved' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[HITL Approve API] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
