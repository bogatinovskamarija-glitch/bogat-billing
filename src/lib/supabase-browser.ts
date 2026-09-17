"use client";

import { createBrowserClient } from "@supabase/ssr";

// Browser client — used only by the login form to hold the auth session.
// Never used to read/write invoice or client data directly; all financial
// reads/writes go through server-side API routes using the service-role key.
export function createBrowserSupabase() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
