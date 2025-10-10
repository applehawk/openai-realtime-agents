import { NextRequest, NextResponse } from 'next/server';
import { authClient } from '@/app/lib/authClient';
import { cookies } from 'next/headers';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const code = searchParams.get('code');
    const state = searchParams.get('state');

    if (!code || !state) {
      return NextResponse.redirect(new URL('/auth/login?error=missing_params', request.url));
    }

    const cookieStore = await cookies();
    const accessToken = cookieStore.get('access_token')?.value;

    if (!accessToken) {
      return NextResponse.redirect(new URL('/auth/login?error=not_authenticated', request.url));
    }

    // Handle OAuth callback with auth server
    await authClient.handleGoogleCallback(code, state, accessToken);

    // Redirect back to home page
    return NextResponse.redirect(new URL('/?google_connected=true', request.url));
  } catch (error) {
    console.error('Google OAuth callback error:', error);
    return NextResponse.redirect(new URL('/?error=google_auth_failed', request.url));
  }
}
