import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // If we don't have a code, send user back to login.
  if (!code) {
    return NextResponse.redirect(new URL("/login", url.origin));
  }

  // This response is where Supabase session cookies must be written.
  const response = NextResponse.redirect(new URL("/work-orders", url.origin));

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

  const { error } = await supabase.auth.exchangeCodeForSession(code);

  // If exchange fails, bounce to login (no secrets leaked).
  if (error) {
    return NextResponse.redirect(new URL("/login", url.origin));
  }

  return response;
}
