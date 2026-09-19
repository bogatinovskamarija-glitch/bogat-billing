"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserSupabase } from "../../lib/supabase-browser";

// Reached from the "Forgot password?" email link. The browser client
// auto-exchanges the code in the URL for a temporary recovery session on
// load (detectSessionInUrl is on) — this page just needs to wait for that,
// then let the person set a new password with updateUser().
export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const supabase = createBrowserSupabase();
    supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") setReady(true);
    });
    // In case the event already fired before this listener attached.
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true);
    });
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirmPassword) {
      setError("Passwords don't match");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }
    setLoading(true);
    setError(null);

    const supabase = createBrowserSupabase();
    const { error } = await supabase.auth.updateUser({ password });

    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    router.push("/billing-board");
    router.refresh();
  }

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <form onSubmit={handleSubmit} className="panel" style={{ width: 380, padding: "48px 40px" }}>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <img src="/brand/logo-white.png" alt="Bogat OS" style={{ width: 140, marginBottom: 16 }} />
          <h1 className="screen-title" style={{ fontSize: 26, margin: 0 }}>
            Set a new password
          </h1>
        </div>

        {!ready ? (
          <p style={{ fontSize: 13, color: "var(--text-dim)" }}>
            Verifying your reset link… if this doesn't resolve in a few seconds, the link may have expired — request a new
            one from the sign-in page.
          </p>
        ) : (
          <>
            <label className="label" style={{ display: "block", marginBottom: 6 }}>New password</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={{ width: "100%", padding: 10, marginBottom: 16, background: "var(--floor)", color: "var(--text)", border: "1px solid var(--line)" }}
            />
            <label className="label" style={{ display: "block", marginBottom: 6 }}>Confirm new password</label>
            <input
              type="password"
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              style={{ width: "100%", padding: 10, marginBottom: 20, background: "var(--floor)", color: "var(--text)", border: "1px solid var(--line)" }}
            />
            {error && <p style={{ color: "var(--oxide)", fontSize: 13, marginBottom: 16 }}>{error}</p>}
            <button type="submit" className="btn-primary" disabled={loading} style={{ width: "100%" }}>
              {loading ? "Updating…" : "Update password"}
            </button>
          </>
        )}
      </form>
    </div>
  );
}
