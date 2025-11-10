import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

// Use internal Docker network URL for server-side requests
const AUTH_API_BASE = process.env.AUTH_API_BASE || 'http://multiagent_app:7000/api/v1';

export async function POST(_request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const accessToken = cookieStore.get('access_token')?.value;

    if (!accessToken) {
      return NextResponse.json(
        { detail: 'Not authenticated' },
        { status: 401 }
      );
    }

    // Call OMA Backend to start container
    const response = await fetch(`${AUTH_API_BASE}/containers/start`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const error = await response.json();
      return NextResponse.json(error, { status: response.status });
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Start container error:', error);
    const message = error instanceof Error ? error.message : 'Failed to start container';
    return NextResponse.json(
      { detail: message },
      { status: 500 }
    );
  }
}
