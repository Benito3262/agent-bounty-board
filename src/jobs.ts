import { renderWithBoughtBrowser, type Purchase } from "./buy";
// Job handlers run by worker agents. No paid LLM keys: deterministic, verifiable logic.
const BLOCKSCOUT = "https://celo.blockscout.com/api";
const TOKENS: Record<string, string> = {
  USDC: "0xcebA9300f2b948710d2653dD7B07f33A8B32118C",
  "USD₮": "0x48065fbBE25f71C9282ddf5e1cD6D6A887483D5e",
  "USA₮": "0xD2ab3C9A02DBBAB236BfEC45D1d755DF4267F771",
};

async function bs(params: Record<string, string>) {
  const r = await fetch(BLOCKSCOUT + "?" + new URLSearchParams(params));
  const j: any = await r.json();
  return Array.isArray(j.result) ? j.result : j.result;
}

/** Hackathon "independent wallet" check on Celo mainnet: first activity, first funder, balances. */
export async function walletCheck(input: string) {
  const m = input.match(/0x[0-9a-fA-F]{40}/);
  if (!m) throw new Error("input must contain a 0x address");
  const addr = m[0];
  const cutoff = Date.parse((input.match(/\d{4}-\d{2}-\d{2}/) || ["2026-10-06"])[0] + "T00:00:00Z");
  const [firstTx, firstTok, balance] = await Promise.all([
    bs({ module: "account", action: "txlist", address: addr, sort: "asc", page: "1", offset: "1" }),
    bs({ module: "account", action: "tokentx", address: addr, sort: "asc", page: "1", offset: "1" }),
    bs({ module: "account", action: "balance", address: addr }),
  ]);
  const toks: Record<string, string> = {};
  for (const [sym, c] of Object.entries(TOKENS)) {
    const b = await bs({ module: "account", action: "tokenbalance", contractaddress: c, address: addr });
    toks[sym] = (Number(b || 0) / 1e6).toFixed(2);
  }
  const cands = [...(firstTx || []), ...(firstTok || [])].map((t: any) => ({ ts: +t.timeStamp * 1000, from: t.from, hash: t.hash }));
  cands.sort((a, b) => a.ts - b.ts);
  const first = cands[0];
  const eligible = !!first && first.ts < cutoff;
  return {
    address: addr,
    network: "Celo mainnet",
    firstActivity: first ? new Date(first.ts).toISOString() : null,
    firstActivityTx: first?.hash ?? null,
    firstCounterparty: first ? first.from : null,
    celoBalance: (Number(balance || 0) / 1e18).toFixed(4),
    stablecoins: toks,
    cutoff: new Date(cutoff).toISOString().slice(0, 10),
    activeBeforeCutoff: eligible,
    verdict: eligible
      ? `Active on Celo before ${new Date(cutoff).toISOString().slice(0, 10)} — counts as an established wallet (check the first funder is not you).`
      : `No Celo activity before the cutoff — would NOT count as an independent pre-existing wallet.`,
    source: "celo.blockscout.com",
  };
}

/** Extractive summary of a web page (word-frequency sentence scoring).
 *  The page is rendered in a browser the worker BUYS via the buy gateway (handles JS-heavy sites);
 *  falls back to a plain fetch if the purchase fails. Purchases are returned for on-job proof. */
export async function summarizeUrl(input: string) {
  const url = (input.match(/https?:\/\/\S+/) || [])[0];
  if (!url) throw new Error("input must contain a URL");
  const purchases: Purchase[] = [];
  let title = url, text = "", via = "plain fetch";
  if (process.env.USE_BUY !== "0") {
    try { const r = await renderWithBoughtBrowser(url); purchases.push(r.purchase); title = r.title || url; text = r.text.replace(/\s+/g, " ").trim(); via = "browser rented via buy (browser.sessions.create)"; }
    catch (e: any) { console.error("buy browser failed, falling back:", e.message); }
  }
  if (!text) {
  const r = await fetch(url, { headers: { "user-agent": "AgentBountyBoard-Worker/0.1" } });
  const html = await r.text();
  title = (html.match(/<title[^>]*>([^<]*)<\/title>/i) || [])[1]?.trim() || url;
  text = html
    .replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<nav[\s\S]*?<\/nav>|<footer[\s\S]*?<\/footer>/gi, " ")
    .replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&#39;|&rsquo;/g, "'").replace(/&quot;/g, '"')
    .replace(/\s+/g, " ").trim();
  }
  const sentences = text.split(/(?<=[.!?])\s+/).filter((s) => s.length > 40 && s.length < 400 && !/[{}`<>\\]|=>|_jsx|function\s*\(/.test(s));
  const stop = new Set("the a an and or of to in on for with is are was were be by as at it this that from you your we our can will not have has more".split(" "));
  const freq: Record<string, number> = {};
  for (const w of sentences.join(" ").toLowerCase().match(/[a-z][a-z'-]{2,}/g) || []) if (!stop.has(w)) freq[w] = (freq[w] || 0) + 1;
  const scored = sentences.map((s, i) => {
    const ws = s.toLowerCase().match(/[a-z][a-z'-]{2,}/g) || [];
    return { s, i, score: ws.reduce((a, w) => a + (freq[w] || 0), 0) / Math.sqrt(ws.length + 1) };
  });
  const seen = new Set<string>();
  const top = scored.sort((a, b) => b.score - a.score).filter((x) => !seen.has(x.s) && seen.add(x.s)).slice(0, 5).sort((a, b) => a.i - b.i);
  const keywords = Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([w]) => w);
  return { url, title, words: text.split(" ").length, keyPoints: top.map((x) => x.s), keywords, method: "extractive (no LLM)", renderedVia: via, purchases };
}

export const HANDLERS: Record<string, (input: string) => Promise<unknown>> = {
  "wallet-check": walletCheck,
  "summarize-url": summarizeUrl,
};
