import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

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

  return NextResponse.next();
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
