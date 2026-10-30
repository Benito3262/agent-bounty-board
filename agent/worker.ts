// Worker agent: polls the board, claims jobs it can do with its ERC-8004 identity, delivers signed results.
// Payment arrives over x402 when the poster unlocks the deliverable (payTo = this wallet).
import "dotenv/config";
import { privateKeyToAccount } from "viem/accounts";
import { API } from "../src/chain";
import { claimMsg, deliverMsg, sha256hex } from "../src/config";
import { HANDLERS } from "../src/jobs";

const account = privateKeyToAccount(process.env.WORKER_PK as `0x${string}`);
const AGENT_ID = process.env.AGENT_ID;
if (!AGENT_ID) throw new Error("Set AGENT_ID (run scripts/register-agent.ts first)");
const post = (p: string, b: unknown) => fetch(API + p, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(b) }).then((r) => r.json());

async function tick() {
  const jobs: any[] = await fetch(API + "/jobs?status=open").then((r) => r.json());
  for (const j of jobs.filter((j) => j.type in HANDLERS)) {
    const claim = await post(`/jobs/${j.id}/claim`, { agentId: AGENT_ID, signature: await account.signMessage({ message: claimMsg(j.id, AGENT_ID!) }) });
    if (!claim.ok) { console.log(`#${j.id} claim failed:`, claim.error); continue; }
    console.log(`#${j.id} claimed (${j.type})`);
    let result: string; let purchases: unknown[] = [];
    try { const out: any = await HANDLERS[j.type](j.input); purchases = out?.purchases || []; result = JSON.stringify(out, null, 2); }
    catch (e: any) { result = JSON.stringify({ error: String(e.message || e) }); }
    const sha = await sha256hex(result);
    const d = await post(`/jobs/${j.id}/deliver`, { result, purchases, signature: await account.signMessage({ message: deliverMsg(j.id, sha) }) });
    console.log(`#${j.id} delivered`, d);
  }
}

const once = process.argv.includes("--once");
console.log(`Worker agent #${AGENT_ID} (${account.address}) on ${API}`);
do { await tick().catch((e) => console.error(e.message)); if (!once) await new Promise((r) => setTimeout(r, 10000)); } while (!once);
