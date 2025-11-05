import { NextResponse } from 'next/server';

/**
 * Generate CORS headers for cross-origin requests
 * Only returns headers if ALLOWED_ORIGINS is configured and the origin is allowed
 * For same-origin requests (e.g., localhost to localhost), no CORS headers are needed
 */
export function corsHeaders(origin?: string): Record<string, string> {
  // No CORS if ALLOWED_ORIGINS is not configured or origin is missing
  if (!origin || !process.env.ALLOWED_ORIGINS?.trim()) {
    return {};
  }

  // Check if origin is in the allowed list
  const allowedOrigins = process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim());
  if (!allowedOrigins.includes(origin)) {
    return {};
  }

  // Return CORS headers for allowed origin
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Credentials': 'true',
  };
}

/**
 * Apply CORS headers to a NextResponse
 * Only applies headers if CORS is configured and the origin is allowed
 */
export function corsResponse(response: NextResponse, origin?: string): NextResponse {
  const headers = corsHeaders(origin);
  Object.entries(headers).forEach(([key, value]) => {
    response.headers.set(key, value);
  });
  return response;
}