import { NextRequest, NextResponse } from 'next/server';

const RAG_SERVER_URL = 'http://host.docker.internal:8000/mcp';

/**
 * Proxy endpoint for RAG MCP server calls
 * This allows client-side code to make RAG requests through the server,
 * avoiding CORS and mixed content issues.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    console.log('[RAG Proxy] Received request:', {
      method: body.method,
      toolName: body.params?.name,
      query: body.params?.arguments?.query?.substring(0, 50),
    });

    // Forward the request to RAG MCP server
    const response = await fetch(RAG_SERVER_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(30000), // 30 second timeout
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
    });

    return NextResponse.json(data);
  } catch (error: any) {
    console.error('[RAG Proxy] Error:', error);

    return NextResponse.json(
      {
        jsonrpc: '2.0',
        id: 1,
        error: {
          code: -32603,
          message: 'Internal server error',
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
