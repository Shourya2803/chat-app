import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.BACKEND_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const backendPath = `${BACKEND_URL}${request.nextUrl.pathname}${request.nextUrl.search}`;
    const headers: Record<string, string> = {};
    for (const [k, v] of request.headers) if (v) headers[k] = v;

    const res = await fetch(backendPath, { method: request.method, headers });
    const body = await res.arrayBuffer();
    const responseHeaders = new Headers(res.headers);
    responseHeaders.delete('transfer-encoding');
    return new NextResponse(body, { status: res.status, headers: responseHeaders });
  } catch (error) {
    console.error('Proxy get user error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
