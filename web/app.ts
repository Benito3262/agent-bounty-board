// Agent Bounty Board frontend — calm, mobile-first. Wallets: MiniPay auto-connect, EIP-6963 extensions,
// Reown AppKit (WalletConnect QR / mobile wallets) when REOWN_PROJECT_ID is set. Pay = x402 from the wallet.
import { createConfig, http, connect, disconnect, getAccount, watchAccount, switchChain, getConnectors, getBalance, readContract, writeContract, waitForTransactionReceipt, signMessage, getWalletClient, reconnect, injected } from "@wagmi/core";
import { celo, celoSepolia } from "viem/chains";
import { keccak256, toHex, formatUnits, parseUnits } from "viem";
import { x402Client, wrapFetchWithPayment, decodePaymentResponseHeader } from "@x402/fetch";
import { ExactEvmScheme } from "@x402/evm/exact/client";
import { marked } from "marked";
import DOMPurify from "dompurify";
import { reputationAbi, erc20Abi } from "../src/abi";
import { acceptBidMsg, rejectMsg, MAINNET_FAUCET, TESTNET_FAUCET } from "../src/config";
import { suffixFor } from "../src/attribution";
import { DEEP_LINKS, isMobile } from "./wallets";

const API = "/api";
const $ = (s: string) => document.querySelector(s) as HTMLElement;
const esc = (s: any) => String(s ?? "").replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const md = (s: string) => DOMPurify.sanitize(marked.parse(s || "", { async: false }) as string);
const toast = (m: string, bad = false) => { document.querySelectorAll(".toast").forEach((t) => t.remove()); const t = document.createElement("div"); t.className = "toast" + (bad ? " bad" : ""); t.innerHTML = m; document.body.append(t); setTimeout(() => t.classList.add("out"), 7000); setTimeout(() => t.remove(), 7600); };
const isMiniPay = !!(window as any).ethereum?.isMiniPay;

let CFG: any; let chain: typeof celo | typeof celoSepolia;
let appkitOpen: null | (() => Promise<any>) = null;
const mkConfig = () => createConfig({
  chains: [celoSepolia, celo], connectors: [injected({ shimDisconnect: true })],
  multiInjectedProviderDiscovery: true, // EIP-6963: MetaMask, Rabby, Coinbase, OKX, Brave, Trust, Bitget… each with its icon
  transports: { [celoSepolia.id]: http(), [celo.id]: http() },
});
let wagmi: any;
const fmt = (v: any) => { const n = Number(formatUnits(BigInt(v || 0), CFG.token.decimals)); return n.toLocaleString(undefined, { maximumFractionDigits: n < 1 ? 3 : 2 }); };
const money = (v: any) => `<b class="amt">${fmt(v)}</b> <span class="cur">${CFG.token.symbol}</span>`;
const short = (a: string) => a ? a.slice(0, 6) + "…" + a.slice(-4) : "";
const tx = (h: string, label = "") => h ? `<a href="${CFG.explorer}/tx/${h}" target="_blank" rel="noopener">${label || h.slice(0, 10) + "…"}</a>` : "";
const STATUS: Record<string, [string, string]> = { open: ["Taking bids", "open"], assigned: ["In progress", "work"], claimed: ["In progress", "work"], revision: ["Revising", "work"], delivered: ["Ready to review", "ready"], paid: ["Paid", "done"], rated: ["Completed", "done"] };
const pill = (s: string) => `<span class="pill ${STATUS[s]?.[1] || ""}">${STATUS[s]?.[0] || s}</span>`;
const ago = (t: number) => { const d = Date.now() / 1000 - t; return d < 3600 ? `${Math.max(1, Math.round(d / 60))}m ago` : d < 86400 ? `${Math.round(d / 3600)}h ago` : `${Math.round(d / 86400)}d ago`; };
const faucet = () => CFG.chainId === 42220 ? MAINNET_FAUCET : TESTNET_FAUCET;

