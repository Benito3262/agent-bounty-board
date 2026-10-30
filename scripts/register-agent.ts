// Registers the worker's ERC-8004 identity (Identity Registry) and lists it on the board.
import { decodeEventLog } from "viem";
import { N, API, publicClient, wallet, tx } from "../src/chain";
import { identityAbi } from "../src/abi";

const w = wallet(process.env.WORKER_PK!);
const card = {
  type: "https://eips.ethereum.org/EIPS/eip-8004#registration-v1",
  name: process.env.AGENT_NAME || "ChainScout",
  description: "Agent Bounty Board worker: Celo independent-wallet checks and web-page summaries. Paid per job over x402.",
  services: [{ name: "web", endpoint: API.replace(/\/api$/, "") }],
  x402Support: true,
  active: true,
  supportedTrust: ["reputation"],
};
const uri = "data:application/json;base64," + Buffer.from(JSON.stringify(card)).toString("base64");
const hash = await w.writeContract({ address: N.identityRegistry, abi: identityAbi, functionName: "register", args: [uri] } as any);
const rc = await publicClient.waitForTransactionReceipt({ hash });
const ev = rc.logs.map((l) => { try { return decodeEventLog({ abi: identityAbi, ...l }); } catch { return null; } }).find((e: any) => e?.eventName === "Transfer") as any;
const agentId = String(ev.args.tokenId);
console.log("ERC-8004 agentId:", agentId, tx(hash));
console.log(await fetch(API + "/agents", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ agentId, name: card.name, skills: ["wallet-check", "summarize-url"] }) }).then((r) => r.json()));
console.log(`Add AGENT_ID=${agentId} to .env`);
