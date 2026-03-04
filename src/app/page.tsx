"use client";

import React, { useEffect, useMemo, useState } from "react";

type ToolKey =
  | "judul"
  | "hook"
  | "shorts"
  | "longform"
  | "seo"
  | "thumbnail"
  | "prompt_video"
  | "json_export";

type HistoryItem = {
  id: string;
  tool: ToolKey;
  createdAt: number;
  topic: string;
  prompt: string;
  logic: string;
  resultText: string;
};

function uid() {
  return Math.random().toString(16).slice(2) + Date.now().toString(16);
}

function extractText(resp: any): string {
  const d = resp?.data;
  if (!d) return JSON.stringify(resp, null, 2);
  if (typeof d === "string") return d;
  if (typeof d.text === "string") return d.text;
  if (typeof d.result === "string") return d.result;
  if (typeof d.message === "string") return d.message;
  if (typeof d.output === "string") return d.output;
  return JSON.stringify(d, null, 2);
}

function cleanText(s: string) {
  // bikin output lebih rapi: unescape \n dan rapihin spasi
  return s
    .replace(/\\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]+\n/g, "\n")
    .trim();
}

function downloadText(filename: string, content: string) {
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function toJSONParts(text: string) {
  const lines = cleanText(text).split("\n").map(l => l.trim()).filter(Boolean);

  // Deteksi pola "1. ..." atau "- ..."
  const items: string[] = [];
  for (const line of lines) {
    const m = line.match(/^\d+\.\s*(.+)$/);
    if (m) items.push(m[1].trim());
    else if (line.startsWith("- ")) items.push(line.slice(2).trim());
  }

  if (items.length >= 3) {
    return items.map((t, idx) => ({
      part: idx + 1,
      text: t,
    }));
  }

  // fallback: pecah per paragraf
  const paras = cleanText(text).split("\n\n").map(p => p.trim()).filter(Boolean);
  return paras.map((p, idx) => ({ part: idx + 1, text: p }));
}

const DEFAULT_LOGIC =
  "kamu adalah seorang content creator profesional, SEO Specialist. Fokus niche horor Kalimantan/Borneo. Output harus rapi, pakai bullet/nomor, to the point, siap copy-paste. Hindari gore.";

const TOOL_PRESETS: Record<ToolKey, { title: string; desc: string; makePrompt: (topic: string) => string }> = {
  judul: {
    title: "Judul YouTube (SEO + FYP)",
    desc: "Generate 10–15 judul yang clicky tapi tetap aman.",
    makePrompt: (topic) =>
      `Buat 12 judul YouTube bahasa Indonesia tema horor Kalimantan tentang: ${topic}.
Syarat:
- Panjang 45–65 karakter (mayoritas)
- Ada 3 judul model penasaran (curiosity gap)
- Ada 3 judul model lokasi spesifik
- Ada 3 judul model legenda/mitos
- Sertakan 5 keyword utama (di bawah)`,
  },
  hook: {
    title: "Hook 0–3 Detik",
    desc: "Hook pendek buat Shorts / Reels (3 gaya).",
    makePrompt: (topic) =>
      `Buat 15 hook pembuka 0–3 detik untuk video horor tentang: ${topic}.
Bagi 3 gaya:
A) shocking, B) misterius, C) storytelling.
Format: list bernomor.`,
  },
  shorts: {
    title: "Script Shorts 60 detik",
    desc: "Narasi siap VO + beat per detik.",
    makePrompt: (topic) =>
      `Tulis script YouTube Shorts 60 detik bertema horor Kalimantan tentang: ${topic}.
Format:
- 0-3s Hook
- 3-15s Setup
- 15-45s Eskalasi
- 45-58s Twist
- 58-60s CTA
Gaya: sinematik, tegang, tanpa gore.`,
  },
  longform: {
    title: "Script Longform 6–8 menit",
    desc: "Struktur lengkap intro–climax–ending + CTA.",
    makePrompt: (topic) =>
      `Buat naskah video YouTube 6–8 menit bertema horor Kalimantan tentang: ${topic}.
Struktur:
1) Hook 10 detik
2) Pengantar lokasi/karakter
3) Konflik bertahap (3 adegan)
4) Klimaks
5) Ending menggantung (teasing eps berikutnya)
Tambahkan arahan SFX/visual singkat tiap adegan.`,
  },
  seo: {
    title: "SEO Pack (Deskripsi + Tag + Hashtag)",
    desc: "Deskripsi aman + keyword + tag + hashtag.",
    makePrompt: (topic) =>
      `Buat SEO pack untuk video YouTube tema horor Kalimantan tentang: ${topic}.
Output:
1) Deskripsi 2 versi (pendek & panjang)
2) 15 tag (dipisah koma)
3) 12 hashtag (relevan, aman)
4) 8 keyword utama`,
  },
  thumbnail: {
    title: "Prompt Thumbnail (Tanpa Menyeramkan Berlebihan)",
    desc: "Prompt gambar 16:9 + teks judul pendek.",
    makePrompt: (topic) =>
      `Buat 3 konsep thumbnail YouTube 16:9 untuk tema: ${topic}.
Masing-masing konsep berisi:
- Judul pendek max 5 kata (huruf besar)
- Deskripsi visual (tanpa menampilkan sosok terlalu menyeramkan)
- Warna dominan & mood
- Elemen fokus (misal: hutan, kabut, sungai, rumah kayu)
Format bullet.`,
  },
  prompt_video: {
    title: "Prompt Video Gen (Per Part JSON)",
    desc: "JSON per part dengan karakter konsisten (Dayak/Indonesia).",
    makePrompt: (topic) =>
      `Buat prompt video generator dalam format JSON per-part untuk cerita horor Kalimantan tentang: ${topic}.
Syarat:
- Karakter konsisten: orang Indonesia (Dayak) usia 25-35, outfit sederhana.
- Tiap part: scene, camera, lighting, environment, action, dialogue, negative_prompt.
- Total 8 part.
Output hanya JSON valid.`,
  },
  json_export: {
    title: "Rapihin Output → Export JSON",
    desc: "Ubah hasil AI jadi JSON part siap pipeline.",
    makePrompt: (topic) =>
      `Tulis output dalam list bernomor yang mudah diubah jadi JSON tentang: ${topic}.
Gunakan format 1. 2. 3. (jangan paragraf panjang).`,
  },
};

export default function Home() {
  const [tool, setTool] = useState<ToolKey>("judul");
  const [topic, setTopic] = useState("Sosok Tanpa Bayangan di hutan Kalimantan Tengah");
  const [logic, setLogic] = useState(DEFAULT_LOGIC);
  const [loading, setLoading] = useState(false);
  const [raw, setRaw] = useState("");
  const [toast, setToast] = useState<string>("");

  const [history, setHistory] = useState<HistoryItem[]>([]);

  // load history
  useEffect(() => {
    const saved = localStorage.getItem("bco_history");
    if (saved) {
      try {
        setHistory(JSON.parse(saved));
      } catch {}
    }
  }, []);

  // persist history
  useEffect(() => {
    localStorage.setItem("bco_history", JSON.stringify(history.slice(0, 30)));
  }, [history]);

  const prompt = useMemo(() => TOOL_PRESETS[tool].makePrompt(topic), [tool, topic]);

  const pretty = useMemo(() => cleanText(extractText(tryParseJSON(raw) ?? raw)), [raw]);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(""), 1600);
  }

  async function run() {
    setLoading(true);
    setRaw("");
    try {
      const r = await fetch("/api/generate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ prompt, logic }),
      });
      const j = await r.json();
      const text = cleanText(extractText(j));
      setRaw(text);

      const item: HistoryItem = {
        id: uid(),
        tool,
        createdAt: Date.now(),
        topic,
        prompt,
        logic,
        resultText: text,
      };
      setHistory((h) => [item, ...h].slice(0, 30));
      showToast("Selesai ✅");
    } catch (e: any) {
      setRaw("ERROR: " + String(e?.message || e));
      showToast("Gagal ❌");
    } finally {
      setLoading(false);
    }
  }

  async function copyOut() {
    await navigator.clipboard.writeText(pretty || "");
    showToast("Copied!");
  }

  function exportJSON() {
    const parts = toJSONParts(pretty || "");
    downloadText(`borneo-creators-os-${tool}.json`, JSON.stringify({ tool, topic, parts }, null, 2));
    showToast("JSON downloaded");
  }

  function clearHistory() {
    setHistory([]);
    localStorage.removeItem("bco_history");
    showToast("History cleared");
  }

  const selected = TOOL_PRESETS[tool];

  return (
    <div className="container">
      <div className="card" style={{ padding: 18 }}>
        <div className="row" style={{ alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div className="badge">
              <span>⚙️ Borneo Creators OS</span>
              <span className="kbd">AI Mode</span>
            </div>
            <h1 className="h1" style={{ marginTop: 10 }}>Dashboard Creator</h1>
            <p className="p">
              Judul • Hook • Script • SEO • Thumbnail • Prompt Video • Export JSON
            </p>
          </div>
          <div className="small">
            Tip: bikin topic spesifik lokasi/objek (misal: “Sungai Kapuas, perahu karam, kabut”).
          </div>
        </div>

        <div className="hr" />

        <div className="tabs">
          {Object.entries(TOOL_PRESETS).map(([k, v]) => (
            <div
              key={k}
              className={"tab " + (tool === k ? "active" : "")}
              onClick={() => setTool(k as ToolKey)}
              role="button"
              aria-label={v.title}
            >
              {v.title}
            </div>
          ))}
        </div>

        <div className="hr" />

        <div className="grid2">
          <div className="card" style={{ padding: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "baseline" }}>
              <div>
                <div className="label">Tool</div>
                <div style={{ fontWeight: 800, fontSize: 16 }}>{selected.title}</div>
                <div className="small" style={{ marginTop: 6 }}>{selected.desc}</div>
              </div>
              <div className="badge" style={{ background: "rgba(34,197,94,.10)", borderColor: "rgba(34,197,94,.25)" }}>
                <span>🧩</span><span>Preset Prompt</span>
              </div>
            </div>

            <div className="hr" />

            <div className="label">Topik / Tema</div>
            <input
              className="input"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="Contoh: Sosok tanpa bayangan, Sungai Kapuas, rumah kayu tua..."
            />

            <div style={{ height: 12 }} />

            <div className="label">Prompt (auto dari tool)</div>
            <textarea className="textarea" value={prompt} readOnly />

            <div style={{ height: 12 }} />

            <div className="label">Logic / System</div>
            <textarea className="textarea" value={logic} onChange={(e) => setLogic(e.target.value)} />

            <div className="actions">
              <button className="btn primary" onClick={run} disabled={loading}>
                {loading ? "Generating..." : "Generate"}
              </button>
              <button className="btn ghost" onClick={copyOut} disabled={!pretty}>
                Copy Output
              </button>
              <button className="btn" onClick={exportJSON} disabled={!pretty}>
                Export JSON
              </button>
              <button className="btn danger" onClick={clearHistory} disabled={history.length === 0}>
                Clear History
              </button>
            </div>

            <div className="small" style={{ marginTop: 10 }}>
              Output dirapihin otomatis (line break & spacing). Export JSON akan pecah jadi part.
            </div>
          </div>

          <div className="card" style={{ padding: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "baseline" }}>
              <div>
                <div className="label">Output</div>
                <div style={{ fontWeight: 800, fontSize: 16 }}>Hasil AI (rapi)</div>
                <div className="small" style={{ marginTop: 6 }}>Siap copy ke YouTube / pipeline konten.</div>
              </div>
              <div className="badge">
                <span>📄</span><span>Clean View</span>
              </div>
            </div>

            <div className="hr" />

            <pre className="pre">{pretty || "Klik Generate untuk mulai."}</pre>

            <div className="hr" />

            <div className="label">History (30 terakhir)</div>
            <div style={{ display: "grid", gap: 10 }}>
              {history.length === 0 && <div className="small">Belum ada history.</div>}
              {history.slice(0, 8).map((h) => (
                <button
                  key={h.id}
                  className="btn ghost"
                  onClick={() => {
                    setTool(h.tool);
                    setTopic(h.topic ?? topic); // compat if old
                    setLogic(h.logic);
                    setRaw(h.resultText);
                    showToast("Loaded from history");
                  }}
                  style={{ textAlign: "left" }}
                >
                  <div style={{ fontWeight: 800, marginBottom: 6 }}>
                    {TOOL_PRESETS[h.tool].title}
                    <span className="small" style={{ marginLeft: 10 }}>
                      {new Date(h.createdAt).toLocaleString()}
                    </span>
                  </div>
                  <div className="small" style={{ opacity: 0.9 }}>
                    {h.prompt.slice(0, 120)}{h.prompt.length > 120 ? "..." : ""}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="hr" />
        <div className="small">
          Next upgrade: auto template “Series EPS 1-10”, auto CTA, auto deskripsi shopee, dan generator thumbnail text style.
        </div>
      </div>

      {toast ? <div className="toast">{toast}</div> : null}
    </div>
  );
}

// helper: coba parse json string
function tryParseJSON(s: string) {
  if (!s) return null;
  const t = s.trim();
  if (!(t.startsWith("{") || t.startsWith("["))) return null;
  try { return JSON.parse(t); } catch { return null; }
}
