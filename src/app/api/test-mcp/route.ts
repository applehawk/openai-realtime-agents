import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const mcpServerUrl = 'http://host.docker.internal:8000';

  try {
    console.log(`Testing connection to MCP server at: ${mcpServerUrl}`);

    // Простая проверка доступности сервера
    const response = await fetch(mcpServerUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      // Timeout через AbortSignal
      signal: AbortSignal.timeout(5000),
    });

    const isOk = response.ok;
    const status = response.status;
    const statusText = response.statusText;

    let data;
    try {
      data = await response.text();
    } catch (e) {
      data = 'Could not read response body';
    }

    return NextResponse.json({
      success: isOk,
      status,
      statusText,
      mcpServerUrl,
      message: isOk ? 'MCP server is reachable' : 'MCP server returned an error',
      responsePreview: data.substring(0, 500), // Первые 500 символов ответа
    });

  } catch (error: any) {
    console.error('Error connecting to MCP server:', error);

    return NextResponse.json({
      success: false,
      mcpServerUrl,
      error: error.message || 'Unknown error',
      errorType: error.name || 'Error',
      message: 'Failed to connect to MCP server',
    }, { status: 500 });
  }
}
