"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserSupabase } from "@/lib/supabase-browser";

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
    router.push("/billing-review");
    router.refresh();
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "var(--brand-primary)",
      }}
    >
      <form onSubmit={handleSubmit} className="card" style={{ width: 320 }}>
        <img src="/brand/logo.png" alt="Bogat Architecture" style={{ height: 56, marginBottom: 20 }} />
        <h1 style={{ fontSize: "1.1rem", marginBottom: 20, color: "var(--brand-primary)" }}>Bogat Billing</h1>

        <label style={{ display: "block", fontSize: "0.85rem", marginBottom: 4 }}>Email</label>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          style={{ width: "100%", padding: 8, marginBottom: 12, border: "1px solid var(--brand-stone)", borderRadius: 4 }}
        />

        <label style={{ display: "block", fontSize: "0.85rem", marginBottom: 4 }}>Password</label>
        <input
          type="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          style={{ width: "100%", padding: 8, marginBottom: 16, border: "1px solid var(--brand-stone)", borderRadius: 4 }}
        />

        {error && <p style={{ color: "#b23b3b", fontSize: "0.85rem", marginBottom: 12 }}>{error}</p>}

        <button type="submit" className="btn-primary" disabled={loading} style={{ width: "100%" }}>
          {loading ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </div>
  );
}
