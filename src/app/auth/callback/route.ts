import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");

  // Debug probe: lets us verify if the route sees the querystring at all.
  if (code === "TEST") {
    return NextResponse.json({
      ok: true,
      sawCode: code,
      requestUrl: request.url,
      cookieNames: request.cookies.getAll().map((c) => c.name),
    });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnon) {
    return NextResponse.json(
      { ok: false, error: "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY" },
      { status: 500 }
    );
  }

  // If we don't get a code, don't silently redirect—this is the exact symptom we're diagnosing.
  if (!code) {
    return NextResponse.json({ ok: false, error: "Missing ?code param" }, { status: 400 });
  }

  const response = NextResponse.redirect(new URL("/work-orders", url.origin));

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

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return response;
}
