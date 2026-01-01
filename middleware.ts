import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

const CANONICAL_HOST = "serviceops-ai.vercel.app";

function enforceCanonicalHost(request: any) {
  // Only enforce on Vercel production to avoid breaking local dev and previews
  if (process.env.VERCEL_ENV !== "production") return null;

  const host = request.headers.get("host") || "";
  if (!host || host === CANONICAL_HOST) return null;

  const url = request.nextUrl.clone();
  url.protocol = "https";
  url.host = CANONICAL_HOST;
  return url;
}



/**
 * Middleware should ONLY keep the session fresh.
 * OAuth code exchange happens in /auth/callback (route handler),
 * otherwise middleware can accidentally strip the code and break login.
 */
export async function middleware(request: NextRequest) {
  
  const canonical = enforceCanonicalHost(request);
  if (canonical) return NextResponse.redirect(canonical, 308);
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
