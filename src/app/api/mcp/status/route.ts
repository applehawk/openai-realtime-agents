import { NextResponse } from 'next/server';
import { mcpServerManager } from '@/app/agentConfigs/severstalAssistantAgent';

export async function GET() {
  try {
    const isConnected = mcpServerManager.isServerConnected();
    const containerStatus = mcpServerManager.getContainerStatus();

    return NextResponse.json({
      connected: isConnected,
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