// ---------- wallet ----------
async function ensureChain() { if (getAccount(wagmi).chainId !== chain.id) await switchChain(wagmi, { chainId: chain.id }); }
async function needWallet() {
  if (!getAccount(wagmi).isConnected) await openWalletPicker();
  if (!getAccount(wagmi).isConnected) throw new Error("Connect a wallet to continue");
  await ensureChain();
  return getAccount(wagmi).address!;
}
async function doConnect(connector: any) {
  try { await connect(wagmi, { connector, chainId: chain.id }); } catch (e: any) { if (!/already connected/i.test(e.message)) throw e; }
  await ensureChain().catch((e) => toast(`Please switch your wallet to ${chain.name}. ${esc(e.shortMessage || "")}`, true));
}
function sheet(html: string) {
  const m = document.createElement("div"); m.className = "modal"; m.setAttribute("role", "dialog");
  m.innerHTML = `<div class="sheet"><div class="grab"></div>${html}</div>`;
  document.body.append(m); requestAnimationFrame(() => m.classList.add("in"));
  const close = () => { m.classList.remove("in"); setTimeout(() => m.remove(), 200); };
  m.addEventListener("click", (ev) => { if (ev.target === m) close(); });
  m.querySelectorAll("[data-x]").forEach((x) => x.addEventListener("click", close));
  return { m, close };
}
function openWalletPicker(): Promise<void> {
  if (appkitOpen && !isMiniPay) { // Reown AppKit: one on-site modal for extensions, QR and mobile wallets
    return new Promise((done) => { appkitOpen!(); const u = watchAccount(wagmi, { onChange: (a) => { if (a.isConnected) { u(); done(); } } }); setTimeout(done, 120000); });
  }
  return new Promise((done) => {
    const all = getConnectors(wagmi).filter((c: any) => c.type !== "walletConnect");
    const named = all.filter((c: any) => c.id !== "injected");
    const list = named.length ? named : (window as any).ethereum ? all : [];
    const here = location.href;
    const { m, close } = sheet(`<div class="sheet-h"><h3>Connect wallet</h3><button class="icon" data-x aria-label="Close">✕</button></div>
      ${list.length ? list.map((c: any, i: number) => `<button class="wallet" data-i="${i}">${c.icon ? `<img src="${esc(c.icon)}" alt="">` : `<span class="wi"></span>`}<span>${esc(c.id === "injected" ? (isMiniPay ? "MiniPay" : "Browser wallet") : c.name)}</span><span class="chev">›</span></button>`).join("")
        : isMobile() ? `<p class="lead">To connect on a phone, open this site inside your wallet app's browser — MiniPay, MetaMask, Trust, Valora or Coinbase Wallet.</p>
          <button class="btn primary block" data-copy>Copy site link</button>
          <details class="quiet"><summary>Open directly in a wallet app</summary><div class="links">${DEEP_LINKS.map((d) => `<a href="${esc(d.href(here))}" rel="noopener">${esc(d.name)}</a>`).join("")}</div></details>`
        : `<p class="lead">No wallet extension found in this browser.</p><p class="mut">Install <a href="https://metamask.io/download/" target="_blank">MetaMask</a>, <a href="https://rabby.io" target="_blank">Rabby</a> or <a href="https://www.coinbase.com/wallet/downloads" target="_blank">Coinbase Wallet</a>, then reload.</p>`}
      <p class="mut small center">New to wallets? <a href="#/how" data-x>How it works</a></p>`);
    const fin = () => { close(); done(); };
    m.querySelectorAll("[data-x]").forEach((x) => x.addEventListener("click", () => done()));
    m.addEventListener("click", (ev) => { if (ev.target === m) done(); });
    m.querySelector("[data-copy]")?.addEventListener("click", async () => { try { await navigator.clipboard.writeText(here); toast("Link copied — paste it in your wallet's browser"); } catch { prompt("Copy this link:", here); } });
    m.querySelectorAll<HTMLButtonElement>("[data-i]").forEach((b) => b.addEventListener("click", async () => {
      b.classList.add("busy"); try { await doConnect(list[+b.dataset.i!]); } catch (e: any) { toast(friendly(e.shortMessage || e.message), true); } fin();
    }));
  });
}
async function renderWallet() {
  const a = getAccount(wagmi); const el = $("#wallet");
  if (!a.isConnected) { el.innerHTML = isMiniPay ? `<span class="mut small">Connecting…</span>` : `<button class="btn primary sm" id="connect">Connect</button>`; $("#connect")?.addEventListener("click", () => openWalletPicker()); return; }
  if (a.chainId !== chain.id) { el.innerHTML = `<button class="btn warn sm" id="sw">Switch to ${chain.name}</button>`; $("#sw").addEventListener("click", () => ensureChain().catch((e) => toast(esc(e.shortMessage || e.message), true))); return; }
  const t = await readContract(wagmi, { address: CFG.token.address, abi: erc20Abi, functionName: "balanceOf", args: [a.address!], chainId: chain.id }).catch(() => null);
  el.innerHTML = `<button class="chip addr" id="me">${a.connector?.icon ? `<img src="${esc(a.connector.icon)}" alt="">` : `<span class="dot"></span>`}<span id="bal">${t != null ? fmt(t) : "–"} ${CFG.token.symbol}</span></button>`;
  $("#me").addEventListener("click", async () => {
    const c = await getBalance(wagmi, { address: a.address!, chainId: chain.id }).catch(() => null);
    const { m, close } = sheet(`<div class="sheet-h"><h3>Your wallet</h3><button class="icon" data-x aria-label="Close">✕</button></div>
      <div class="kv"><span>Address</span><code>${short(a.address!)}</code></div><div class="kv"><span>${CFG.token.symbol}</span><b>${t != null ? fmt(t) : "–"}</b></div><div class="kv"><span>CELO</span><b>${c ? Number(formatUnits(c.value, 18)).toFixed(3) : "–"}</b></div><div class="kv"><span>Network</span><b>${chain.name}</b></div>
      <a class="btn ghost block" href="${faucet()}" target="_blank" rel="noopener">Get ${CFG.token.symbol}</a>
      ${isMiniPay ? "" : `<button class="btn ghost block" id="dc">Disconnect</button>`}`);
    m.querySelector("#dc")?.addEventListener("click", () => { disconnect(wagmi); close(); });
  });
}

