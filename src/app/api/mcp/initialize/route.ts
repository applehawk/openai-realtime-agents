import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { mcpServerManager } from '@/app/agentConfigs/severstalAssistantAgent';

// Use internal Docker network URL for server-side requests
const AUTH_API_BASE = process.env.AUTH_API_BASE || 'http://multiagent_app:7000/api/v1';

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

    // Fetch container status from backend
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

    // Initialize MCP server
    console.log('[api/mcp/initialize] Initializing MCP server...');
    const mcpServer = await mcpServerManager.initialize(containerStatus);

    if (!mcpServer) {
      return NextResponse.json(
        { error: 'Failed to initialize MCP server' },
        { status: 500 }
      );
    }

    console.log('[api/mcp/initialize] MCP server initialized successfully');

    return NextResponse.json({
      success: true,
      message: 'MCP server initialized successfully',
      containerStatus,
      connected: mcpServerManager.isServerConnected(),
    });
  } catch (error: any) {
    console.error('[api/mcp/initialize] Error:', error);
    return NextResponse.json(
      {
        error: 'Failed to initialize MCP server',
        details: error.message,
        stack: error.stack,
      },
      { status: 500 }
    );
  }
}
