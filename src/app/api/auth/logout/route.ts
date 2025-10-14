import { NextRequest, NextResponse } from 'next/server';
import { authClient } from '@/app/lib/authClient';
import { cookies } from 'next/headers';

export async function POST(_request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const refreshToken = cookieStore.get('refresh_token')?.value;

    if (refreshToken) {
      // Call auth server logout
      try {
        await authClient.logout(refreshToken);
      } catch (error) {
        console.error('Auth server logout error:', error);
        // Continue with cookie clearing even if server logout fails
      }
    }

    // Clear cookies
    cookieStore.delete('access_token');
    cookieStore.delete('refresh_token');

    return NextResponse.json({ message: 'Logged out successfully' });
  } catch (error) {
    console.error('Logout error:', error);
    return NextResponse.json(
      { detail: 'Logout failed' },
      { status: 500 }
    );
  }
}
