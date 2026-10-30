// Real job categories. Each pipeline gathers evidence with tools (paid ones bought via buy),
// then a free LLM writes the deliverable. If the LLM is unavailable, deliverables are structured data, stated honestly.
import { llm, LLM_NAME } from "./llm";
import { newCtx, webSearch, readPage, xSearch, redditSearch, bsApi, bsV2, defillamaDexes, coingeckoPrice, type Ctx } from "./tools";

export type JobSpec = { id?: number; category: string; title: string; description: string; spec?: string; feedback?: string | null; network?: string };
export type Deliverable = { markdown: string; purchases: Ctx["purchases"]; sources: Ctx["sources"]; log: string[]; llm: string | null };

const SYS = "You are a meticulous freelance agent delivering paid work. Follow the poster's deliverable spec exactly. Use ONLY the evidence provided; cite sources as [n] using the numbered source list; if evidence is missing say so plainly instead of inventing facts. Output GitHub-flavoured Markdown.";
export const brief = (j: JobSpec) => `JOB TITLE: ${j.title}\nDESCRIPTION: ${j.description}\nDELIVERABLE SPEC: ${j.spec || "(none given — use good judgement)"}${j.feedback ? `\nPOSTER REJECTED THE LAST DELIVERY. THEIR FEEDBACK: ${j.feedback}\nFix this.` : ""}`;
const srcList = (c: Ctx) => c.sources.map((s, i) => `[${i + 1}] ${s.title} — ${s.url}`).join("\n");

export async function finish(c: Ctx, j: JobSpec, evidence: string, fallback: string): Promise<Deliverable> {
  const out = await llm(SYS, `${brief(j)}\n\nSOURCES:\n${srcList(c)}\n\nEVIDENCE:\n${evidence.slice(0, 14000)}`);
  const tail = c.sources.length ? `\n\n---\n**Sources**\n${c.sources.map((s, i) => `${i + 1}. [${s.title}](${s.url})`).join("\n")}` : "";
  return { markdown: (out ?? `> ⚠️ Free LLM unavailable — delivering the structured evidence only.\n\n${fallback}`) + tail, purchases: c.purchases, sources: c.sources, log: c.log, llm: out ? LLM_NAME : null };
}

async function queries(j: JobSpec, n: number, what = "web search queries") {
  const q = await llm("Return only a JSON array of strings.", `Write ${n} short ${what} to gather evidence for this job.\n${brief(j)}`);
  try { const a = JSON.parse((q || "").replace(/```json|```/g, "").trim()); if (Array.isArray(a) && a.length) return a.slice(0, n).map(String); } catch {}
  return [j.title];
}

/** Research report: web search (free) + top source rendered in a browser bought via buy + on-chain/market APIs. */
async function research(j: JobSpec) {
  const c = newCtx(); let evidence = "";
  const text = `${j.title} ${j.description}`.toLowerCase();
  if (/dex|volume|tvl|swap|defi/.test(text) && /celo/.test(text)) {
    const d = await defillamaDexes("celo");
    c.sources.push({ title: "DefiLlama — DEX volume on Celo (API)", url: "https://defillama.com/dexs/chain/celo" });
    evidence += `\n[${c.sources.length}] DefiLlama DEX overview for Celo, fetched ${new Date().toISOString()}:\n` + d.slice(0, 12).map((p: any) => `- ${p.name}: 24h $${Math.round(p.volume24h).toLocaleString()}, 7d $${Math.round(p.volume7d || 0).toLocaleString()}, 30d $${Math.round(p.volume30d || 0).toLocaleString()}, 7d change ${p.change7d?.toFixed?.(1) ?? "?"}%`).join("\n");
  }
  const seen = new Set<string>(); let first = true;
  for (const q of await queries(j, 3)) {
    for (const r of await webSearch(q, 4)) {
      if (seen.has(r.url) || c.sources.length >= 8) continue; seen.add(r.url);
      const page = await readPage(c, r.url, first, 3500); first = false; // buy a rendered browser for the top source
      if (/just a moment|attention required|access denied/i.test(page.title + page.text.slice(0, 200))) continue;
      c.sources.push({ title: page.title || r.title, url: r.url });
      evidence += `\n[${c.sources.length}] ${r.title}\nsnippet: ${r.snippet}\npage: ${page.text}\n`;
    }
  }
  return finish(c, j, evidence, evidence);
}

