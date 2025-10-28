/**
 * API Route for MCP Preferences Server
 * 
 * Прокси для нового MCP сервера предпочтений пользователей.
 * Заменяет RAG-based подход на структурированную работу с предпочтениями.
 */

import { NextRequest, NextResponse } from 'next/server';

// MCP Preferences API configuration
const PREFERENCES_MCP_BASE_URL = process.env.PREFERENCES_MCP_BASE_URL || 'http://localhost:3001';
const PREFERENCES_MCP_TIMEOUT = parseInt(process.env.PREFERENCES_MCP_TIMEOUT || '30000');

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    console.log('[PreferencesMCP] Received request:', { 
      toolName: body.tool_name, 
      userId: body.user_id,
      hasParameters: !!body.parameters 
    });

    // Forward request to MCP server directly
    const response = await fetch(`${PREFERENCES_MCP_BASE_URL}/api/v1/mcp/execute`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(PREFERENCES_MCP_TIMEOUT),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[PreferencesMCP] MCP server error ${response.status}:`, errorText);
      
      return NextResponse.json({
        success: false,
        message: `MCP server error: ${response.status}`,
        error: errorText,
      }, { status: response.status });
    }

    const data = await response.json();
    console.log('[PreferencesMCP] MCP server response:', { 
      success: data.success, 
      hasData: !!data.data 
    });

    return NextResponse.json(data);
  } catch (error: any) {
    console.error('[PreferencesMCP] Error:', error);
    
    // Check if it's a connectivity issue
    if (error.message.includes('Failed to fetch') || error.message.includes('ECONNREFUSED')) {
      console.error(`[PreferencesMCP] MCP server appears to be down at ${PREFERENCES_MCP_BASE_URL}`);
      console.error('[PreferencesMCP] Please check if MCP server is running');
      
      return NextResponse.json({
        success: false,
        message: 'MCP server недоступен. Проверьте, что сервер предпочтений запущен.',
        error: 'Connection failed',
      }, { status: 503 });
    }
    
    return NextResponse.json({
      success: false,
      message: `Ошибка обработки запроса: ${error.message}`,
      error: error.message,
    }, { status: 500 });
  }
}

export async function GET() {
  try {
    // Проверяем подключение к MCP серверу
    const healthResponse = await fetch(`${PREFERENCES_MCP_BASE_URL}/apib/health`, {
      method: 'GET',
      signal: AbortSignal.timeout(5000),
    });

    const isHealthy = healthResponse.ok;
    const mcpStatus = isHealthy ? 'connected' : 'disconnected';

    return NextResponse.json({
      message: 'Preferences MCP API Proxy',
      status: 'active',
      mcpServer: PREFERENCES_MCP_BASE_URL,
      mcpStatus,
      timeout: PREFERENCES_MCP_TIMEOUT,
      health: {
        mcp: isHealthy,
        api: true,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error: any) {
    return NextResponse.json({
      message: 'Preferences MCP API Proxy',
      status: 'active',
      mcpServer: PREFERENCES_MCP_BASE_URL,
      mcpStatus: 'disconnected',
      timeout: PREFERENCES_MCP_TIMEOUT,
      health: {
        mcp: false,
        api: true,
        error: error.message,
        timestamp: new Date().toISOString(),
      },
    });
  }
}
