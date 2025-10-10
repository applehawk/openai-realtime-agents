import { NextRequest, NextResponse } from 'next/server';
import { authClient } from '@/app/lib/authClient';
import { cookies } from 'next/headers';

export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const accessToken = cookieStore.get('access_token')?.value;

    if (!accessToken) {
      return NextResponse.json(
        { detail: 'Not authenticated' },
        { status: 401 }
      );
    }

    // Get user info from auth server
    const user = await authClient.getCurrentUser(accessToken);

    return NextResponse.json(user);
  } catch (error) {
    console.error('Get user error:', error);

    // Try to refresh token
    try {
      const cookieStore = await cookies();
      const refreshToken = cookieStore.get('refresh_token')?.value;

      if (!refreshToken) {
        return NextResponse.json(
          { detail: 'Session expired' },
          { status: 401 }
        );
      }

      // Refresh the access token
      const tokenData = await authClient.refreshToken(refreshToken);

      // Update access token cookie
      cookieStore.set('access_token', tokenData.access_token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 15, // 15 minutes
        path: '/',
      });

      // Get user info with new token
      const user = await authClient.getCurrentUser(tokenData.access_token);
      return NextResponse.json(user);
    } catch (refreshError) {
      console.error('Token refresh failed:', refreshError);
      return NextResponse.json(
        { detail: 'Session expired' },
        { status: 401 }
      );
    }
  }
}
