// JSON-RPC signer for the Playwright mock wallet on CELO MAINNET (POSTER_PK from .env; never printed).
// eth_sendTransaction: gas paid in USD₮ via its fee adapter (poster holds 0 CELO); data passed through unchanged (app already appends the ERC-8021 tag).
import "dotenv/config"; import http from "node:http";
import { privateKeyToAccount } from "viem/accounts"; import { createWalletClient, createPublicClient, http as vh } from "viem"; import { celo } from "viem/chains";
const acc = privateKeyToAccount(process.env.POSTER_PK as `0x${string}`);
const wc = createWalletClient({ account: acc, chain: celo, transport: vh("https://forno.celo.org") });
const USDT_ADAPTER = "0x0E2A3e05bc9A16F5292A6170456A710cb89C6f72";
http.createServer(async (q, s) => { let b = ""; for await (const c of q) b += c; const { method, params } = JSON.parse(b); let r: any;
  try {
    if (method === "address") r = acc.address;
    else if (method === "personal_sign") r = await acc.signMessage({ message: { raw: params[0] } });
    else if (method === "eth_signTypedData_v4") { const t = JSON.parse(params[1]); delete t.types.EIP712Domain; r = await acc.signTypedData(t); }
    else if (method === "eth_sendTransaction") { const t = params[0]; console.log("sendTx to", t.to, "app feeCurrency", t.feeCurrency, "data tail", String(t.data).slice(-40));
      r = await wc.sendTransaction({ to: t.to, data: t.data, value: t.value ? BigInt(t.value) : 0n, feeCurrency: USDT_ADAPTER } as any); console.log("tx", r); }
    s.end(JSON.stringify({ result: r }));
  } catch (e: any) { console.log("ERR", method, e.message?.slice(0, 300)); s.end(JSON.stringify({ error: e.message })); } }).listen(8788, () => console.log("signer up"));
