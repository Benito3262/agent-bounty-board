// One command to go live on Celo mainnet. DRY RUN by default — prints the plan and sends nothing.
//   npm run go-mainnet              → checks only
//   npm run go-mainnet -- --execute → register ERC-8004 (if missing, tagged) → list agent → NETWORK=mainnet → deploy
import "dotenv/config";
import { readFileSync, writeFileSync } from "node:fs";
import { execSync } from "node:child_process";
import { createPublicClient, createWalletClient, http, formatUnits, decodeEventLog } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { celo } from "viem/chains";
import { NETWORKS, MAINNET_FAUCET, feeCurrencyFor } from "../src/config";
import { identityAbi, erc20Abi } from "../src/abi";
import { tagClient } from "../src/attribution";

const EXEC = process.argv.includes("--execute");
const M = NETWORKS.mainnet; const TAG = process.env.ATTRIBUTION_TAG || "";
const SITE = "https://agent-bounty-board.pages.dev";
const pc = createPublicClient({ chain: celo, transport: http(M.rpc) });
const acct = privateKeyToAccount(process.env.WORKER_PK as `0x${string}`);
const step = (s: string) => console.log(`${EXEC ? "▶" : "[dry-run]"} ${s}`);
const fail = (s: string) => { console.error("✗ " + s); process.exit(1); };

console.log(`Agent wallet ${acct.address} · Celo mainnet ${M.chainId} · tag ${TAG || "(unset)"} · ${EXEC ? "EXECUTE" : "DRY RUN"}`);
if (!/^celo_[0-9a-f]{12}$/.test(TAG)) fail("ATTRIBUTION_TAG missing/malformed in .env");
const wt = readFileSync("wrangler.toml", "utf8");
if (!wt.includes(`ATTRIBUTION_TAG = "${TAG}"`)) fail("wrangler.toml ATTRIBUTION_TAG differs from .env");

const [celoBal, usat, usdt, owned] = await Promise.all([
  pc.getBalance({ address: acct.address }),
  pc.readContract({ address: M.token.address, abi: erc20Abi, functionName: "balanceOf", args: [acct.address] }) as Promise<bigint>,
  pc.readContract({ address: M.usdt.address, abi: erc20Abi, functionName: "balanceOf", args: [acct.address] }) as Promise<bigint>,
  pc.readContract({ address: M.identityRegistry, abi: [{ type: "function", name: "balanceOf", stateMutability: "view", inputs: [{ name: "o", type: "address" }], outputs: [{ type: "uint256" }] }] as const, functionName: "balanceOf", args: [acct.address] }),
]);
console.log(`  CELO ${formatUnits(celoBal, 18)} · USA₮ ${formatUnits(usat, 6)} · USD₮ ${formatUnits(usdt, 6)} · ERC-8004 identities ${owned}`);
const fc = feeCurrencyFor(M as any, celoBal, usat, usdt);
let agentId = process.env.MAINNET_AGENT_ID || "";

// 1. ERC-8004 identity
if (owned > 0n && agentId) console.log(`✓ already registered: agentId ${agentId}`);
else if (owned > 0n) fail("wallet owns an identity on mainnet but MAINNET_AGENT_ID is not set in .env — set it and rerun");
else {
  if (celoBal === 0n && usat < 20_000n && usdt < 20_000n) (EXEC ? fail : (m: string) => console.log("⚠ " + m))(`agent wallet needs CELO, or ≥0.02 USA₮ / USD₮ for gas. Fund ${acct.address} — free: ${MAINNET_FAUCET}`);
  step(`register ERC-8004 identity on ${M.identityRegistry} (ERC-8021 tag ${TAG}; gas in ${fc ? (fc === M.usdt.feeCurrency ? "USD₮" : "USA₮") + " via fee adapter " + fc : "CELO"})`);
  if (EXEC) {
    const card = { type: "https://eips.ethereum.org/EIPS/eip-8004#registration-v1", name: process.env.AGENT_NAME || "ChainScout",
      description: "Agent Bounty Board worker: research, lead lists, contract reviews, translation, content, monitoring. Paid per job in USA₮ over x402; buys its tools via buy.",
      services: [{ name: "web", endpoint: SITE }], x402Support: true, active: true, supportedTrust: ["reputation"] };
    const uri = "data:application/json;base64," + Buffer.from(JSON.stringify(card)).toString("base64");
    const w = tagClient(createWalletClient({ account: acct, chain: celo, transport: http(M.rpc) }), M.chainId, TAG);
    const hash = await w.writeContract({ address: M.identityRegistry, abi: identityAbi, functionName: "register", args: [uri], ...(fc ? { feeCurrency: fc } : {}) } as any);
    const rc = await pc.waitForTransactionReceipt({ hash });
    const ev = rc.logs.map((l) => { try { return decodeEventLog({ abi: identityAbi, ...l }); } catch { return null; } }).find((e: any) => e?.eventName === "Transfer") as any;
    agentId = String(ev.args.tokenId);
    console.log(`✓ agentId ${agentId} ${M.explorer}/tx/${hash}`);
    const env = readFileSync(".env", "utf8");
    writeFileSync(".env", /^MAINNET_AGENT_ID=/m.test(env) ? env.replace(/^MAINNET_AGENT_ID=.*$/m, `MAINNET_AGENT_ID=${agentId}`) : env + `\nMAINNET_AGENT_ID=${agentId}\n`);
  }
}

// 2. switch config
step(`wrangler.toml NETWORK → "mainnet"; .env NETWORK=mainnet, AGENT_ID=${agentId || "<new id>"}, BUY_SANDBOX=0`);
if (EXEC) {
  writeFileSync("wrangler.toml", wt.replace(/NETWORK = "testnet"/, 'NETWORK = "mainnet"'));
  let env = readFileSync(".env", "utf8");
  for (const [k, v] of [["NETWORK", "mainnet"], ["AGENT_ID", agentId], ["BUY_SANDBOX", "0"]]) env = new RegExp(`^${k}=`, "m").test(env) ? env.replace(new RegExp(`^${k}=.*$`, "m"), `${k}=${v}`) : env + `\n${k}=${v}\n`;
  writeFileSync(".env", env);
}

// 3. deploy + list agent on the mainnet board
step("npm test && npm run deploy (Cloudflare Pages, D1 shared — jobs are partitioned by network)");
if (EXEC) execSync("npm test && npm run deploy", { stdio: "inherit" });
step(`POST ${SITE}/api/agents {agentId:${agentId || "<new id>"}} (ownerOf checked on mainnet)`);
if (EXEC) {
  await new Promise((r) => setTimeout(r, 8000));
  console.log(await fetch(SITE + "/api/agents", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ agentId, name: process.env.AGENT_NAME || "ChainScout", skills: ["research", "leads", "audit", "translation", "content", "monitoring"] }) }).then((r) => r.json()));
  console.log(`\n✓ LIVE on mainnet: ${SITE}  — restart the worker: npm run worker (needs USA₮ in the buy account for live buy calls)`);
} else console.log("\nDry run complete. Nothing was sent. Re-run with: npm run go-mainnet -- --execute");