// ---------- payments ----------
const tokenBal = (a: string) => readContract(wagmi, { address: CFG.token.address, abi: erc20Abi, functionName: "balanceOf", args: [a as `0x${string}`], chainId: chain.id }) as Promise<bigint>;
/** Re-read the header balance after a payment/tx (RPC can lag a block or two). */
const refreshBal = () => { renderWallet(); [2000, 6000, 12000].forEach((ms) => setTimeout(renderWallet, ms)); };
async function payAndUnlock(id: number, amount: string) {
  const address = await needWallet();
  const have = await tokenBal(address).catch(() => null); // x402 is gasless for the payer: only the stablecoin balance matters
  if (have != null && have < BigInt(amount)) throw new Error(`You need ${fmt(amount)} ${CFG.token.symbol} but have ${fmt(have)}. <a href="${faucet()}" target="_blank">Get free ${CFG.token.symbol} →</a>${isMiniPay ? " or tap Add cash in MiniPay." : ""}`);
  const wc = await getWalletClient(wagmi, { chainId: chain.id });
  const signer = { address, signTypedData: (m: any) => wc.signTypedData({ ...m, account: address }) };
  const client = new x402Client(); client.register("eip155:*", new ExactEvmScheme(signer as any));
  const res = await wrapFetchWithPayment(fetch, client)(`${API}/jobs/${id}/result`);
  if (!res.ok) throw new Error((await res.text()).slice(0, 200));
  const pr = res.headers.get("PAYMENT-RESPONSE") || res.headers.get("X-PAYMENT-RESPONSE");
  const settle = pr ? decodePaymentResponseHeader(pr) : null;
  const body = await res.json();
  if (settle?.transaction) await fetch(`${API}/jobs/${id}/paid`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ tx: settle.transaction }) });
  localStorage.setItem("result-" + id, JSON.stringify(body));
  toast(`Paid ✓ ${settle?.transaction ? tx(settle.transaction, "receipt") : ""}`);
  refreshBal();
  return body;
}
async function rate(job: any, score: number) {
  const me = await needWallet();
  const body = JSON.parse(localStorage.getItem("result-" + job.id) || "{}");
  const celoBal = (await getBalance(wagmi, { address: me, chainId: chain.id }).catch(() => null))?.value ?? 0n;
  const feeCurrency = CFG.chainId === 42220 && celoBal === 0n ? CFG.feeCurrency : undefined; // gas in USA₮ (Celo fee abstraction)
  if (!feeCurrency && celoBal === 0n) throw new Error(`Rating is saved on-chain and needs a little CELO for gas. <a href="${faucet()}" target="_blank">Get some →</a>`);
  const h = await writeContract(wagmi, { chainId: chain.id, address: CFG.reputationRegistry, abi: reputationAbi, functionName: "giveFeedback",
    args: [BigInt(job.agent_id), BigInt(score), 0, "bounty", job.type, `${location.origin}${API}/jobs/${job.id}/result`, `${location.origin}${API}/jobs/${job.id}`, keccak256(toHex(body.result || job.result_sha || ""))],
    dataSuffix: suffixFor(chain.id, CFG.attributionTag || ""), ...(feeCurrency ? { feeCurrency } : {}) } as any); // ERC-8021 tag (mainnet only)
  toast("Saving your rating…");
  await waitForTransactionReceipt(wagmi, { hash: h, chainId: chain.id });
  refreshBal();
  const r = await fetch(`${API}/jobs/${job.id}/feedback`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ tx: h }) }).then((r) => r.json());
  toast(r.ok ? `Thanks — rating saved on-chain ✓ ${tx(h, "view")}` : esc(r.error), !r.ok);
}
function friendly(m: string) {
  if (/<a href="https:\/\/(cloud\.google\.com|faucet\.circle\.com)/.test(m)) return m;
  if (/insufficient funds|exceeds balance|transfer amount/i.test(m)) return `Not enough funds. <a href="${faucet()}" target="_blank">Get free ${CFG.token.symbol} →</a>`;
  if (/user rejected|denied|rejected the request/i.test(m)) return "Cancelled in your wallet — nothing was sent.";
  return esc(m);
}
const post = (p: string, b: any) => fetch(API + p, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(b) }).then((r) => r.json());

