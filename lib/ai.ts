export async function aiGenerate(prompt: string, logic?: string) {
  const r = await fetch("/api/generate", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ prompt, logic }),
  });

  const j = await r.json().catch(() => null);
  if (!r.ok) {
    throw new Error(j?.error || "AI request failed");
  }
  return j;
}

export function extractText(resp: any): string {
  const d = resp?.data;
  if (!d) return "";
  if (typeof d === "string") return d;
  if (typeof d.text === "string") return d.text;
  if (typeof d.result === "string") return d.result;
  if (typeof d.message === "string") return d.message;
  if (typeof d.output === "string") return d.output;
  return JSON.stringify(d, null, 2);
}
