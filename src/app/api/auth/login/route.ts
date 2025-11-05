import { NextRequest, NextResponse } from 'next/server';
import { authClient } from '@/app/lib/authClient';
import { cookies } from 'next/headers';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { username, password } = body;

    if (!username || !password) {
      return NextResponse.json(
        { detail: 'Username and password are required' },
        { status: 400 }
      );
    }

    // Call auth server
    const tokenData = await authClient.login({ username, password });

    // Get user info
    const user = await authClient.getCurrentUser(tokenData.access_token);

    // Set httpOnly cookies for tokens
    const cookieStore = await cookies();

    cookieStore.set('access_token', tokenData.access_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 15, // 15 minutes
      path: '/',
    });

    cookieStore.set('refresh_token', tokenData.refresh_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: '/',
    });

    // Return user data (without tokens)
    return NextResponse.json({ user });
  } catch (error) {
    console.error('Login error:', error);
    const message = error instanceof Error ? error.message : 'Login failed';
    return NextResponse.json(
      { detail: message },
      { status: 401 }
    );
  }
}
