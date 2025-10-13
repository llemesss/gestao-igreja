import { NextRequest, NextResponse } from 'next/server';

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Evitar ruído no dev: requisições spúrias a "/@vite/*" retornam 204
  if (pathname.startsWith('/@vite/')) {
    return new Response(null, { status: 204 });
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};