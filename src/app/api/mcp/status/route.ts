import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

const AUTH_API_BASE = process.env.AUTH_API_BASE || 'http://multiagent_app:7000/api/v1';

export async function GET(_request: NextRequest) {
  try {
    // Get access token for authentication
    const cookieStore = await cookies();
    const accessToken = cookieStore.get('access_token')?.value;

    if (!accessToken) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    // Fetch container status from backend (server-to-server)
    const response = await fetch(`${AUTH_API_BASE}/containers/status`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      const error = await response.json();
      return NextResponse.json(
        { error: 'Failed to fetch container status', details: error },
        { status: response.status }
      );
    }

    const containerStatus = await response.json();

    return NextResponse.json({
      connected: containerStatus.running && containerStatus.health === 'healthy',
      containerStatus,
    });
  } catch (error: any) {
    console.error('[api/mcp/status] Error:', error);
    return NextResponse.json(
      {
        error: 'Failed to get MCP status',
        details: error.message,
      },
      { status: 500 }
    );
  }
}
