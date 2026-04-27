import { NextResponse, type NextRequest } from 'next/server';

// In-memory IP rate limiter for /api/*. Per-region on Vercel Edge --
// resets on cold start. Enough to deter casual scraping without adding
// Redis. Upgrade to Upstash if traffic grows.
const WINDOW_MS = 60_000;
const MAX_REQUESTS = 60;

const buckets = new Map<string, { count: number; resetAt: number }>();

function getClientIp(req: NextRequest): string {
  const xff = req.headers.get('x-forwarded-for');
  if (xff) return xff.split(',')[0].trim();
  return req.headers.get('x-real-ip') || 'unknown';
}

export function middleware(request: NextRequest) {
  const ip = getClientIp(request);
  const now = Date.now();
  const bucket = buckets.get(ip);

  if (!bucket || bucket.resetAt < now) {
    buckets.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return NextResponse.next();
  }

  if (bucket.count >= MAX_REQUESTS) {
    const retryAfter = Math.ceil((bucket.resetAt - now) / 1000);
    return new NextResponse(
      JSON.stringify({ error: 'Rate limit exceeded. Try again shortly.' }),
      {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          'Retry-After': String(retryAfter),
        },
      }
    );
  }

  bucket.count += 1;
  return NextResponse.next();
}

export const config = {
  matcher: '/api/:path*',
};
