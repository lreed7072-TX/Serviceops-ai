import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: { headers: request.headers },
  });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnon) {
    return response;
  }

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

  // If Supabase redirects back with a `code` anywhere, exchange it here and remove it from the URL.
  const url = request.nextUrl.clone();
  const code = url.searchParams.get("code");

  if (code) {
    await supabase.auth.exchangeCodeForSession(code);
    url.searchParams.delete("code");
    url.searchParams.delete("state");

    response = NextResponse.redirect(url);
    // Ensure cookies set during exchange are written to the redirect response
    const cookiesToSet = response.cookies.getAll();
    for (const c of cookiesToSet) response.cookies.set(c);
  }

  // Keeps sessions fresh (safe even if not logged in)
  await supabase.auth.getUser();

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
