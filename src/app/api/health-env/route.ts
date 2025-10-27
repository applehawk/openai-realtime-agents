import { NextRequest, NextResponse } from 'next/server';

/**
 * Health check endpoint that also shows environment variable status
 * DO NOT use in production with full key exposure - only for debugging
 */
export async function GET(request: NextRequest) {
  const envStatus = {
    NODE_ENV: process.env.NODE_ENV,
    OPENAI_API_KEY_SET: !!process.env.OPENAI_API_KEY,
    OPENAI_API_KEY_LENGTH: process.env.OPENAI_API_KEY?.length || 0,
    OPENAI_API_KEY_PREFIX: process.env.OPENAI_API_KEY?.substring(0, 7) || 'NOT_SET', // Only first 7 chars for security
    RAG_SERVER_URL_SET: !!process.env.RAG_SERVER_URL,
    RAG_API_BASE_URL_SET: !!process.env.RAG_API_BASE_URL,
    NEXT_PUBLIC_AUTH_API_URL: process.env.NEXT_PUBLIC_AUTH_API_URL,
    timestamp: new Date().toISOString(),
  };

  return NextResponse.json({
    status: 'ok',
    environment: envStatus,
  });
}

