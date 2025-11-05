import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

const AUTH_API_BASE = process.env.NEXT_PUBLIC_AUTH_API_URL || 'https://rndaibot.ru/apib/v1/';

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

    // Call OMA Backend to get container status
    const response = await fetch(`${AUTH_API_BASE}containers/status`, {
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
    console.error('Get container status error:', error);
    const message = error instanceof Error ? error.message : 'Failed to get status';
    return NextResponse.json(
      { detail: message },
      { status: 500 }
    );
  }
}
