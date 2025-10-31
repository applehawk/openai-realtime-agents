import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

const AUTH_API_BASE = process.env.NEXT_PUBLIC_AUTH_API_URL || 'https://rndaibot.ru/apib/v1/';

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

    // Get return URL from header or query param
    const returnUrl = request.headers.get('X-Return-URL') || request.nextUrl.searchParams.get('return_url') || '/';

    // Call backend to get Google auth URL
    const response = await fetch(`${AUTH_API_BASE}google/auth/url`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'X-Return-URL': returnUrl,
      },
    });

    if (!response.ok) {
      const error = await response.json();
      return NextResponse.json(error, { status: response.status });
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Get Google auth URL error:', error);
    const message = error instanceof Error ? error.message : 'Failed to get auth URL';
    return NextResponse.json(
      { detail: message },
      { status: 500 }
    );
  }
}

