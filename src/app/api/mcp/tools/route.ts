/**
 * API endpoint to check MCP server tools via SDK
 * GET /api/mcp/tools - Get list of available MCP tools using @openai/agents SDK
 *
 * Note: FastMCP with --transport http uses SSE and requires a stateful session.
 * We cannot use simple HTTP POST - must use the SDK to establish SSE connection.
 */

import { NextRequest, NextResponse } from 'next/server';
import { MCPServerStreamableHttp } from '@openai/agents';
import { cookies } from 'next/headers';

const AUTH_API_BASE = process.env.AUTH_API_BASE || 'http://multiagent_app:7000/api/v1';

export async function GET(req: NextRequest) {
  try {
    // Get container name from query params or use default
    const searchParams = req.nextUrl.searchParams;
    const containerName = searchParams.get('container') || 'mcpgoogle';

    // For server-side calls, use internal Docker network URL
    const mcpUrl = `http://${containerName}:8000/mcp`;

    console.log(`[MCP Tools Check] Checking tools from INTERNAL URL: ${mcpUrl}`);

    // Get access token for authentication
    const cookieStore = await cookies();
    const accessToken = cookieStore.get('access_token')?.value;

    if (!accessToken) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    // Fetch container status to verify it's running
    console.log('[MCP Tools Check] Fetching container status...');
    const statusResponse = await fetch(`${AUTH_API_BASE}/containers/status`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });

    if (!statusResponse.ok) {
      const error = await statusResponse.json();
      return NextResponse.json(
        { error: 'Failed to fetch container status', details: error },
        { status: statusResponse.status }
      );
    }

    const containerStatus = await statusResponse.json();
    console.log('[MCP Tools Check] Container status:', containerStatus);

    if (!containerStatus.running) {
      return NextResponse.json(
        {
          success: false,
          error: 'Container is not running',
          containerStatus
        },
        { status: 503 }
      );
    }

    // Use actual container name from status
    const actualContainerName = containerStatus.container_name || containerName;
    const actualMcpUrl = `http://${actualContainerName}:8000/mcp`;

    // Create temporary MCP server instance to fetch tools
    console.log(`[MCP Tools Check] Creating MCP server instance for ${actualMcpUrl} (container: ${actualContainerName})`);
    const mcpServer = new MCPServerStreamableHttp({
      url: actualMcpUrl,
      name: actualContainerName,
    });

    // Try to connect and get tools list
    // Note: MCP server must be connected before listing tools
    try {
      console.log('[MCP Tools Check] Connecting to MCP server...');

      // Connect to the MCP server (establishes SSE session)
      if (mcpServer.connect && typeof mcpServer.connect === 'function') {
        await mcpServer.connect();
        console.log('[MCP Tools Check] Connected successfully');
      } else {
        console.log('[MCP Tools Check] No connect() method, attempting direct list');
      }

      console.log('[MCP Tools Check] Listing tools...');
      const tools = await mcpServer.listTools();

      console.log(`[MCP Tools Check] Successfully retrieved ${tools.length} tools`);

      return NextResponse.json({
        success: true,
        url: actualMcpUrl,
        containerName: actualContainerName,
        toolCount: tools.length,
        tools: tools.map((tool: any) => ({
          name: tool.name,
          description: tool.description,
          inputSchema: tool.inputSchema,
        })),
      });

    } catch (toolError: any) {
      console.error('[MCP Tools Check] Error:', toolError);

      return NextResponse.json(
        {
          success: false,
          error: 'Failed to get tools from MCP server',
          details: toolError.message,
          url: actualMcpUrl,
          containerName: actualContainerName,
          note: 'FastMCP uses SSE transport. SDK needs to establish connection first.',
        },
        { status: 500 }
      );
    }

  } catch (error) {
    console.error('[MCP Tools Check] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      },
      { status: 500 }
    );
  }
}
