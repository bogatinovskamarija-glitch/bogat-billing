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

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <form onSubmit={handleSubmit} className="panel" style={{ width: 380, padding: "48px 40px" }}>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <img src="/brand/logo-white.png" alt="Bogat OS" style={{ width: 140, marginBottom: 16 }} />
          <h1 className="screen-title" style={{ fontSize: 26, margin: 0 }}>
            Bogat OS
          </h1>
        </div>

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
            marginBottom: 20,
            background: "var(--floor)",
            color: "var(--text)",
            border: "1px solid var(--line)",
          }}
        />

        {error && (
          <p style={{ color: "var(--oxide)", fontSize: 13, marginBottom: 16 }}>{error}</p>
        )}

        <button type="submit" className="btn-primary" disabled={loading} style={{ width: "100%" }}>
          {loading ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </div>
  );
}
