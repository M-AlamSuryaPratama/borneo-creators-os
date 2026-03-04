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

type ToolDef = {
  key: ToolKey;
  title: string;
  desc: string;
  placeholderTopic: string;
  defaultCount?: number;
  system: string;
  promptTemplate: (topic: string) => string;
};

type HistoryItem = {
  id: string;
  tool: ToolKey;
  createdAt: number;
  topic: string;
  prompt: string;
  system: string;
  output: string;
};

type ApiResponse = {
  ok?: boolean;
  data?: any;
  error?: any;
  message?: string;
};

const LS_KEY = "bco_history_v1";

function nowId() {
  return `${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function safeJsonParse<T>(s: string, fallback: T): T {
  try {
    return JSON.parse(s) as T;
  } catch {
    return fallback;
  }
}

function normalizeText(input: string): string {
  // Rapihin line breaks + spacing untuk output AI yang sering berantakan
  const s = (input ?? "").replace(/\r\n/g, "\n");
  const lines = s.split("\n").map((l) => l.replace(/[ \t]+$/g, ""));
  // Hilangkan banyak empty line beruntun (maks 1 kosong)
  const out: string[] = [];
  let empty = 0;
  for (const line of lines) {
    const isEmpty = line.trim().length === 0;
    if (isEmpty) empty++;
    else empty = 0;
    if (empty <= 1) out.push(line);
  }
  return out.join("\n").trim();
}

function toPartsFromText(text: string, maxChars = 850): string[] {
  // Split by paragraph, then pack into chunks.
  const t = normalizeText(text);
  if (!t) return [];
  const paras = t.split("\n\n").map((p) => p.trim()).filter(Boolean);

  const parts: string[] = [];
  let buf = "";

  const flush = () => {
    const b = buf.trim();
    if (b) parts.push(b);
    buf = "";
  };

  for (const p of paras) {
    if (!buf) {
      buf = p;
      continue;
    }
    if ((buf + "\n\n" + p).length <= maxChars) {
      buf = buf + "\n\n" + p;
    } else {
      flush();
      // paragraph terlalu panjang, potong per kalimat kasar
      if (p.length > maxChars) {
        const sentences = p.split(/(?<=[.!?])\s+/g);
        let sBuf = "";
        for (const s of sentences) {
          if (!sBuf) sBuf = s;
          else if ((sBuf + " " + s).length <= maxChars) sBuf = sBuf + " " + s;
          else {
            parts.push(sBuf.trim());
            sBuf = s;
          }
        }
        if (sBuf.trim()) parts.push(sBuf.trim());
      } else {
        buf = p;
      }
    }
  }
  flush();
  return parts;
}

function buildExportJson(item: HistoryItem) {
  const parts = toPartsFromText(item.output, 900);
  return {
    ok: true,
    meta: {
      app: "Borneo Creators OS",
      tool: item.tool,
      topic: item.topic,
      createdAt: new Date(item.createdAt).toISOString(),
    },
    system: item.system,
    prompt: item.prompt,
    parts: parts.map((content, idx) => ({
      part: idx + 1,
      content,
    })),
    raw: item.output,
  };
}

async function copyToClipboard(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

const tools: ToolDef[] = [
  {
    key: "judul",
    title: "Judul YouTube (SEO + FYP)",
    desc: "Generate 10–15 judul clicky tapi tetap aman.",
    placeholderTopic: 'Contoh: "Sosok Tanpa Bayangan di hutan Kalimantan Tengah"',
    defaultCount: 12,
    system:
      "Kamu adalah content strategist + SEO specialist Indonesia untuk niche horor Kalimantan/Borneo. Output harus rapi, jelas, dan aman untuk YouTube. Hindari klaim berlebihan/fitnah. Tulis natural, menarik, dan relevan keyword.",
    promptTemplate: (topic) =>
      `Buat ${12} judul YouTube bahasa Indonesia untuk tema: ${topic}.\n` +
      `Syarat:\n` +
      `- Variasi gaya: misteri, investigasi, legenda, urban myth.\n` +
      `- Sisipkan kata kunci lokasi/objek.\n` +
      `- Format output: 1) ... 2) ... sampai selesai.\n`,
  },
  {
    key: "hook",
    title: "Hook 0–3 Detik",
    desc: "Hook singkat yang nancep untuk Shorts/Reels.",
    placeholderTopic: 'Contoh: "Jejak Itu Mengikutiku dari Sungai Kapuas"',
    system:
      "Kamu adalah copywriter video short. Output harus super singkat, memancing rasa penasaran, bahasa Indonesia natural, tanpa clickbait berlebihan.",
    promptTemplate: (topic) =>
      `Buat 12 hook 0–3 detik untuk video horor Kalimantan tentang: ${topic}.\n` +
      `Format: 1) ... (maks 12 kata)`,
  },
  {
    key: "shorts",
    title: "Script Shorts 60 Detik",
    desc: "Script 60 detik dengan struktur jelas (hook, build-up, twist, CTA).",
    placeholderTopic: 'Contoh: "Mandau Terbang di Pinggir Sungai"',
    system:
      "Kamu adalah penulis naskah YouTube Shorts horor Indonesia. Output harus rapi, pacing cepat, tidak vulgar, tetap aman untuk monetisasi.",
    promptTemplate: (topic) =>
      `Tulis naskah YouTube Shorts durasi 60 detik tentang: ${topic}.\n` +
      `Struktur:\n` +
      `1) Hook 1 kalimat\n` +
      `2) Build-up (3–5 kalimat)\n` +
      `3) Twist (1–2 kalimat)\n` +
      `4) Penutup + CTA (1 kalimat)\n` +
      `Buat narasi orang pertama, nuansa Kalimantan/Borneo.\n`,
  },
  {
    key: "longform",
    title: "Script Longform 6–8 Menit",
    desc: "Naskah longform lengkap: opening, konflik, klimaks, ending.",
    placeholderTopic: 'Contoh: "Warisan Leluhur: Sosok Tanpa Bayangan"',
    system:
      "Kamu adalah penulis naskah YouTube longform horor. Output rapi, sinematik, aman, dengan detail suasana khas Kalimantan. Hindari menyebut nama orang nyata.",
    promptTemplate: (topic) =>
      `Tulis naskah video YouTube longform 6–8 menit tentang: ${topic}.\n` +
      `Gunakan struktur:\n` +
      `- Opening (pancing rasa penasaran)\n` +
      `- Latar tempat & aturan/mitos\n` +
      `- Kejadian utama bertahap\n` +
      `- Klimaks\n` +
      `- Ending (open ending boleh)\n` +
      `Tambahkan cue SFX ringan: [SFX: ...] maksimal 6 kali.\n`,
  },
  {
    key: "seo",
    title: "SEO Pack (Deskripsi + Tag + Hashtag)",
    desc: "Deskripsi siap upload (aman), tag, hashtag, pin comment.",
    placeholderTopic: 'Contoh: "Misteri Penunggu Hutan Kalimantan Tengah"',
    system:
      "Kamu adalah SEO specialist YouTube Indonesia. Output harus siap upload, tanpa emoji berlebihan, aman untuk kebijakan platform, dan fokus keyword.",
    promptTemplate: (topic) =>
      `Buat SEO Pack untuk video YouTube bertema: ${topic}.\n` +
      `Output harus berisi:\n` +
      `A) Deskripsi 120–180 kata (tanpa emoji)\n` +
      `B) 20 keyword/tag dipisah koma\n` +
      `C) 12 hashtag (tanpa spasi)\n` +
      `D) 2 opsi pin comment CTA yang natural\n`,
  },
  {
    key: "thumbnail",
    title: "Prompt Thumbnail (Aman & Menarik)",
    desc: "Prompt thumbnail 16:9 nuansa horor tapi tidak terlalu menyeramkan.",
    placeholderTopic: 'Contoh: "Sosok Tanpa Bayangan Eps 1-2"',
    system:
      "Kamu adalah art director thumbnail YouTube. Output berupa prompt gambar yang jelas, sinematik, aman, tidak gore, tidak terlalu menyeramkan.",
    promptTemplate: (topic) =>
      `Buat 3 prompt thumbnail YouTube 16:9 untuk judul: ${topic}\n` +
      `Syarat:\n` +
      `- Nuansa horor gelap, tapi tidak menampilkan sosok terlalu menyeramkan.\n` +
      `- Ada ruang untuk teks judul tebal.\n` +
      `- Sebutkan style: cinematic, high contrast, sharp, clean.\n` +
      `- Sertakan rekomendasi teks judul (maks 5 kata) + warna teks.\n`,
  },
  {
    key: "prompt_video",
    title: "Prompt Video Gen (Per Part JSON)",
    desc: "Prompt video per part dengan karakter konsisten (Dayak/Indonesia).",
    placeholderTopic: 'Contoh: "Rahasia Mandau Terbang"',
    system:
      "Kamu adalah prompt engineer video-gen. Output HARUS JSON valid. Karakter konsisten (pria Dayak/Indonesia), lingkungan Kalimantan. Pecah menjadi part-part pendek.",
    promptTemplate: (topic) =>
      `Buat JSON prompt video-gen untuk cerita: ${topic}\n` +
      `Format JSON:\n` +
      `{\n  "title": "...",\n  "character": { "name": "...", "age": 20-30, "ethnicity": "Dayak/Indonesia", "outfit": "...", "features": "..." },\n  "style": "cinematic, dark, realistic, safe",\n  "parts": [\n    { "part": 1, "scene": "...", "camera": "...", "lighting": "...", "audio": "...", "duration_s": 6 },\n    ...\n  ]\n}\n` +
      `Pastikan 10–14 part.\n`,
  },
  {
    key: "json_export",
    title: "Rapihin Output → Export JSON",
    desc: "Ubah output teks jadi JSON per part (rapi, siap dipakai).",
    placeholderTopic: 'Tempel output yang mau dipecah (atau pilih dari history)',
    system:
      "Kamu adalah formatter. Output harus rapi dan bisa dipotong jadi part. Jangan mengubah makna.",
    promptTemplate: (topic) =>
      `Rapihkan teks berikut (jaga makna), lalu pecah menjadi part (maks 900 karakter per part).\n\nTEKS:\n${topic}\n`,
  },
];

export default function Page() {
  const [tool, setTool] = useState<ToolKey>("judul");
  const [topic, setTopic] = useState("");
  const [system, setSystem] = useState("");
  const [prompt, setPrompt] = useState("");
  const [output, setOutput] = useState("");
  const [loading, setLoading] = useState(false);
  const [cleanView, setCleanView] = useState(false);

  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [selectedHistoryId, setSelectedHistoryId] = useState<string | null>(null);

  const activeTool = useMemo(() => tools.find((t) => t.key === tool)!, [tool]);

  // init tool defaults
  useEffect(() => {
    setSystem(activeTool.system);
    if (tool === "json_export") {
      setPrompt("");
      return;
    }
    // auto prompt from topic
    setPrompt(activeTool.promptTemplate(topic || ""));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tool]);

  // load history
  useEffect(() => {
    const raw = localStorage.getItem(LS_KEY);
    const arr = safeJsonParse<HistoryItem[]>(raw || "[]", []);
    setHistory(Array.isArray(arr) ? arr : []);
  }, []);

  // save history
  useEffect(() => {
    localStorage.setItem(LS_KEY, JSON.stringify(history.slice(0, 50)));
  }, [history]);

  // keep prompt synced with topic for non-json_export tool
  useEffect(() => {
    if (tool === "json_export") return;
    setPrompt(activeTool.promptTemplate(topic || ""));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [topic]);

  const outputPretty = useMemo(() => normalizeText(output), [output]);

  const runGenerate = async () => {
    setLoading(true);
    setSelectedHistoryId(null);

    try {
      const effectiveSystem = (system || "").trim();
      const effectivePrompt =
        tool === "json_export"
          ? (prompt || "").trim() || activeTool.promptTemplate(topic || "")
          : (prompt || "").trim();

      if (!effectivePrompt) {
        setOutput("⚠️ Prompt masih kosong.");
        return;
      }

      // default endpoint
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tool,
          topic: (topic || "").trim(),
          system: effectiveSystem,
          prompt: effectivePrompt,
        }),
      });

      const json = (await res.json().catch(() => ({}))) as ApiResponse;

      // best-effort extract text output
      const text =
        (json as any)?.data?.message ??
        (json as any)?.data?.text ??
        (json as any)?.message ??
        (typeof json === "string" ? json : "") ??
        "";

      const finalText = normalizeText(String(text || ""));

      setOutput(finalText || JSON.stringify(json, null, 2));

      const item: HistoryItem = {
        id: nowId(),
        tool,
        createdAt: Date.now(),
        topic: (topic || "").trim(),
        prompt: effectivePrompt,
        system: effectiveSystem,
        output: finalText || JSON.stringify(json, null, 2),
      };

      setHistory((prev) => [item, ...prev].slice(0, 50));
    } catch (e: any) {
      setOutput(`❌ Error: ${e?.message || "Unknown error"}`);
    } finally {
      setLoading(false);
    }
  };

  const onPreset = (k: ToolKey) => {
    setTool(k);
    setSelectedHistoryId(null);
    setOutput("");
  };

  const loadFromHistory = (id: string) => {
    const item = history.find((h) => h.id === id);
    if (!item) return;
    setSelectedHistoryId(id);
    setTool(item.tool);
    setTopic(item.topic);
    setSystem(item.system);
    setPrompt(item.prompt);
    setOutput(item.output);
  };

  const clearHistory = () => {
    setHistory([]);
    setSelectedHistoryId(null);
  };

  const exportSelected = async () => {
    const item = selectedHistoryId
      ? history.find((h) => h.id === selectedHistoryId)
      : history[0];

    if (!item) {
      setOutput("⚠️ Belum ada history untuk di-export.");
      return;
    }

    const payload = buildExportJson(item);
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = `bco_${item.tool}_${(item.topic || "export")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .slice(0, 40)}.json`;
    a.click();

    URL.revokeObjectURL(url);
  };

  const copyOutput = async () => {
    const ok = await copyToClipboard(outputPretty || output || "");
    if (!ok) setOutput((prev) => prev + "\n\n⚠️ Gagal copy (browser melarang).");
  };

  const copyJson = async () => {
    const item = selectedHistoryId
      ? history.find((h) => h.id === selectedHistoryId)
      : history[0];
    if (!item) return;

    const payload = buildExportJson(item);
    const ok = await copyToClipboard(JSON.stringify(payload, null, 2));
    if (!ok) setOutput((prev) => prev + "\n\n⚠️ Gagal copy JSON (browser melarang).");
  };

  return (
    <div className="min-h-screen bg-[#07090c] text-white">
      <div className="mx-auto max-w-6xl px-4 py-6">
        {/* Header */}
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <div className="h-10 w-10 rounded-2xl bg-white/10 ring-1 ring-white/10 grid place-items-center">
                <span className="text-lg">🧩</span>
              </div>
              <div>
                <h1 className="text-xl font-semibold tracking-tight">Borneo Creators OS</h1>
                <p className="text-sm text-white/60">
                  Judul • Hook • Script • SEO • Thumbnail • Prompt Video • Export JSON
                </p>
              </div>
            </div>
            <p className="mt-3 text-sm text-white/60">
              Tip: bikin topik spesifik lokasi/objek (misal: “Sungai Kapuas, perahu karam, kabut”).
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setCleanView((v) => !v)}
              className="rounded-xl bg-white/10 px-3 py-2 text-sm ring-1 ring-white/10 hover:bg-white/15"
            >
              {cleanView ? "Normal View" : "Clean View"}
            </button>

            <button
              onClick={copyOutput}
              className="rounded-xl bg-white/10 px-3 py-2 text-sm ring-1 ring-white/10 hover:bg-white/15"
            >
              Copy Output
            </button>

            <button
              onClick={exportSelected}
              className="rounded-xl bg-emerald-500/90 px-3 py-2 text-sm font-medium text-black hover:bg-emerald-500"
            >
              Export JSON
            </button>
          </div>
        </div>

        {/* Layout */}
        <div className="mt-6 grid gap-4 md:grid-cols-12">
          {/* Sidebar */}
          <aside className="md:col-span-4">
            <div className="rounded-2xl bg-white/5 ring-1 ring-white/10">
              <div className="border-b border-white/10 p-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold">Tools</p>
                  <span className="text-xs text-white/50">Preset</span>
                </div>
              </div>

              <div className="p-2">
                {tools.map((t) => {
                  const active = t.key === tool;
                  return (
                    <button
                      key={t.key}
                      onClick={() => onPreset(t.key)}
                      className={[
                        "w-full rounded-xl p-3 text-left transition ring-1",
                        active
                          ? "bg-emerald-500/10 ring-emerald-400/30"
                          : "bg-white/0 ring-white/0 hover:bg-white/5 hover:ring-white/10",
                      ].join(" ")}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold">{t.title}</p>
                          <p className="mt-1 text-xs text-white/60">{t.desc}</p>
                        </div>
                        {active ? (
                          <span className="mt-0.5 rounded-lg bg-emerald-500/20 px-2 py-1 text-[11px] text-emerald-200">
                            Active
                          </span>
                        ) : (
                          <span className="mt-0.5 rounded-lg bg-white/5 px-2 py-1 text-[11px] text-white/50">
                            Use
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* History */}
            <div className="mt-4 rounded-2xl bg-white/5 ring-1 ring-white/10">
              <div className="flex items-center justify-between border-b border-white/10 p-4">
                <p className="text-sm font-semibold">History</p>
                <div className="flex gap-2">
                  <button
                    onClick={copyJson}
                    className="rounded-xl bg-white/10 px-3 py-2 text-xs ring-1 ring-white/10 hover:bg-white/15"
                  >
                    Copy JSON
                  </button>
                  <button
                    onClick={clearHistory}
                    className="rounded-xl bg-white/10 px-3 py-2 text-xs ring-1 ring-white/10 hover:bg-white/15"
                  >
                    Clear
                  </button>
                </div>
              </div>

              <div className="max-h-[340px] overflow-auto p-2">
                {history.length === 0 ? (
                  <div className="p-4 text-sm text-white/60">Belum ada history. Generate dulu ya.</div>
                ) : (
                  history.map((h) => {
                    const isActive = h.id === selectedHistoryId;
                    const t = tools.find((x) => x.key === h.tool)?.title || h.tool;
                    return (
                      <button
                        key={h.id}
                        onClick={() => loadFromHistory(h.id)}
                        className={[
                          "w-full rounded-xl p-3 text-left ring-1 transition",
                          isActive
                            ? "bg-white/10 ring-white/20"
                            : "bg-white/0 ring-white/0 hover:bg-white/5 hover:ring-white/10",
                        ].join(" ")}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="text-sm font-semibold">{t}</p>
                            <p className="mt-1 line-clamp-2 text-xs text-white/60">{h.topic || "(tanpa topik)"}</p>
                          </div>
                          <span className="text-[11px] text-white/40">
                            {new Date(h.createdAt).toLocaleString()}
                          </span>
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          </aside>

          {/* Main */}
          <main className="md:col-span-8">
            <div className="rounded-2xl bg-white/5 ring-1 ring-white/10">
              <div className="border-b border-white/10 p-4">
                <div className="flex flex-col gap-1">
                  <p className="text-sm font-semibold">{activeTool.title}</p>
                  <p className="text-xs text-white/60">{activeTool.desc}</p>
                </div>
              </div>

              <div className="p-4">
                {/* Inputs */}
                <div className="grid gap-3">
                  <div>
                    <label className="text-xs text-white/60">Topik / Tema</label>
                    <textarea
                      value={topic}
                      onChange={(e) => setTopic(e.target.value)}
                      placeholder={activeTool.placeholderTopic}
                      rows={3}
                      className="mt-1 w-full rounded-2xl bg-black/40 p-3 text-sm outline-none ring-1 ring-white/10 focus:ring-emerald-400/30"
                    />
                  </div>

                  <div className="grid gap-3 md:grid-cols-2">
                    <div>
                      <label className="text-xs text-white/60">Logic / System</label>
                      <textarea
                        value={system}
                        onChange={(e) => setSystem(e.target.value)}
                        rows={5}
                        className="mt-1 w-full rounded-2xl bg-black/40 p-3 text-sm outline-none ring-1 ring-white/10 focus:ring-emerald-400/30"
                      />
                    </div>

                    <div>
                      <label className="text-xs text-white/60">
                        Prompt {tool !== "json_export" ? "(auto dari tool)" : "(manual / paste teks)"}
                      </label>
                      <textarea
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                        rows={5}
                        placeholder={tool === "json_export" ? "Tempel output di sini untuk dipecah jadi part JSON..." : ""}
                        className="mt-1 w-full rounded-2xl bg-black/40 p-3 text-sm outline-none ring-1 ring-white/10 focus:ring-emerald-400/30"
                      />
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      onClick={runGenerate}
                      disabled={loading}
                      className="rounded-2xl bg-emerald-500 px-4 py-3 text-sm font-semibold text-black hover:bg-emerald-400 disabled:opacity-60"
                    >
                      {loading ? "Generating..." : "Generate"}
                    </button>

                    <button
                      onClick={() => setOutput("")}
                      className="rounded-2xl bg-white/10 px-4 py-3 text-sm ring-1 ring-white/10 hover:bg-white/15"
                    >
                      Clear Output
                    </button>

                    <button
                      onClick={copyOutput}
                      className="rounded-2xl bg-white/10 px-4 py-3 text-sm ring-1 ring-white/10 hover:bg-white/15"
                    >
                      Copy
                    </button>

                    <button
                      onClick={exportSelected}
                      className="rounded-2xl bg-white/10 px-4 py-3 text-sm ring-1 ring-white/10 hover:bg-white/15"
                    >
                      Export JSON (part)
                    </button>
                  </div>
                </div>

                {/* Output */}
                <div className="mt-4 rounded-2xl bg-black/40 p-4 ring-1 ring-white/10">
                  <div className="mb-2 flex items-center justify-between">
                    <p className="text-sm font-semibold">Output</p>
                    <span className="text-xs text-white/50">
                      {outputPretty ? `${outputPretty.length.toLocaleString()} chars` : "—"}
                    </span>
                  </div>

                  {cleanView ? (
                    <div className="whitespace-pre-wrap text-sm leading-relaxed text-white/90">
                      {outputPretty || "Output bakal muncul di sini."}
                    </div>
                  ) : (
                    <pre className="whitespace-pre-wrap break-words rounded-xl bg-black/30 p-3 text-sm leading-relaxed text-white/90 ring-1 ring-white/5">
                      {outputPretty || "Output bakal muncul di sini."}
                    </pre>
                  )}
                </div>

                {/* Export preview */}
                <div className="mt-4 rounded-2xl bg-white/5 p-4 ring-1 ring-white/10">
                  <p className="text-sm font-semibold">Export Preview (JSON Part)</p>
                  <p className="mt-1 text-xs text-white/60">
                    Export akan memecah output jadi part max ~900 karakter.
                  </p>

                  <div className="mt-3 grid gap-2 md:grid-cols-3">
                    <button
                      onClick={copyJson}
                      className="rounded-2xl bg-white/10 px-4 py-3 text-sm ring-1 ring-white/10 hover:bg-white/15"
                    >
                      Copy JSON
                    </button>
                    <button
                      onClick={exportSelected}
                      className="rounded-2xl bg-emerald-500/90 px-4 py-3 text-sm font-semibold text-black hover:bg-emerald-500"
                    >
                      Download JSON
                    </button>
                    <button
                      onClick={() => {
                        // quick: push current output to json_export tool
                        setTool("json_export");
                        setTopic(outputPretty || output || "");
                        setPrompt("");
                        setOutput("");
                      }}
                      className="rounded-2xl bg-white/10 px-4 py-3 text-sm ring-1 ring-white/10 hover:bg-white/15"
                    >
                      Rapihin via Tool JSON Export
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer note */}
            <div className="mt-4 text-xs text-white/50">
              Jika output AI masih “acak”, biasanya karena model balikin JSON di dalam string. Tombol “Export JSON”
              akan tetap ngerapihin & mecah per part.
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
