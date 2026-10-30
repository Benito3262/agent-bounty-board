// tiny JSON-RPC signer for the Playwright mock wallet (reads POSTER_PK from .env; never printed)
import "dotenv/config"; import http from "node:http";
import { privateKeyToAccount } from "viem/accounts"; import { createWalletClient, http as vh } from "viem"; import { celoSepolia } from "viem/chains";
const acc = privateKeyToAccount(process.env.POSTER_PK as `0x${string}`);
const wc = createWalletClient({ account: acc, chain: celoSepolia, transport: vh() });
http.createServer(async (q, s) => { let b = ""; for await (const c of q) b += c; const { method, params } = JSON.parse(b); let r: any;
  try {
    if (method === "address") r = acc.address;
    else if (method === "personal_sign") r = await acc.signMessage({ message: { raw: params[0] } });
    else if (method === "eth_signTypedData_v4") { const t = JSON.parse(params[1]); delete t.types.EIP712Domain; r = await acc.signTypedData(t); }
    else if (method === "eth_sendTransaction") { const t = params[0]; r = await wc.sendTransaction({ to: t.to, data: t.data, value: t.value ? BigInt(t.value) : 0n, gas: t.gas ? BigInt(t.gas) : undefined }); }
    s.end(JSON.stringify({ result: r }));
  } catch (e: any) { s.end(JSON.stringify({ error: e.message })); } }).listen(8788, () => console.log("signer up"));
