import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { checkRateLimit } from "@/lib/rate-limit";

const CANONICAL_HOST = "serviceops-ai.vercel.app";

function enforceCanonicalHost(request: NextRequest) {
  // Only enforce on Vercel production to avoid breaking local dev and previews
  if (process.env.VERCEL_ENV !== "production") return null;

  const host = request.headers.get("host") || "";
  if (!host || host === CANONICAL_HOST) return null;

  const url = request.nextUrl.clone();
  url.protocol = "https";
  url.host = CANONICAL_HOST;
  return url;
}

// ── Rate limit configuration ───────────────────────────────────

const ONE_MINUTE = 60 * 1000;

interface RateLimitTier {
  limit: number;
  windowMs: number;
}

function getRateLimitTier(pathname: string): RateLimitTier {
  // AI generation endpoints – 10/min
  if (/\/api\/work-orders\/.*\/ai-generate/.test(pathname)) {
    return { limit: 10, windowMs: ONE_MINUTE };
  }
  // Email endpoints – 10/min
  if (
    /\/api\/.*\/email/.test(pathname) ||
    pathname === "/api/settings/test-email"
  ) {
    return { limit: 10, windowMs: ONE_MINUTE };
  }
  // Export endpoints – 5/min
  if (pathname === "/api/analytics/export") {
    return { limit: 5, windowMs: ONE_MINUTE };
  }
  // Auth & invite endpoints – 20/min
  if (pathname.startsWith("/api/auth/") || pathname.startsWith("/api/invites/")) {
    return { limit: 20, windowMs: ONE_MINUTE };
  }
  // General API – 100/min
  if (pathname.startsWith("/api/")) {
    return { limit: 100, windowMs: ONE_MINUTE };
  }
  // Non-API routes are not rate-limited
  return { limit: 0, windowMs: 0 };
}

function getClientIp(request: NextRequest): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
    request.headers.get("x-real-ip") ||
    "unknown"
  );
}

// ── CSRF (Origin) validation ────────────────────────────────────

const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

function csrfCheck(request: NextRequest): NextResponse | null {
  if (!MUTATING_METHODS.has(request.method)) return null;
  if (!request.nextUrl.pathname.startsWith("/api/")) return null;

  const origin = request.headers.get("origin");

  // Allow requests with no Origin header (non-browser clients, mobile apps)
  if (!origin) return null;

  const host = request.headers.get("host") || "";
  try {
    const originHost = new URL(origin).host;
    if (originHost === host) return null;
  } catch {
    // Malformed origin header – reject
  }

  return NextResponse.json(
    { error: "Forbidden: cross-origin request" },
    { status: 403 }
  );
}

// ── Main middleware ─────────────────────────────────────────────

/**
 * Middleware should ONLY keep the session fresh.
 * OAuth code exchange happens in /auth/callback (route handler),
 * otherwise middleware can accidentally strip the code and break login.
 */
export async function middleware(request: NextRequest) {
  // 1. Canonical host redirect
  const canonical = enforceCanonicalHost(request);
  if (canonical) return NextResponse.redirect(canonical, 308);

  const pathname = request.nextUrl.pathname;

  // 2. CSRF check for mutating API requests
  const csrfBlock = csrfCheck(request);
  if (csrfBlock) return csrfBlock;

  // 3. Rate limiting for API routes
  const tier = getRateLimitTier(pathname);
  if (tier.limit > 0) {
    const ip = getClientIp(request);
    const bucket = pathname.startsWith("/api/auth/")
      ? "auth"
      : pathname.startsWith("/api/invites/")
        ? "invites"
        : /\/api\/work-orders\/.*\/ai-generate/.test(pathname)
          ? "ai"
          : /\/api\/.*\/email/.test(pathname) ||
              pathname === "/api/settings/test-email"
            ? "email"
            : pathname === "/api/analytics/export"
              ? "export"
              : "api";

    const key = `${ip}:${bucket}`;
    const result = checkRateLimit(key, tier.limit, tier.windowMs);

    if (!result.allowed) {
      return NextResponse.json(
        { error: "Too many requests" },
        {
          status: 429,
          headers: {
            "Retry-After": String(result.retryAfterSeconds),
            "X-RateLimit-Limit": String(tier.limit),
            "X-RateLimit-Remaining": "0",
          },
        }
      );
    }
  }

  // 4. Supabase session refresh
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  const response = NextResponse.next({
    request: { headers: request.headers },
  });

  if (!supabaseUrl || !supabaseAnon) return response;

  const supabase = createServerClient(supabaseUrl, supabaseAnon, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  await supabase.auth.getUser();
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
