import { NextRequest, NextResponse } from 'next/server';
import { authClient } from '@/app/lib/authClient';
import { cookies } from 'next/headers';

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

    // Get Google status from auth server
    const status = await authClient.getGoogleStatus(accessToken);

    return NextResponse.json(status);
  } catch (error) {
    console.error('Get Google status error:', error);
    const message = error instanceof Error ? error.message : 'Failed to get Google status';
    return NextResponse.json(
      { detail: message },
      { status: 500 }
    );
  }
}
