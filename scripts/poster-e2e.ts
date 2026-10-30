// End-to-end as a poster: post a job → (worker claims + delivers) → pay over x402 → on-chain ERC-8004 feedback.
import { keccak256, toHex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { x402Client, wrapFetchWithPayment, decodePaymentResponseHeader } from "@x402/fetch";
import { ExactEvmScheme } from "@x402/evm/exact/client";
import { N, API, publicClient, wallet, tx } from "../src/chain";
import { reputationAbi } from "../src/abi";

const poster = privateKeyToAccount(process.env.POSTER_PK as `0x${string}`);
const j = (r: Response) => r.json() as any;
const type = process.argv[2] || "wallet-check";
const input = process.argv[3] || "0x765DE816845861e75A25fCA122bb6898B8B1282a cutoff 2026-10-06";

const { id } = await fetch(API + "/jobs", { method: "POST", headers: { "content-type": "application/json" },
  body: JSON.stringify({ type, input, reward: process.env.REWARD || "10000", poster: poster.address }) }).then(j);
console.log("posted job", id);

let job: any;
for (let i = 0; i < 60; i++) { job = await fetch(`${API}/jobs/${id}`).then(j); if (job.status === "delivered") break; await new Promise((r) => setTimeout(r, 5000)); }
if (job.status !== "delivered") throw new Error("not delivered in time — is the worker running?");
console.log(`delivered by agent #${job.agent_id}:`, job.preview);

const client = new x402Client();
client.register("eip155:*", new ExactEvmScheme(poster as any));
const payFetch = wrapFetchWithPayment(fetch, client);
const res = await payFetch(`${API}/jobs/${id}/result`);
const pr = res.headers.get("PAYMENT-RESPONSE") || res.headers.get("X-PAYMENT-RESPONSE");
const settle = pr ? decodePaymentResponseHeader(pr) : null;
const body = await res.json();
console.log("paid over x402:", settle?.transaction && tx(settle.transaction));
console.log("deliverable:", body.result);
if (settle?.transaction) await fetch(`${API}/jobs/${id}/paid`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ tx: settle.transaction }) });

const score = BigInt(process.env.SCORE || "95");
const w = wallet(process.env.POSTER_PK!);
const fb = await w.writeContract({ address: N.reputationRegistry, abi: reputationAbi, functionName: "giveFeedback",
  args: [BigInt(job.agent_id), score, 0, "bounty", type, `${API}/jobs/${id}/result`, `${API}/jobs/${id}`, keccak256(toHex(body.result || ""))] } as any);
await publicClient.waitForTransactionReceipt({ hash: fb });
console.log("ERC-8004 feedback:", tx(fb));
console.log(await fetch(`${API}/jobs/${id}/feedback`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ tx: fb }) }).then(j));
