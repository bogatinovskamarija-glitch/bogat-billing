import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

type CookieToSet = { name: string; value: string; options: CookieOptions };

// Gates every page/API route behind a Supabase Auth session, except /login
// itself. Single user (Maria) — no roles, no multi-tenant RLS needed.
// Renamed from `middleware` to `proxy` per Next.js 16's convention.
export async function proxy(request: NextRequest) {
  const response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet: CookieToSet[]) => {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
      // Must match supabase-browser.ts — the app also runs inside a ClickUp
      // view (iframe), which needs SameSite=None to keep the session cookie.
      cookieOptions: { sameSite: "none", secure: true },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isLoginPage = request.nextUrl.pathname.startsWith("/login");
  // The password-recovery link lands here with a code in the URL that the
  // browser client exchanges for a session client-side — there's no cookie
  // yet on this first server-rendered request, so it can't be gated the
  // same way as every other page without breaking the flow before it starts.
  const isResetPasswordPage = request.nextUrl.pathname.startsWith("/reset-password");

  if (!user && !isLoginPage && !isResetPasswordPage) {
    const loginUrl = new URL("/login", request.url);
    return NextResponse.redirect(loginUrl);
  }

  if (user && isLoginPage) {
    return NextResponse.redirect(new URL("/billing-board", request.url));
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|brand/).*)"],
};
