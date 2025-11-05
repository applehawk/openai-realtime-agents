import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

const AUTH_API_BASE = process.env.NEXT_PUBLIC_AUTH_API_URL || 'https://rndaibot.ru/apib/v1/';

export async function DELETE(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const accessToken = cookieStore.get('access_token')?.value;

    if (!accessToken) {
      return NextResponse.json(
        { detail: 'Not authenticated' },
        { status: 401 }
      );
    }

    // Get service from query param (default to 'all')
    const service = request.nextUrl.searchParams.get('service') || 'all';

    // Call backend to disconnect Google
    const response = await fetch(`${AUTH_API_BASE}google/disconnect/${service}`, {
      method: 'DELETE',
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
    console.error('Disconnect Google error:', error);
    const message = error instanceof Error ? error.message : 'Failed to disconnect Google';
    return NextResponse.json(
      { detail: message },
      { status: 500 }
    );
  }
}
