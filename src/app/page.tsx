"use client";

import { useState } from "react";

export default function Home() {
  const [prompt, setPrompt] = useState("Buat 5 judul horor Kalimantan tentang Sungai Kapuas");
  const [logic, setLogic] = useState("kamu adalah AI yang dikembangkan oleh Feri");
  const [loading, setLoading] = useState(false);
  const [out, setOut] = useState<string>("");

  async function run() {
    setLoading(true);
    setOut("");
    try {
      const r = await fetch("/api/generate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ prompt, logic }),
      });
      const j = await r.json();
      setOut(JSON.stringify(j, null, 2));
    } catch (e: any) {
      setOut(String(e?.message || e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={{ maxWidth: 900, margin: "0 auto", padding: 20 }}>
      <h1 style={{ fontSize: 28, fontWeight: 700 }}>Borneo Creators OS</h1>
      <p style={{ opacity: 0.8, marginTop: 8 }}>
        Toolkit buat bangun channel YouTube (judul, hook, script, SEO) + AI Mode.
      </p>

      <div style={{ marginTop: 20, display: "grid", gap: 12 }}>
        <label>
          <div style={{ fontSize: 12, opacity: 0.8, marginBottom: 6 }}>Prompt</div>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={4}
            style={{ width: "100%", padding: 12, borderRadius: 10, border: "1px solid #333", background: "#0b0b0b", color: "#fff" }}
          />
        </label>

        <label>
          <div style={{ fontSize: 12, opacity: 0.8, marginBottom: 6 }}>Logic (system)</div>
          <textarea
            value={logic}
            onChange={(e) => setLogic(e.target.value)}
            rows={3}
            style={{ width: "100%", padding: 12, borderRadius: 10, border: "1px solid #333", background: "#0b0b0b", color: "#fff" }}
          />
        </label>

        <button
          onClick={run}
          disabled={loading}
          style={{
            padding: "12px 14px",
            borderRadius: 10,
            border: "1px solid #333",
            background: loading ? "#222" : "#fff",
            color: loading ? "#aaa" : "#000",
            fontWeight: 700,
            cursor: loading ? "not-allowed" : "pointer",
          }}
        >
          {loading ? "Generating..." : "Test AI Generate"}
        </button>

        <pre style={{ whiteSpace: "pre-wrap", padding: 12, borderRadius: 10, border: "1px solid #333", background: "#0b0b0b", color: "#fff" }}>
          {out || "Output bakal muncul di sini."}
        </pre>
      </div>
    </main>
  );
}