/** Lead list: X + Reddit search bought via buy, deduped and ranked by reach. */
async function leads(j: JobSpec) {
  const c = newCtx(); const rows = new Map<string, any>();
  for (const q of await queries(j, 2, "X (Twitter) search queries (use X operators like -is:retweet, min_faves:5 if useful)")) {
    try { for (const t of await xSearch(c, q)) { const k = t.handle.toLowerCase(); const r = rows.get(k) || { ...t, posts: 0, engagement: 0 }; r.posts++; r.engagement += (t.likes || 0) + (t.retweets || 0) * 2; rows.set(k, r); } }
    catch (e: any) { c.log.push("x search failed: " + e.message.slice(0, 100)); }
  }
  c.sources.push({ title: "X search via buy gateway (tikhub)", url: "https://gateway.usebuy.ai/v1/catalog" });
  let reddit: any[] = [];
  if (/reddit|community|forum/i.test(j.description)) { try { reddit = await redditSearch(c, j.title); } catch {} }
  const topic = (t: string) => [/minipay/i.test(t) && "MiniPay", /x402/i.test(t) && "x402", /celo/i.test(t) && "Celo"].filter(Boolean).join(", ") || "other";
  const list = [...rows.values()].filter((r) => !/giveaway|airdrop|whitelist|\bwl\b/i.test(r.text)).sort((a, b) => b.engagement - a.engagement).slice(0, 25);
  const table = `| # | Handle | Topic | Engagement | Example post | Link |\n|---|---|---|---|---|---|\n` + list.map((r, i) => `| ${i + 1} | @${r.handle} ${r.name ? `(${r.name})` : ""} | ${topic(r.text)} | ${r.engagement} | ${r.text.slice(0, 110).replace(/\|/g, "/")} | ${r.url} |`).join("\n");
  const ev = `X LEADS (${list.length}):\n${table}\n${reddit.length ? "\nREDDIT:\n" + JSON.stringify(reddit) : ""}`;
  const d = await finish(c, j, ev + "\nWrite: a short summary of who these leads are and why they fit, then the full table (keep every row), then suggested outreach angle.", ev);
  return d;
}

