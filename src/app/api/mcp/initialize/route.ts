import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

// Use internal Docker network URL for server-side requests
const AUTH_API_BASE = process.env.AUTH_API_BASE || 'http://multiagent_app:7000/api/v1';

/**
 * NOTE: This endpoint is for testing purposes only.
 *
 * Actual MCP initialization happens CLIENT-SIDE in UserProfile.tsx via:
 * - initializeMCPServersBeforeAgent()
 * - mcpServerManager.fetchAndInitialize()
 * - Agent recreation with connected MCP servers
 *
 * This endpoint just verifies container status from server-side.
 */
export async function POST(_request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const accessToken = cookieStore.get('access_token')?.value;

    if (!accessToken) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    console.log('[api/mcp/initialize] Fetching container status...');

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
    console.log('[api/mcp/initialize] Container status:', containerStatus);

    if (!containerStatus.running || !containerStatus.port) {
      return NextResponse.json(
        { error: 'Container is not running or port is not available', containerStatus },
        { status: 503 }
      );
    }

    // Container is ready - actual MCP initialization happens client-side
    const isReady = containerStatus.running && containerStatus.health === 'healthy';

    console.log('[api/mcp/initialize] Container ready for MCP initialization:', isReady);

    return NextResponse.json({
      success: true,
      message: 'Container is ready. MCP initialization happens client-side via initializeMCPServersBeforeAgent()',
      containerStatus,
      ready: isReady,
      note: 'Client-side code in UserProfile.tsx will create and connect MCP server, then recreate agent',
    });
  } catch (error: any) {
    console.error('[api/mcp/initialize] Error:', error);
    return NextResponse.json(
      {
        error: 'Failed to check container status',
        details: error.message,
        stack: error.stack,
      },
      { status: 500 }
    );
  }
}
