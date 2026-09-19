"use client";

import { createBrowserClient } from "@supabase/ssr";

// Browser client — used only by the login form to hold the auth session.
// Never used to read/write invoice or client data directly; all financial
// reads/writes go through server-side API routes using the service-role key.
//
// sameSite: "none" is required because the app is also embedded as a
// ClickUp view (an iframe on app.clickup.com) — the default SameSite=Lax
// cookie a plain login would get is excluded from requests made inside a
// cross-site iframe, so the session cookie never actually persists there
// even though signIn() itself succeeds. "none" requires "secure", which is
// fine since Render only serves this over HTTPS. Must match middleware.ts.
export function createBrowserSupabase() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookieOptions: { sameSite: "none", secure: true } }
  );
}
