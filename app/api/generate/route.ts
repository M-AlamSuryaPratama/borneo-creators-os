import { NextResponse } from "next/server";

type GenerateBody = {
  prompt: string;
  logic?: string;
};

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as GenerateBody;

    const prompt = (body.prompt || "").trim();
    if (!prompt) {
      return NextResponse.json({ error: "prompt kosong" }, { status: 400 });
    }

    const baseUrl = process.env.FERDEV_BASE_URL || "https://api.ferdev.my.id";
    const apikey = process.env.FERDEV_APIKEY;

    if (!apikey) {
      return NextResponse.json(
        { error: "FERDEV_APIKEY belum diset di env" },
        { status: 500 }
      );
    }

    const logic =
      (body.logic || "").trim() ||
      "Kamu adalah Borneo Creators OS, asisten untuk membuat ide, hook, narasi horor Kalimantan, SEO, dan prompt thumbnail. Gaya bahasa Indonesia, tegang, sinematik, tanpa gore. Output ringkas, siap pakai.";

    const url =
      `${baseUrl}/ai/gptlogic?` +
      `prompt=${encodeURIComponent(prompt)}` +
      `&logic=${encodeURIComponent(logic)}` +
      `&apikey=${encodeURIComponent(apikey)}`;

    const r = await fetch(url, { method: "GET" });

    if (!r.ok) {
      const text = await r.text().catch(() => "");
      return NextResponse.json(
        { error: `Upstream error ${r.status}`, detail: text.slice(0, 500) },
        { status: 502 }
      );
    }

    const contentType = r.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      const data = await r.json();
      return NextResponse.json({ ok: true, data });
    } else {
      const text = await r.text();
      return NextResponse.json({ ok: true, data: { text } });
    }
  } catch (e: any) {
    return NextResponse.json(
      { error: "Server error", detail: String(e?.message || e) },
      { status: 500 }
    );
  }
}
