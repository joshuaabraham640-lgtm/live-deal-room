import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get('userId') || 'client_lead';
  const tokens: Record<string, string> = JSON.parse(
    process.env.NEXCONN_TEST_TOKENS || '{}'
  );

  const token = tokens[userId];
  if (!token) {
    return NextResponse.json(
      { error: `No token found for userId: ${userId}` },
      { status: 400 }
    );
  }

  return NextResponse.json({
    userId,
    token,
    appKey: process.env.NEXT_PUBLIC_NEXCONN_APP_KEY,
  });
}