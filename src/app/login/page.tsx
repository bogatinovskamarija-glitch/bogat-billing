"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserSupabase } from "../../lib/supabase-browser";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<"signin" | "forgot">("signin");
  const [resetSent, setResetSent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = createBrowserSupabase();
    const { error } = await supabase.auth.signInWithPassword({ email, password });

    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    router.push("/billing-board");
    router.refresh();
  }

  async function handleResetRequest(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = createBrowserSupabase();
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });

    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    setResetSent(true);
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <form onSubmit={mode === "signin" ? handleSubmit : handleResetRequest} className="panel" style={{ width: 380, padding: "48px 40px" }}>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <img src="/brand/logo-white.png" alt="Bogat OS" style={{ width: 140, marginBottom: 16 }} />
          <h1 className="screen-title" style={{ fontSize: 26, margin: 0 }}>
            Bogat OS
          </h1>
        </div>

        {mode === "forgot" && resetSent ? (
          <>
            <p style={{ fontSize: 13, color: "var(--text-dim)", marginBottom: 20 }}>
              If an account exists for {email}, a password reset link is on its way. Check your inbox.
            </p>
            <button
              type="button"
              className="btn-secondary"
              style={{ width: "100%" }}
              onClick={() => {
                setMode("signin");
                setResetSent(false);
              }}
            >
              Back to sign in
            </button>
          </>
        ) : (
          <>
            <label className="label" style={{ display: "block", marginBottom: 6 }}>
              Email
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={{
                width: "100%",
                padding: 10,
                marginBottom: 16,
                background: "var(--floor)",
                color: "var(--text)",
                border: "1px solid var(--line)",
              }}
            />

            {mode === "signin" && (
              <>
                <label className="label" style={{ display: "block", marginBottom: 6 }}>
                  Password
                </label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  style={{
                    width: "100%",
                    padding: 10,
                    marginBottom: 8,
                    background: "var(--floor)",
                    color: "var(--text)",
                    border: "1px solid var(--line)",
                  }}
                />
                <div style={{ textAlign: "right", marginBottom: 20 }}>
                  <button
                    type="button"
                    onClick={() => {
                      setMode("forgot");
                      setError(null);
                    }}
                    style={{ background: "none", border: "none", color: "var(--text-faint)", fontSize: 12, cursor: "pointer", padding: 0 }}
                  >
                    Forgot password?
                  </button>
                </div>
              </>
            )}

            {error && <p style={{ color: "var(--oxide)", fontSize: 13, marginBottom: 16 }}>{error}</p>}

            <button type="submit" className="btn-primary" disabled={loading} style={{ width: "100%" }}>
              {loading ? (mode === "signin" ? "Signing in…" : "Sending…") : mode === "signin" ? "Sign in" : "Send reset link"}
            </button>

            {mode === "forgot" && (
              <button
                type="button"
                onClick={() => setMode("signin")}
                style={{ background: "none", border: "none", color: "var(--text-faint)", fontSize: 12, cursor: "pointer", padding: 0, marginTop: 12, display: "block", width: "100%", textAlign: "center" }}
              >
                Back to sign in
              </button>
            )}
          </>
        )}
      </form>
    </div>
  );
}
