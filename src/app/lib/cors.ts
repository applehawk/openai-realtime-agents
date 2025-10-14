import { NextResponse } from 'next/server';

export function corsHeaders(origin?: string) {
  const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'];
  const requestOrigin = origin || '';
  
  return {
    'Access-Control-Allow-Origin': allowedOrigins.includes(requestOrigin) 
      ? requestOrigin 
      : allowedOrigins[0],
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Credentials': 'true',
  };
}


export function corsResponse(response: NextResponse, origin?: string) {
  const headers = corsHeaders(origin);
  Object.entries(headers).forEach(([key, value]) => {
    response.headers.set(key, value);
  });
  return response;
}