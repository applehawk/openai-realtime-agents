import { NextRequest, NextResponse } from 'next/server';

const RAG_SERVER_URL = process.env.RAG_SERVER_URL || 'http://79.132.139.57:8000/mcp';

/**
 * Proxy endpoint for RAG MCP server calls
 * This allows client-side code to make RAG requests through the server,
 * avoiding CORS and mixed content issues.
 */
export async function POST(request: NextRequest) {
  // Forward the request to RAG MCP server
  // Увеличиваем таймаут до 60 секунд для медленных запросов
  const timeout = parseInt(process.env.RAG_API_TIMEOUT || '60000');
  
  try {
    const body = await request.json();

    console.log('[RAG Proxy] Received request:', {
      method: body.method,
      toolName: body.params?.name,
      query: body.params?.arguments?.query?.substring(0, 50),
      workspace: body.params?.arguments?.workspace,
      mode: body.params?.arguments?.mode,
    });

    // Log full request for debugging workspace issues
    console.log('[RAG Proxy] Full request:', JSON.stringify(body, null, 2));

    console.log(`[RAG Proxy] Calling MCP server at ${RAG_SERVER_URL} with timeout ${timeout}ms`);
    
    const response = await fetch(RAG_SERVER_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeout),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[RAG Proxy] MCP server error:', {
        status: response.status,
        error: errorText,
      });

      return NextResponse.json(
        {
          jsonrpc: '2.0',
          id: body.id || 1,
          error: {
            code: -32603,
            message: `RAG server returned status ${response.status}`,
            data: errorText,
          },
        },
        { status: response.status }
      );
    }

    const data = await response.json();

    console.log('[RAG Proxy] Response received:', {
      hasResult: !!data.result,
      hasError: !!data.error,
      contentLength: data.result?.content?.[0]?.text?.length,
      contentPreview: data.result?.content?.[0]?.text?.substring(0, 100),
    });

    // Log full response for debugging workspace issues
    console.log('[RAG Proxy] Full response:', JSON.stringify(data, null, 2));

    return NextResponse.json(data);
  } catch (error: any) {
    console.error('[RAG Proxy] Error:', error);
    console.error('[RAG Proxy] Error details:', {
      name: error.name,
      message: error.message,
      cause: error.cause,
      stack: error.stack?.substring(0, 500),
    });

    // Проверяем, является ли ошибка таймаутом или проблемой подключения
    const isTimeout = error.name === 'TimeoutError' || error.message.includes('timeout') || error.message.includes('aborted');
    const isConnectionError = error.message.includes('Failed to fetch') || 
                              error.message.includes('ECONNREFUSED') || 
                              error.message.includes('ENOTFOUND');

    let errorMessage = 'Internal server error';
    if (isTimeout) {
      errorMessage = `RAG MCP server timeout: сервер не отвечает в течение ${timeout}ms. Проверьте доступность сервера по адресу ${RAG_SERVER_URL}`;
    } else if (isConnectionError) {
      errorMessage = `RAG MCP server connection failed: не удалось подключиться к ${RAG_SERVER_URL}. Проверьте, что сервер запущен и доступен.`;
    }

    return NextResponse.json(
      {
        jsonrpc: '2.0',
        id: 1,
        error: {
          code: -32603,
          message: errorMessage,
          data: error.message,
        },
      },
      { status: 500 }
    );
  }
}

/**
 * Health check endpoint
 */
export async function GET() {
  try {
    const response = await fetch('http://host.docker.internal:8000', {
      method: 'GET',
      signal: AbortSignal.timeout(5000),
    });

    const data = await response.json();

    return NextResponse.json({
      status: 'ok',
      ragServer: data,
      proxyUrl: '/api/rag',
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        status: 'error',
        error: error.message,
      },
      { status: 500 }
    );
  }
}
