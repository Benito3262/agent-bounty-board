// Worker agent: bids on open jobs it can do (signed by its ERC-8004 owner wallet), then — once the poster
// accepts the bid — does the work with buy-purchased data/browser + a free LLM, and delivers a signed result.
// Handles rejections: reads the poster's feedback and redelivers. Payment arrives over x402 (payTo = this wallet).
import "dotenv/config";
import { privateKeyToAccount } from "viem/accounts";
import { API } from "../src/chain";
import { bidMsg, deliverMsg, sha256hex } from "../src/config";
import { CATEGORIES } from "../src/jobs";

const account = privateKeyToAccount(process.env.WORKER_PK as `0x${string}`);
const AGENT_ID = process.env.AGENT_ID!;
if (!AGENT_ID) throw new Error("Set AGENT_ID (run scripts/register-agent.ts first)");
const post = (p: string, b: unknown) => fetch(API + p, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(b) }).then((r) => r.json());
const bid = new Set<number>(); const busy = new Set<number>();

const plan: Record<string, string> = {
  research: "Plan: web search (free) → render top source in a browser rented via buy → pull DefiLlama/on-chain data where relevant → free-LLM report with numbered citations.",
  leads: "Plan: buy X/Reddit search via buy gateway → dedupe & rank by engagement → table + outreach angle.",
  audit: "Plan: fetch verified source from Blockscout → 13 static pattern checks → LLM review & checklist (automated review, not a formal audit).",
  translation: "Plan: render the source page via buy browser if a URL is given → free-LLM translation with localisation notes.",
  content: "Plan: buy recent X posts on the topic for context → web search → free-LLM writes to your format.",
  monitoring: "Plan: Blockscout address/tx/token snapshot + CoinGecko price → alert-condition report (point-in-time).",
};

async function tick() {
  const jobs: any[] = await fetch(API + "/jobs").then((r) => r.json());
  for (const j of jobs.filter((j) => j.status === "open" && j.type in CATEGORIES && !bid.has(j.id) && (!j.deadline || j.deadline > Date.now() / 1000))) {
    const price = String((BigInt(j.reward) * 9n) / 10n || 1n); // quote 90% of budget
    const r = await post(`/jobs/${j.id}/bids`, { agentId: AGENT_ID, price, eta: 600, note: plan[j.type], signature: await account.signMessage({ message: bidMsg(j.id, AGENT_ID, price) }) });
    console.log(`#${j.id} bid ${price}:`, r.ok ? "ok" : r.error); bid.add(j.id);
  }
  for (const j of jobs.filter((j) => ["assigned", "revision", "claimed"].includes(j.status) && j.agent_id === AGENT_ID && !busy.has(j.id))) {
    busy.add(j.id);
    console.log(`#${j.id} working (${j.type}${j.status === "revision" ? ", revision: " + j.feedback : ""})`);
    let result = "", purchases: unknown[] = [];
    try {
      const d = await CATEGORIES[j.type as keyof typeof CATEGORIES].run({ id: j.id, category: j.type, title: j.title, description: j.input, spec: j.spec, feedback: j.status === "revision" ? j.feedback : null });
      purchases = d.purchases;
      result = `# ${j.title}\n\n${d.markdown}\n\n---\n_Delivered by ERC-8004 agent #${AGENT_ID}. Writer: ${d.llm ?? "no LLM (structured data only)"}. Paid inputs bought via buy: ${d.purchases.map((p) => `${p.capability} ($${p.usd}, tx ${p.tx})`).join("; ") || "none"}._`;
    } catch (e: any) { result = `Job failed: ${e.message || e}`; }
    const sha = await sha256hex(result);
    const d = await post(`/jobs/${j.id}/deliver`, { result, purchases, signature: await account.signMessage({ message: deliverMsg(j.id, sha) }) });
    console.log(`#${j.id} delivered`, d); busy.delete(j.id);
  }
}

const once = process.argv.includes("--once");
console.log(`Worker agent #${AGENT_ID} (${account.address}) on ${API}`);
do { await tick().catch((e) => console.error(e.message)); if (!once) await new Promise((r) => setTimeout(r, 10000)); } while (!once);
