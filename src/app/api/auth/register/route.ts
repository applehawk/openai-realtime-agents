import { NextRequest, NextResponse } from 'next/server';
import { authClient } from '@/app/lib/authClient';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { username, email, password } = body;

    if (!username || !email || !password) {
      return NextResponse.json(
        { detail: 'Username, email, and password are required' },
        { status: 400 }
      );
    }

    // Validate password length
    if (password.length < 6) {
      return NextResponse.json(
        { detail: 'Password must be at least 6 characters long' },
        { status: 400 }
      );
    }

    // Validate username length
    if (username.length < 3) {
      return NextResponse.json(
        { detail: 'Username must be at least 3 characters long' },
        { status: 400 }
      );
    }

    // Call auth server
    const result = await authClient.register({ username, email, password });

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    console.error('Registration error:', error);
    const message = error instanceof Error ? error.message : 'Registration failed';
    return NextResponse.json(
      { detail: message },
      { status: 400 }
    );
  }
}
