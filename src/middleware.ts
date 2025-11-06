import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const origin = request.headers.get('origin') || '';
  const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || [];
  const { pathname } = request.nextUrl;

  const response = NextResponse.next();

  // CORS headers only needed for cross-origin requests from browser
  // Same-origin requests (e.g., localhost to localhost) don't need CORS
  // Server-to-server requests (Next.js → backend) don't need CORS
  if (pathname.startsWith('/api/') && origin && allowedOrigins.length > 0) {
    if (allowedOrigins.includes(origin)) {
      // Cross-origin request with allowed origin - add CORS headers
      response.headers.set('Access-Control-Allow-Origin', origin);
      response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
      response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
      response.headers.set('Access-Control-Allow-Credentials', 'true');
    }
  }

  // Handle preflight OPTIONS requests (only for cross-origin)
  if (request.method === 'OPTIONS' && pathname.startsWith('/api/') && origin && allowedOrigins.length > 0 && allowedOrigins.includes(origin)) {
    return new Response(null, {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': origin,
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Credentials': 'true',
      },
    });
  }

  // Public paths that don't require authentication
  const publicPaths = ['/auth/login', '/auth/register', '/api/auth/login', '/api/auth/register'];
  const isPublicPath = publicPaths.some(path => pathname.startsWith(path));

  // Get access token from cookies
  const accessToken = request.cookies.get('access_token')?.value;

  // If trying to access protected route without token, redirect to login
  if (!isPublicPath && !accessToken && !pathname.startsWith('/api/')) {
    return NextResponse.redirect(new URL('/auth/login', request.url));
  }

  // If trying to access auth pages while logged in, redirect to home
  if (isPublicPath && accessToken && pathname.startsWith('/auth/')) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - static (static directory)
     */
    '/((?!_next/static|_next/image|favicon.ico|static).*)',
  ],
};