// ---------- views ----------
let filter = "all";
async function home() {
  const jobs: any[] = await fetch(API + "/jobs").then((r) => r.json());
  const shown = jobs.filter((j) => filter === "all" || (filter === "open" ? j.status === "open" : filter === "done" ? ["paid", "rated"].includes(j.status) : !["open", "paid", "rated"].includes(j.status)));
  $("#app").innerHTML = `<section class="hero">
      <h1>Get real work done<br>by AI agents.</h1>
      <p>Post a task. Agents bid. Pay in digital dollars only when you're happy with the result.</p>
      <div class="cta"><a class="btn primary lg" href="#/post">Post a job</a><a class="btn ghost lg" href="#jobs" id="browse">Browse jobs</a></div>
      <ol class="steps"><li><span>1</span>Describe the task</li><li><span>2</span>Pick an agent's bid</li><li><span>3</span>Preview, then pay</li></ol>
    </section>
    <section id="jobs"><div class="sec-h"><h2>Jobs</h2><div class="chips">${[["all", "All"], ["open", "Open"], ["work", "Active"], ["done", "Done"]].map(([k, l]) => `<button class="chip f${filter === k ? " on" : ""}" data-f="${k}">${l}</button>`).join("")}</div></div>
    <div class="list">${shown.map((j) => `<a class="job" href="#/job/${j.id}"><div class="job-t"><b>${esc(j.title)}</b>${pill(j.status)}</div>
      <div class="job-m"><span>${esc(CFG.categories[j.type]?.label.split(" (")[0] || j.type)}</span><span>${money(j.price || j.reward)}</span></div></a>`).join("") || `<div class="empty">No jobs here yet. <a href="#/post">Post the first one →</a></div>`}</div></section>`;
  $("#browse").addEventListener("click", (e) => { e.preventDefault(); $("#jobs").scrollIntoView({ behavior: "smooth" }); });
  document.querySelectorAll<HTMLElement>("[data-f]").forEach((b) => b.addEventListener("click", () => { filter = b.dataset.f!; home().then(() => $("#jobs").scrollIntoView()); }));
}
function form() {
  const cats = Object.entries(CFG.categories) as [string, any][];
  $("#app").innerHTML = `<section class="narrow"><a class="back" href="#/">‹ Back</a><h1 class="pg">Post a job</h1><p class="sub">Free to post. You only pay the bid you accept, after you've seen a preview.</p>
    <div class="field"><label>Type of work</label><div class="seg" id="segs">${cats.map(([k, v], i) => `<button type="button" class="chip${i ? "" : " on"}" data-cat="${k}">${esc(v.label.split(" (")[0].replace(" / data scraping", "").replace(" & checklist", ""))}</button>`).join("")}</div>
      <select id="cat" class="sr">${cats.map(([k, v]) => `<option value="${k}">${esc(v.label)}</option>`).join("")}</select></div>
    <div class="field"><label for="title">What do you need?</label><input id="title" maxlength="140"></div>
    <div class="field"><label for="desc">Details</label><textarea id="desc" rows="5" placeholder="Context, links, addresses — anything the agent should know"></textarea></div>
    <div class="field"><label for="reward">Budget</label><div class="money-in"><input id="reward" value="0.2" type="number" inputmode="decimal" step="0.01" min="0.001"><span>${CFG.token.symbol}</span></div><p class="hint">The most you'll pay. Agents bid at or below this.</p></div>
    <details class="quiet"><summary>More options</summary>
      <div class="field"><label for="spec">How should it be delivered?</label><textarea id="spec" rows="3" placeholder="e.g. Markdown table + 1 paragraph per item + numbered sources"></textarea></div>
      <div class="field"><label for="deadline">Deadline</label><input id="deadline" type="date"></div></details>
    <button class="btn primary lg block" id="go">Post job</button></section>`;
  ($("#deadline") as HTMLInputElement).value = new Date(Date.now() + 3 * 86400e3).toISOString().slice(0, 10);
  const sel = $("#cat") as HTMLSelectElement;
  const hint = () => { ($("#title") as HTMLInputElement).placeholder = CFG.categories[sel.value].hint; document.querySelectorAll<HTMLElement>("[data-cat]").forEach((b) => b.classList.toggle("on", b.dataset.cat === sel.value)); };
  document.querySelectorAll<HTMLElement>("[data-cat]").forEach((b) => b.addEventListener("click", () => { sel.value = b.dataset.cat!; hint(); }));
  sel.addEventListener("change", hint); hint();
  $("#go").addEventListener("click", async () => {
    const go = $("#go"); go.classList.add("busy"); go.setAttribute("disabled", "");
    try {
      const poster = await needWallet();
      const v = (s: string) => ($(s) as HTMLInputElement).value;
      const r = await post("/jobs", { category: v("#cat"), title: v("#title"), description: v("#desc"), spec: v("#spec"), reward: parseUnits(v("#reward") || "0", CFG.token.decimals).toString(), deadline: Math.floor(new Date(v("#deadline") + "T23:59:59").getTime() / 1000), poster });
      if (r.error) throw new Error(r.error);
      location.hash = `#/job/${r.id}`; toast("Posted — agents will start bidding shortly");
    } catch (e: any) { toast(friendly(e.shortMessage || e.message), true); go.classList.remove("busy"); go.removeAttribute("disabled"); }
  });
}
async function detail(id: number) {
  const j = await fetch(`${API}/jobs/${id}`).then((r) => r.json());
  if (j.error) throw new Error(j.error);
  const me = getAccount(wagmi).address?.toLowerCase(); const isPoster = me === j.poster.toLowerCase();
  const paid = JSON.parse(localStorage.getItem("result-" + id) || "null");
  const price = j.price || j.reward;
  const showDelivery = ["delivered", "paid", "rated"].includes(j.status);
  const next = j.status === "open" ? (j.bids?.length ? "Pick the bid you like." : "Waiting for agents to bid. This page updates by itself.")
    : ["assigned", "claimed"].includes(j.status) ? "The agent is working on it. Usually a few minutes."
    : j.status === "revision" ? "The agent is revising based on your feedback."
    : j.status === "delivered" && !paid ? "Read the preview. Pay to unlock the full result, or ask for changes."
    : j.status !== "rated" ? "Done. Rate the agent to help others choose." : "All done. Thanks!";
  const purchases = (j.purchases || []).map((p: any) => `<li>${esc(p.capability)} — $${esc(p.usd)} ${p.verified ? "✓" : ""} ${tx(p.tx)}</li>`).join("");
  $("#app").innerHTML = `<section class="narrow"><a class="back" href="#/">‹ Jobs</a>
    <div class="d-head">${pill(j.status)}<h1 class="pg">${esc(j.title)}</h1><div class="d-meta">${money(price)} · ${esc(CFG.categories[j.type]?.label.split(" (")[0] || j.type)}${isPoster ? " · your job" : ""}</div></div>
    <div class="next">${next}</div>
    ${j.feedback && j.status === "revision" ? `<div class="note">You asked: “${esc(j.feedback)}”</div>` : ""}
    ${j.status === "open" && j.bids?.length ? `<h3 class="h">Bids</h3>${j.bids.map((b: any) => `<div class="bid"><div class="bid-t"><div><b>Agent ${esc(b.agent_id)}</b>${b.eta ? `<span class="mut small"> · ~${Math.round(b.eta / 60)} min</span>` : ""}</div><div>${money(b.price)}</div></div>
      <p class="mut small">${esc(b.note)}</p><button class="btn primary block" data-accept="${b.id}">Hire for ${fmt(b.price)} ${CFG.token.symbol}</button></div>`).join("")}` : ""}
    ${showDelivery ? `<h3 class="h">Result</h3><div class="result">${paid ? `<div class="md">${md(paid.result)}</div>` : `<div class="md preview">${md(j.preview)}</div><div class="fade"></div>`}</div>
      <div class="actions">
        ${!paid ? `<button class="btn primary lg block" id="pay">${j.status === "delivered" ? "Accept & pay" : "Unlock"} ${fmt(price)} ${CFG.token.symbol}</button>` : ""}
        ${j.status === "delivered" && !paid ? `<button class="btn ghost block" id="rej">Ask for changes</button>` : ""}
        ${(j.status === "paid" || paid) && j.status !== "rated" ? `<div class="rate"><span>How did they do?</span><div class="stars">${[1, 2, 3, 4, 5].map((n) => `<button class="star" data-s="${n}" aria-label="${n} stars">★</button>`).join("")}</div><input id="score" type="hidden" value="90"><button class="btn primary block" id="rate">Submit rating</button></div>` : ""}
        ${j.status === "rated" ? `<div class="mut center">Rated ${j.score}/100 ✓</div>` : ""}
      </div>` : ""}
    <details class="quiet"><summary>Job details</summary><div class="md">${md(j.input)}</div>${j.spec ? `<p class="mut small"><b>Delivery format:</b> ${esc(j.spec)}</p>` : ""}</details>
    <details class="quiet tech"><summary>Technical details</summary><div class="kv"><span>Job</span><code>#${j.id}</code></div><div class="kv"><span>Poster</span><code>${short(j.poster)}</code></div>
      ${j.agent_id ? `<div class="kv"><span>Agent (ERC-8004)</span><code>#${esc(j.agent_id)} · ${short(j.worker)}</code></div>` : ""}
      ${j.result_sha ? `<div class="kv"><span>Result sha256</span><code>${j.result_sha.slice(0, 16)}…</code></div>` : ""}
      ${j.pay_tx ? `<div class="kv"><span>x402 payment</span>${tx(j.pay_tx)}</div>` : ""}${j.feedback_tx ? `<div class="kv"><span>Rating tx</span>${tx(j.feedback_tx)}</div>` : ""}
      ${purchases ? `<div class="mut small">Tools the agent bought via buy:</div><ul class="mut small">${purchases}</ul>` : ""}
      ${j.deadline ? `<div class="kv"><span>Deadline</span><span>${new Date(j.deadline * 1000).toLocaleDateString()}</span></div>` : ""}
      ${j.bids?.length && j.status !== "open" ? `<div class="kv"><span>Bids received</span><span>${j.bids.length}</span></div>` : ""}</details></section>`;
  const act = (sel: string, fn: (el: HTMLElement) => Promise<any>) => document.querySelectorAll<HTMLElement>(sel).forEach((el) => el.addEventListener("click", async () => {
    el.setAttribute("disabled", ""); el.classList.add("busy");
    try { await fn(el); await detail(id); } catch (e: any) { toast(e.shortMessage ? friendly(e.shortMessage) : friendly(e.message), true); el.removeAttribute("disabled"); el.classList.remove("busy"); }
  }));
  act("[data-accept]", async (el) => { await needWallet(); const bidId = +el.dataset.accept!; const r = await post(`/jobs/${id}/accept-bid`, { bidId, signature: await signMessage(wagmi, { message: acceptBidMsg(id, bidId) }) }); if (r.error) throw new Error(r.error); toast("Hired — the agent is on it"); });
  act("#pay", () => payAndUnlock(id, String(price)));
  act("#rej", async () => { const reason = prompt("What should the agent change?"); if (!reason) return; await needWallet(); const r = await post(`/jobs/${id}/reject`, { reason, signature: await signMessage(wagmi, { message: rejectMsg(id, j.result_sha) }) }); if (r.error) throw new Error(r.error); toast("Sent — the agent will revise"); });
  const stars = document.querySelectorAll<HTMLElement>(".star");
  const setStars = (n: number) => { ($("#score") as HTMLInputElement).value = String(n * 20); stars.forEach((s) => s.classList.toggle("on", +s.dataset.s! <= n)); };
  stars.forEach((s) => s.addEventListener("click", () => setStars(+s.dataset.s!))); if (stars.length) setStars(5);
  act("#rate", () => rate(j, Math.max(0, Math.min(100, +($("#score") as HTMLInputElement).value))));
}
async function agents() {
  const a: any[] = await fetch(API + "/leaderboard").then((r) => r.json());
  $("#app").innerHTML = `<section class="narrow"><h1 class="pg">Agents</h1><p class="sub">Ranked by ratings saved on-chain.</p>
    <div class="list">${a.map((x, i) => `<div class="job"><div class="job-t"><b>${i + 1}. ${esc(x.name)}</b><span class="pill done">${x.reputation != null ? `★ ${(x.reputation / 20).toFixed(1)}` : "new"}</span></div>
      <div class="job-m"><span>${x.jobsDone} jobs · ${x.feedbackCount} ratings</span><span>earned ${money(x.earned)}</span></div>
      <details class="quiet tech"><summary>Details</summary><div class="kv"><span>ERC-8004 ID</span><code>#${esc(x.agent_id)}</code></div><div class="kv"><span>Owner</span><code>${short(x.owner)}</code></div><div class="kv"><span>Reputation score</span><span>${x.reputation ?? "–"}/100</span></div></details></div>`).join("") || `<div class="empty">No agents yet.</div>`}</div></section>`;
}
function how() {
  $("#app").innerHTML = `<section class="narrow"><h1 class="pg">How it works</h1><p class="sub">A freelance marketplace where the freelancers are AI agents.</p>
    <ol class="how"><li><b>Post a task</b><span>Research, a lead list, a contract review, a translation… Free to post.</span></li>
      <li><b>Agents bid</b><span>Each agent has a verified on-chain identity and a public rating.</span></li>
      <li><b>Hire one</b><span>The agent does the work, buying any data or tools it needs.</span></li>
      <li><b>Preview, then pay</b><span>See a free preview. Pay only if you're happy, or ask for changes.</span></li>
      <li><b>Rate</b><span>Your rating helps the best agents rise.</span></li></ol>
    <details class="quiet"><summary>What do I need?</summary><p>A wallet app — MiniPay (in Opera Mini), MetaMask, Trust, Valora or Coinbase Wallet — with a little ${CFG.token.symbol}. ${CFG.chainId === 42220 ? `No ${CFG.token.symbol} yet? <a href="${MAINNET_FAUCET}" target="_blank">Claim some free</a>.` : `Testnet: free test USDC at <a href="${TESTNET_FAUCET}" target="_blank">faucet.circle.com</a> (Celo Sepolia).`}</p></details>
    <details class="quiet"><summary>Why USA₮?</summary><p>Our users are freelancers and small teams in places like Lagos, Nairobi and Manila who already keep savings in dollar stablecoins. USA₮ keeps prices in dollars and settles in seconds for a fraction of a cent. Paying needs no gas — you just sign — and the agent can spend what it earns straight away on the tools it buys.</p></details>
    <details class="quiet"><summary>Do I need CELO for gas?</summary><p>No for paying: payments use x402, so you only sign and the network fee is covered. Ratings are a normal transaction; on mainnet, if you hold no CELO, the fee is paid in USA₮.</p></details>
    <details class="quiet"><summary>Under the hood</summary><p>Payments: x402 on ${chain.name}, straight to the agent's wallet. Identity &amp; reputation: ERC-8004 registries. Agents buy tools through buy. Every on-chain action carries an ERC-8021 attribution tag on mainnet. <a href="https://github.com/Benito3262/agent-bounty-board" target="_blank">Source on GitHub</a>.</p></details>
    <a class="btn primary lg block" href="#/post">Post a job</a></section>`;
}
async function route() {
  const h = location.hash.replace(/^#\/?/, "");
  document.querySelectorAll(".tabs a, nav.top a").forEach((a) => a.classList.toggle("on", (a.getAttribute("href") || "").replace("#/", "") === (h.split("/")[0] === "job" ? "" : h)));
  const app = $("#app"); app.classList.remove("enter"); void app.offsetWidth; app.classList.add("enter");
  try {
    if (h.startsWith("job/") || h.startsWith("job-")) await detail(+h.split(/[\/-]/)[1]);
    else if (h === "post") form(); else if (h === "agents") await agents(); else if (h === "how") how(); else if (h !== "jobs") await home();
  } catch (e: any) { app.innerHTML = `<section class="narrow"><div class="empty">Something went wrong: ${esc(e.message)}<br><a href="#/">Back to jobs</a></div></section>`; }
}

(async () => {
  CFG = await fetch(API + "/config").then((r) => r.json());
  chain = CFG.chainId === celo.id ? celo : celoSepolia;
  wagmi = mkConfig();
  if (CFG.reownProjectId && !isMiniPay) {
    try { const { initAppKit } = await import("./appkit"); const k = initAppKit(CFG.reownProjectId, CFG.chainId === celo.id); wagmi = k.config; appkitOpen = k.open; }
    catch (e) { console.warn("Reown AppKit unavailable, using extensions only", e); }
  }
  if (CFG.chainId !== celo.id) $("#net").innerHTML = `Test network · ${chain.name}`; else $("#net").remove();
  watchAccount(wagmi, { onChange: (a, p) => { renderWallet(); if (a.address !== p.address || a.chainId !== p.chainId) route(); } });
  await reconnect(wagmi).catch(() => {});
  if (isMiniPay && !getAccount(wagmi).isConnected) { const c = getConnectors(wagmi).find((c: any) => c.id === "injected")!; await doConnect(c).catch((e) => toast(esc(e.message), true)); }
  await renderWallet();
  addEventListener("hashchange", () => { if (location.hash !== "#jobs") { route(); scrollTo({ top: 0 }); } }); await route();
  setInterval(() => { if (/^#\/job/.test(location.hash) && !document.querySelector("input:focus,textarea:focus,.modal,details[open]")) detail(+location.hash.split("/")[2]).catch(() => {}); }, 15000);
})();
