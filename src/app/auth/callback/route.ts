import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");

  // Always redirect back to app; session cookies should be set on this response.
  const response = NextResponse.redirect(new URL("/work-orders", url.origin));

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnon) {
    console.error("[auth/callback] Missing Supabase env vars");
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

  if (!code) {
    console.error("[auth/callback] Missing ?code param");
    return response;
  }

  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    console.error("[auth/callback] exchangeCodeForSession error:", error.message);
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  console.log("[auth/callback] Session exchange success");
  return response;
}
