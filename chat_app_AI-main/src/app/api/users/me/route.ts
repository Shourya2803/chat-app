import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.BACKEND_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export const dynamic = 'force-dynamic';

async function proxy(req: NextRequest) {
  const backendPath = `${BACKEND_URL}${req.nextUrl.pathname}${req.nextUrl.search}`;
  const headers: Record<string, string> = {};
  for (const [k, v] of req.headers) if (v) headers[k] = v;

  try {
    const init: RequestInit = { method: req.method, headers };
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      const text = await req.text();
      if (text) init.body = text;
    }

    const res = await fetch(backendPath, init);
    const body = await res.arrayBuffer();
    const responseHeaders = new Headers(res.headers);
    responseHeaders.delete('transfer-encoding');
    return new NextResponse(body, { status: res.status, headers: responseHeaders });
  } catch (err: any) {
    return NextResponse.json({ error: 'Backend unreachable', details: String(err?.message || err) }, { status: 502 });
  }
}

export const GET = proxy;
export const POST = proxy;
export const PUT = proxy;
export const DELETE = proxy;
