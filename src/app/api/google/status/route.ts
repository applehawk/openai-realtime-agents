import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

// Use internal Docker network URL for server-side requests
const AUTH_API_BASE = process.env.AUTH_API_BASE || 'http://multiagent_app:7000/api/v1';

export async function GET(_request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const accessToken = cookieStore.get('access_token')?.value;

    if (!accessToken) {
      return NextResponse.json(
        { detail: 'Not authenticated' },
        { status: 401 }
      );
    }

    // Call backend to get Google status
    const response = await fetch(`${AUTH_API_BASE}/google/status`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      const error = await response.json();
      return NextResponse.json(error, { status: response.status });
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Get Google status error:', error);
    const message = error instanceof Error ? error.message : 'Failed to get Google status';
    return NextResponse.json(
      { detail: message },
      { status: 500 }
    );
  }
}
