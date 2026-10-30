// End-to-end as a poster: post a job → (worker claims + delivers) → pay over x402 → on-chain ERC-8004 feedback.
import { keccak256, toHex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { x402Client, wrapFetchWithPayment, decodePaymentResponseHeader } from "@x402/fetch";
import { ExactEvmScheme } from "@x402/evm/exact/client";
import { N, API, publicClient, wallet, tx, gasOpts } from "../src/chain";
import { reputationAbi } from "../src/abi";
import { acceptBidMsg, rejectMsg } from "../src/config";
import { readFileSync } from "node:fs";

const poster = privateKeyToAccount(process.env.POSTER_PK as `0x${string}`);
const j = (r: Response) => r.json() as any;
// usage: tsx scripts/poster-e2e.ts jobs/research.json   (JSON: category,title,description,spec,reward[,reject])
const spec = JSON.parse(readFileSync(process.argv[2] || "jobs/research.json", "utf8"));
const type = spec.category;
const H = { "content-type": "application/json" };
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const wait = async (ok: (j: any) => boolean, what: string) => { for (let i = 0; i < 120; i++) { const x = await fetch(`${API}/jobs/${id}`).then(j); if (ok(x)) return x; await sleep(5000); } throw new Error("timeout waiting for " + what); };

const { id } = await fetch(API + "/jobs", { method: "POST", headers: H,
  body: JSON.stringify({ ...spec, poster: poster.address, deadline: Math.floor(Date.now() / 1000) + 2 * 86400 }) }).then(j);
console.log("posted job", id, `${API.replace("/api", "")}/#job-${id}`);

let job = await wait((x) => x.bids?.length > 0, "a bid");
const bid = job.bids[0];
console.log(`bid from agent #${bid.agent_id}: ${bid.price} — ${bid.note}`);
console.log("accept-bid:", await fetch(`${API}/jobs/${id}/accept-bid`, { method: "POST", headers: H, body: JSON.stringify({ bidId: bid.id, signature: await poster.signMessage({ message: acceptBidMsg(id, bid.id) }) }) }).then(j));

job = await wait((x) => x.status === "delivered", "delivery");
console.log(`delivered (preview):`, job.preview.slice(0, 300));
if (spec.reject) {
  console.log("reject:", await fetch(`${API}/jobs/${id}/reject`, { method: "POST", headers: H, body: JSON.stringify({ reason: spec.reject, signature: await poster.signMessage({ message: rejectMsg(id, job.result_sha) }) }) }).then(j));
  job = await wait((x) => x.status === "delivered" && x.revisions > 0, "revised delivery");
  console.log(`redelivered (preview):`, job.preview.slice(0, 300));
}


const client = new x402Client();
client.register("eip155:*", new ExactEvmScheme(poster as any));
const payFetch = wrapFetchWithPayment(fetch, client);
const res = await payFetch(`${API}/jobs/${id}/result`);
const pr = res.headers.get("PAYMENT-RESPONSE") || res.headers.get("X-PAYMENT-RESPONSE");
const settle = pr ? decodePaymentResponseHeader(pr) : null;
const body = await res.json();
console.log("paid over x402:", settle?.transaction && tx(settle.transaction));
console.log("deliverable:\n" + body.result);
await import("node:fs").then((fs) => { fs.mkdirSync("deliverables", { recursive: true }); fs.writeFileSync(`deliverables/job-${id}.md`, body.result); });
if (settle?.transaction) await fetch(`${API}/jobs/${id}/paid`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ tx: settle.transaction }) });

const score = BigInt(process.env.SCORE || "95");
const w = wallet(process.env.POSTER_PK!);
const fb = await w.writeContract({ address: N.reputationRegistry, abi: reputationAbi, functionName: "giveFeedback",
  args: [BigInt(job.agent_id), score, 0, "bounty", type, `${API}/jobs/${id}/result`, `${API}/jobs/${id}`, keccak256(toHex(body.result || ""))], ...(await gasOpts(w.account.address)) } as any);
await publicClient.waitForTransactionReceipt({ hash: fb });
console.log("ERC-8004 feedback:", tx(fb));
console.log(await fetch(`${API}/jobs/${id}/feedback`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ tx: fb }) }).then(j));
