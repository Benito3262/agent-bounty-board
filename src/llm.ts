// Free LLM: Pollinations text API (no key, no payment). Falls back to null so pipelines can degrade honestly.
export async function llm(system: string, user: string, opts: { maxChars?: number } = {}): Promise<string | null> {
  for (let i = 0; i < 2; i++) {
    try {
      const r = await fetch("https://text.pollinations.ai/openai", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ model: "openai", messages: [{ role: "system", content: system }, { role: "user", content: user.slice(0, opts.maxChars ?? 24000) }] }),
        signal: AbortSignal.timeout(120_000),
      });
      if (!r.ok) throw new Error("llm " + r.status);
      const j: any = await r.json();
      const out = j?.choices?.[0]?.message?.content;
      if (out) return String(out).trim();
    } catch (e: any) { console.error("llm attempt failed:", e.message); }
  }
  return null;
}
export const LLM_NAME = "Pollinations free text API (model: openai)";
