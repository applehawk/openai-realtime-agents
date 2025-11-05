import { NextRequest, NextResponse } from 'next/server';

const RAG_API_BASE_URL = process.env.RAG_API_BASE_URL || 'http://79.132.139.57:9621';
const RAG_API_TIMEOUT = parseInt(process.env.RAG_API_TIMEOUT || '30000');

/**
 * Proxy endpoint for RAG REST API calls
 * This allows client-side code (realtime tools) to make RAG REST API requests through the server,
 * avoiding CORS and environment variable access issues.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { endpoint, method, data } = body;

    if (!endpoint || !method) {
      return NextResponse.json(
        { error: 'Missing endpoint or method' },
        { status: 400 }
      );
    }

    console.log(`[RAG REST Proxy] ${method} ${endpoint}`, data ? { dataKeys: Object.keys(data) } : {});

    const url = `${RAG_API_BASE_URL}${endpoint}`;
    const response = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
      },
      body: data ? JSON.stringify(data) : undefined,
      signal: AbortSignal.timeout(RAG_API_TIMEOUT),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[RAG REST Proxy] Error ${response.status}:`, errorText);
      return NextResponse.json(
        { error: `RAG API error: ${response.status} - ${errorText}` },
        { status: response.status }
      );
    }

    const result = await response.json();
    console.log(`[RAG REST Proxy] Success:`, { endpoint, hasData: !!result });
    
    return NextResponse.json(result);
  } catch (error: any) {
    console.error(`[RAG REST Proxy] Network error:`, error);
    
    // Check if it's a network connectivity issue
    if (error.message.includes('Failed to fetch') || error.message.includes('ECONNREFUSED')) {
      console.error(`[RAG REST Proxy] Server appears to be down at ${RAG_API_BASE_URL}`);
    }
    
    return NextResponse.json(
      { error: `RAG API connection failed: ${error.message}` },
      { status: 500 }
    );
  }
}

/**
 * Health check endpoint
 */
export async function GET() {
  try {
    const response = await fetch(`${RAG_API_BASE_URL}/workspaces`, {
      method: 'GET',
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) {
      throw new Error(`RAG API returned status ${response.status}`);
    }

    const data = await response.json();

    return NextResponse.json({
      status: 'ok',
      ragApiUrl: RAG_API_BASE_URL,
      workspacesCount: Array.isArray(data) ? data.length : (data.workspaces?.length || 0),
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        status: 'error',
        error: error.message,
        ragApiUrl: RAG_API_BASE_URL,
      },
      { status: 500 }
    );
  }
}

