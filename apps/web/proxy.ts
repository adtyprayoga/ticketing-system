import { NextResponse, type NextRequest } from 'next/server';

// Forwards /api/* to Express so session cookies stay same-origin. Read at request time, not
// baked in at build time like next.config rewrites, so one image works wherever API_ORIGIN points.
export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const apiOrigin = process.env.API_ORIGIN ?? 'http://localhost:4000';
  return NextResponse.rewrite(new URL(pathname + search, apiOrigin));
}

export const config = { matcher: '/api/:path*' };
