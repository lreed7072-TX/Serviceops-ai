import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

export async function middleware(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // If env vars aren't present, do nothing.
  if (!supabaseUrl || !supabaseAnon) {
    return NextResponse.next();
  }

  const url = request.nextUrl.clone();
  const code = url.searchParams.get("code");

  // If we have an OAuth code, we MUST set cookies on the *redirect response*
  // (previous version set cookies on a NextResponse.next(), then replaced the response).
  if (code && request.nextUrl.pathname !== "/auth/callback") {
    url.searchParams.delete("code");
    url.searchParams.delete("state");

    const response = NextResponse.redirect(url);

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

    await supabase.auth.exchangeCodeForSession(code);
    return response;
  }

  // Normal request: refresh session if needed (safe even when logged out)
  const response = NextResponse.next({
    request: { headers: request.headers },
  });

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
