// Tools workers use to do real work. Paid tools go through the buy gateway (src/buy.ts); free ones are public APIs.
import { buyCurl, renderWithBoughtBrowser, type Purchase } from "./buy";

export type Ctx = { purchases: Purchase[]; sources: { title: string; url: string }[]; log: string[] };
export const newCtx = (): Ctx => ({ purchases: [], sources: [], log: [] });

const UA = { "user-agent": "Mozilla/5.0 (AgentBountyBoard worker)" };
export const clean = (html: string) => html
  .replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<nav[\s\S]*?<\/nav>|<footer[\s\S]*?<\/footer>/gi, " ")
  .replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&#x27;|&#39;/g, "'").replace(/&quot;/g, '"').replace(/\s+/g, " ").trim();

/** Free web search (DuckDuckGo HTML endpoint). */
export async function webSearch(q: string, n = 5) {
  const html = await fetch("https://html.duckduckgo.com/html/?q=" + encodeURIComponent(q), { headers: UA }).then((r) => r.text());
  const out: { title: string; url: string; snippet: string }[] = [];
  const re = /result__a" href="([^"]+)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?result__snippet[^>]*>([\s\S]*?)<\/a>/g;
  let m;
  while ((m = re.exec(html)) && out.length < n) {
    let url = m[1].replace(/&amp;/g, "&");
    const u = url.match(/uddg=([^&]+)/); if (u) url = decodeURIComponent(u[1]);
    if (url.includes("duckduckgo.com/y.js")) continue;
    out.push({ url, title: clean(m[2]), snippet: clean(m[3]) });
  }
  return out;
}

/** Read a page. `paid` = render it in a browser rented via buy (JS-heavy pages); else plain fetch. */
export async function readPage(ctx: Ctx, url: string, paid = false, max = 6000) {
  if (paid) {
    try {
      const r = await renderWithBoughtBrowser(url);
      ctx.purchases.push(r.purchase); ctx.log.push(`rented browser via buy to read ${url}`);
      return { title: r.title, text: r.text.replace(/\s+/g, " ").slice(0, max) };
    } catch (e: any) { ctx.log.push(`buy browser failed (${e.message.slice(0, 80)}), plain fetch instead`); }
  }
  try {
    const html = await fetch(url, { headers: UA, signal: AbortSignal.timeout(20000) }).then((r) => r.text());
    return { title: (html.match(/<title[^>]*>([^<]*)/i) || [])[1]?.trim() || url, text: clean(html).slice(0, max) };
  } catch { return { title: url, text: "" }; }
}

/** Paid social data via buy (sandbox on testnet). */
export async function buySocial(ctx: Ctx, capPath: string, body: object, max = "0.01") {
  const { res, purchase } = await buyCurl("https://gateway.usebuy.ai" + capPath, body, max);
  ctx.purchases.push(purchase); ctx.log.push(`bought ${purchase.capability} ($${purchase.usd})`);
  return res.output;
}

export async function xSearch(ctx: Ctx, query: string) {
  const out: any = await buySocial(ctx, "/v1/social/x/posts/search", { query, type: "top" });
  return (out?.timeline || []).filter((t: any) => t.type === "tweet").map((t: any) => ({
    handle: t.screen_name, name: t.user_info?.name ?? t.author?.name ?? "", followers: t.user_info?.followers_count ?? t.author?.followers_count ?? null,
    text: String(t.text || "").replace(/\s+/g, " "), likes: t.favorites, retweets: t.retweets, views: t.views,
    date: t.created_at, url: `https://x.com/${t.screen_name}/status/${t.tweet_id}`,
  }));
}

export async function redditSearch(ctx: Ctx, query: string) {
  const out: any = await buySocial(ctx, "/v1/social/reddit/posts/search", { query });
  const items = out?.data?.posts || out?.posts || out?.items || out?.data || [];
  return (Array.isArray(items) ? items : []).slice(0, 15).map((p: any) => ({ title: p.title, author: p.author || p.authorName, sub: p.subreddit || p.communityName, url: p.url || p.permalink, score: p.score ?? p.upvotes }));
}

/** Free on-chain data: Celo Blockscout (mainnet or Sepolia). */
export const blockscout = (testnet: boolean) => (testnet ? "https://celo-sepolia.blockscout.com" : "https://celo.blockscout.com");
export async function bsApi(testnet: boolean, params: Record<string, string>) {
  const j: any = await fetch(blockscout(testnet) + "/api?" + new URLSearchParams(params)).then((r) => r.json());
  return j.result;
}
export async function bsV2(testnet: boolean, path: string) {
  return fetch(blockscout(testnet) + "/api/v2" + path).then((r) => r.json()) as Promise<any>;
}

/** Free market data. */
export async function defillamaDexes(chain = "celo") {
  const j: any = await fetch(`https://api.llama.fi/overview/dexs/${chain}?excludeTotalDataChart=true&excludeTotalDataChartBreakdown=true`).then((r) => r.json());
  return (j.protocols || []).map((p: any) => ({ name: p.displayName || p.name, volume24h: p.total24h, volume7d: p.total7d, volume30d: p.total30d, change7d: p.change_7d }))
    .filter((p: any) => p.volume24h != null).sort((a: any, b: any) => b.volume24h - a.volume24h);
}
export async function coingeckoPrice(ids: string) {
  return fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd&include_24hr_change=true`).then((r) => r.json());
}