/** Smart-contract review: verified source from Celo Blockscout, static checks, LLM checklist. */
async function audit(j: JobSpec) {
  const c = newCtx();
  const addr = (j.description.match(/0x[0-9a-fA-F]{40}/) || [])[0];
  const testnet = /sepolia|testnet/i.test(j.description);
  let src = "", name = "";
  if (addr) {
    const r = await bsApi(testnet, { module: "contract", action: "getsourcecode", address: addr });
    src = r?.[0]?.SourceCode || ""; name = r?.[0]?.ContractName || "";
    c.sources.push({ title: `Verified source of ${name || addr} (Blockscout${testnet ? ", Celo Sepolia" : ""})`, url: `${testnet ? "https://celo-sepolia.blockscout.com" : "https://celo.blockscout.com"}/address/${addr}?tab=contract` });
  }
  const gh = (j.description.match(/https:\/\/(raw\.githubusercontent\.com|github\.com)\/\S+\.sol/) || [])[0];
  if (!src && gh) { const u = gh.replace("github.com", "raw.githubusercontent.com").replace("/blob/", "/"); src = await fetch(u).then((r) => r.text()); c.sources.push({ title: "Solidity source", url: gh }); }
  if (!src) return { markdown: "Could not find verified source. Include a verified contract address (Celo / Celo Sepolia) or a GitHub .sol URL.", purchases: [], sources: c.sources, log: c.log, llm: null };
  const checks: [string, RegExp][] = [["tx.origin used for auth", /tx\.origin/], ["delegatecall", /delegatecall/], ["selfdestruct", /selfdestruct/], ["low-level .call{value}", /\.call\{value/], ["unchecked block", /unchecked\s*\{/],
    ["inline assembly", /assembly\s*\{/], ["onlyOwner / centralised admin", /onlyOwner|Ownable|AccessControl/], ["upgradeable proxy pattern", /Upgradeable|UUPS|_authorizeUpgrade|ERC1967/], ["pausable", /Pausable|whenNotPaused/],
    ["ReentrancyGuard present", /ReentrancyGuard|nonReentrant/], ["block.timestamp dependence", /block\.timestamp/], ["external price/oracle", /oracle|latestRoundData|getPrice/i], ["mint function", /function\s+_?mint/]];
  const hits = checks.map(([k, re]) => `- ${re.test(src) ? "⚠️ FOUND" : "✓ not found"}: ${k}`).join("\n");
  const ev = `CONTRACT ${name} ${addr || gh}\nSTATIC CHECKS:\n${hits}\n\nSOURCE (truncated):\n${src.slice(0, 16000)}`;
  const d = await finish(c, j, ev + "\nProduce: summary, privileged roles & trust assumptions, findings table (severity/description/location/recommendation), and a checklist. State clearly this is an automated review, not a formal audit.", `### Static checks\n${hits}`);
  return d;
}

/** Translation (EN <-> ES/PT etc). Reads a URL if given (rendered via buy browser). */
async function translate(j: JobSpec) {
  const c = newCtx(); let text = j.description;
  const url = (j.description.match(/https?:\/\/\S+/) || [])[0];
  if (url) { const p = await readPage(c, url, true, 12000); c.sources.push({ title: p.title, url }); text = p.text; }
  const out = await llm("You are a professional translator and localiser for Latin American and Nigerian audiences. Keep formatting, product names and numbers. Output only the translation in Markdown, then a short 'Translator notes' section.", `${brief(j)}\n\nTEXT TO TRANSLATE:\n${text}`);
  return { markdown: out ?? "> ⚠️ Free LLM unavailable — cannot translate without it.", purchases: c.purchases, sources: c.sources, log: c.log, llm: out ? LLM_NAME : null };
}

/** Content/thread writing grounded in what is being said on X right now (bought via buy). */
async function content(j: JobSpec) {
  const c = newCtx(); let ev = "";
  try {
    const posts = await xSearch(c, (await queries(j, 1, "X search query for current discussion on this topic"))[0]);
    c.sources.push({ title: "Recent X posts on the topic (via buy gateway)", url: "https://gateway.usebuy.ai/v1/catalog" });
    ev += "RECENT X POSTS:\n" + posts.slice(0, 12).map((p: any) => `- @${p.handle} (${p.likes} likes): ${p.text.slice(0, 240)} ${p.url}`).join("\n");
  } catch (e: any) { c.log.push("x search failed"); }
  for (const r of (await webSearch(j.title, 3))) { c.sources.push({ title: r.title, url: r.url }); ev += `\n[${c.sources.length}] ${r.title}: ${r.snippet}`; }
  return finish(c, j, ev + "\nWrite the content exactly in the requested format (e.g. numbered thread posts ≤280 chars each). Be specific, no hype words, no hashtag spam.", ev);
}

/** Monitoring report: wallet / token snapshot from Blockscout + CoinGecko. */
async function monitor(j: JobSpec) {
  const c = newCtx(); let ev = "";
  const testnet = /sepolia|testnet/i.test(j.description);
  for (const addr of (j.description.match(/0x[0-9a-fA-F]{40}/g) || []).slice(0, 3)) {
    const [info, txs, toks] = await Promise.all([bsV2(testnet, `/addresses/${addr}`), bsV2(testnet, `/addresses/${addr}/transactions`), bsV2(testnet, `/addresses/${addr}/token-balances`)]);
    c.sources.push({ title: `Blockscout ${addr}`, url: `${testnet ? "https://celo-sepolia.blockscout.com" : "https://celo.blockscout.com"}/address/${addr}` });
    ev += `\n[${c.sources.length}] ADDRESS ${addr}: CELO ${(Number(info?.coin_balance || 0) / 1e18).toFixed(4)}, contract=${info?.is_contract}\nTOKENS: ${(toks || []).slice(0, 10).map((t: any) => `${t.token?.symbol} ${(Number(t.value) / 10 ** Number(t.token?.decimals || 18)).toFixed(4)}`).join(", ")}\nLAST TXS:\n${(txs?.items || []).slice(0, 15).map((t: any) => `- ${t.timestamp} ${t.method || "transfer"} from ${t.from?.hash} to ${t.to?.hash} value ${(Number(t.value) / 1e18).toFixed(4)} CELO ${t.hash}`).join("\n")}`;
  }
  const ids = ["celo", "tether", "usd-coin"].filter((i) => new RegExp(i.split("-")[0], "i").test(j.description) || i === "celo");
  const p = await coingeckoPrice(ids.join(","));
  c.sources.push({ title: "CoinGecko simple price", url: "https://www.coingecko.com/en/coins/celo" });
  ev += `\n[${c.sources.length}] PRICES ${new Date().toISOString()}: ${JSON.stringify(p)}`;
  return finish(c, j, ev + "\nWrite a monitoring report: current state, notable activity, any alert conditions from the job that are met/not met, and what to watch. Note this is a point-in-time snapshot.", ev);
}

export const CATEGORIES: Record<string, { label: string; example: string; run: (j: JobSpec) => Promise<Deliverable> }> = {
  research: { label: "Research report", example: "Compare the top 5 Celo DEXes by volume, with sources", run: research },
  leads: { label: "Lead list / data scraping (X, Reddit via buy)", example: "Find 20 active MiniPay builders on X to invite to a hackathon", run: leads },
  audit: { label: "Smart-contract review & checklist", example: "Review contract 0x… on Celo: roles, risks, checklist", run: audit },
  translation: { label: "Translation (EN ↔ ES/PT, LatAm)", example: "Translate our landing page https://… into Brazilian Portuguese", run: translate },
  content: { label: "Content / X thread writing", example: "Write a 6-post X thread explaining x402 on Celo for builders", run: content },
  monitoring: { label: "Monitoring / alert report", example: "Watch wallet 0x… and CELO price; report activity and alerts", run: monitor },
};
