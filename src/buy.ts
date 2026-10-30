// Build with buy: the worker pays for external services through the buy gateway (@celo/buy CLI).
// Testnet: `buy --sandbox` pays the gateway's celo-sepolia offer with test USDC (auto-funded by the gateway faucet).
// Mainnet: set BUY_SANDBOX=0 and BUY_ACCOUNT=<buy account funded with USDC/USA₮>.
import { execFile } from "node:child_process";
import { promisify } from "node:util";
const run = promisify(execFile);
/** Sandbox (Celo Sepolia test funds) unless on mainnet. Mainnet always buys live; BUY_SANDBOX=1 can't force sandbox there. */
export const buySandbox = (env = process.env) => env.NETWORK === "mainnet" ? false : env.BUY_SANDBOX !== "0";

export type Purchase = { capability: string; provider?: string; tx: string; token: string; amount: string; usd: string; network: string };

export async function buyCurl(url: string, body: unknown, maxAmount = "0.02") {
  const sandbox = buySandbox();
  const args = ["buy", ...(sandbox ? ["--sandbox"] : []), ...(process.env.BUY_ACCOUNT ? ["--account", process.env.BUY_ACCOUNT] : []),
    "curl", ...(process.env.BUY_TOKEN ? ["--token", process.env.BUY_TOKEN] : []), url, "-X", "POST", "-H", "content-type: application/json", "-d", JSON.stringify(body), "--max-amount", maxAmount];
  const { stdout } = await run("npx", args, { maxBuffer: 10 * 1024 * 1024, timeout: 180_000 });
  const lines = stdout.trim().split("\n").filter(Boolean);
  const res = JSON.parse(lines[lines.length - 1]);
  const purchase: Purchase = { capability: res.capability, provider: res.provider, tx: res.transaction, token: res.payment?.token, amount: res.payment?.atomic, usd: res.payment?.usd, network: sandbox ? "celo-sepolia" : "celo" };
  return { res, purchase };
}

/** Rent a disposable browser (buy capability browser.sessions.create) and read a JS-rendered page. */
export async function renderWithBoughtBrowser(pageUrl: string) {
  const { res, purchase } = await buyCurl("https://gateway.usebuy.ai/v1/browser/sessions", { durationMinutes: 1 }, "0.01");
  const b = res.browser;
  if (!b?.commandUrl) throw new Error("buy: no browser session in response");
  const cmd = async (c: object) => {
    const r = await fetch(b.commandUrl, { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${b.accessToken}` }, body: JSON.stringify(c) });
    const j: any = await r.json();
    if (!r.ok) throw new Error(`browser ${JSON.stringify(c)}: ${j.error || r.status}`);
    if (process.env.BUY_DEBUG) console.error("cmd", JSON.stringify(c), JSON.stringify({...j.output?.data, lifecycle: undefined}).slice(0, 400));
    return j.output;
  };
  const str = (o0: any): string => { const o = o0?.data ?? o0; return typeof o === "string" ? o : o == null ? "" : String(o.text ?? o.title ?? o.value ?? JSON.stringify(o)); };
  await cmd({ action: "open", url: pageUrl });
  await cmd({ action: "wait", milliseconds: 1500 });
  const title = str(await cmd({ action: "get", kind: "title" }));
  let text = "";
  for (const target of ["main", "article", "body"]) {
    try { text = str(await cmd({ action: "get", kind: "text", target })); if (text.length > 200) break; } catch {}
  }
  fetch(b.statusUrl, { method: "DELETE", headers: { authorization: `Bearer ${b.accessToken}` } }).catch(() => {});
  return { title, text, purchase };
}
