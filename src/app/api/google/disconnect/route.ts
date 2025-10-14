import { NextRequest, NextResponse } from 'next/server';
import { authClient } from '@/app/lib/authClient';
import { cookies } from 'next/headers';

export async function DELETE(_request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const accessToken = cookieStore.get('access_token')?.value;

    if (!accessToken) {
      return NextResponse.json(
        { detail: 'Not authenticated' },
        { status: 401 }
      );
    }

    // Disconnect Google from auth server
    await authClient.disconnectGoogle(accessToken);

    return NextResponse.json({ message: 'Google disconnected successfully' });
  } catch (error) {
    console.error('Disconnect Google error:', error);
    const message = error instanceof Error ? error.message : 'Failed to disconnect Google';
    return NextResponse.json(
      { detail: message },
      { status: 500 }
    );
  }
}
