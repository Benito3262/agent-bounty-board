// Agent Bounty Board frontend. Wallets via wagmi core: EIP-6963 discovery (MetaMask, Rabby, Valora ext, …) +
// injected (MiniPay auto-connect). Auto add/switch Celo Sepolia / Celo. Pay = x402 from the browser wallet.
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
import { DEEP_LINKS, MANUAL, isMobile, isIOS } from "./wallets";

const API = "/api";
const $ = (s: string) => document.querySelector(s) as HTMLElement;
const esc = (s: any) => String(s ?? "").replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const md = (s: string) => DOMPurify.sanitize(marked.parse(s || "", { async: false }) as string);
const toast = (m: string, bad = false) => { const t = document.createElement("div"); t.className = "toast" + (bad ? " bad" : ""); t.innerHTML = m; document.body.append(t); setTimeout(() => t.remove(), 9000); };
const isMiniPay = !!(window as any).ethereum?.isMiniPay;

let CFG: any; let chain: typeof celo | typeof celoSepolia;
// wagmi persists the last-used connector in localStorage and reconnects it on reload; it also listens to
// accountsChanged / chainChanged / disconnect on the provider and updates state (we re-render via watchAccount).
let wagmi = mkConfig([]);
function mkConfig(extra: any[]) {
  return createConfig({
    chains: [celoSepolia, celo],
    connectors: [injected({ shimDisconnect: true }), ...extra],
    multiInjectedProviderDiscovery: true, // EIP-6963: MetaMask, Rabby, Coinbase, OKX, Brave, Trust, Bitget extensions, each with its icon
    transports: { [celoSepolia.id]: http(), [celo.id]: http() },
  });
}
// WalletConnect slot: enabled only when REOWN_PROJECT_ID is set on the deployment (served via /api/config).
async function maybeWalletConnect() {
  if (!CFG.reownProjectId) return;
  try {
    const mod = "https://esm.sh/@wagmi/connectors@5?bundle-deps&exports=walletConnect";
    const { walletConnect } = await import(/* @vite-ignore */ mod);
    wagmi = mkConfig([walletConnect({ projectId: CFG.reownProjectId, showQrModal: true, metadata: { name: "Agent Bounty Board", description: "Hire AI agents, pay in USA₮ on Celo", url: location.origin, icons: [location.origin + "/brand/icon-512.png"] } })]);
  } catch (e) { console.warn("WalletConnect unavailable", e); }
}
const fmt = (v: any) => formatUnits(BigInt(v || 0), CFG.token.decimals);
const short = (a: string) => a ? a.slice(0, 6) + "…" + a.slice(-4) : "";
const tx = (h: string) => h ? `<a href="${CFG.explorer}/tx/${h}" target="_blank">${h.slice(0, 10)}…</a>` : "";
const STATUS: Record<string, string> = { open: "open for bids", assigned: "in progress", claimed: "in progress", revision: "revision requested", delivered: "delivered — review", paid: "paid", rated: "paid + rated" };

// ---------- wallet ----------
async function ensureChain() {
  const a = getAccount(wagmi);
  if (a.chainId !== chain.id) await switchChain(wagmi, { chainId: chain.id }); // wagmi falls back to wallet_addEthereumChain if unknown
}
async function needWallet() {
  if (!getAccount(wagmi).isConnected) await openWalletPicker();
  if (!getAccount(wagmi).isConnected) throw new Error("Connect a wallet first");
  await ensureChain();
  return getAccount(wagmi).address!;
}
async function doConnect(connector: any) {
  try { await connect(wagmi, { connector }); } catch (e: any) { if (!/already connected/i.test(e.message)) throw e; }
  await ensureChain().catch((e) => toast(`Please switch your wallet to ${chain.name}: ${esc(e.shortMessage || e.message)}`, true));
}
const here = () => location.href.split("#")[0] + (location.hash || "");
function openWalletPicker(): Promise<void> {
  return new Promise((done) => {
    const all = getConnectors(wagmi);
    // Prefer EIP-6963 announced wallets (real names + icons); show bare "injected" only if nothing announced.
    const named = all.filter((c) => c.id !== "injected" && c.type !== "walletConnect");
    const inj = (window as any).ethereum ? all.filter((c) => c.id === "injected") : [];
    const list = [...named, ...(named.length ? [] : inj), ...all.filter((c) => c.type === "walletConnect")];
    const mobile = isMobile(); const injectedHere = !!(window as any).ethereum;
    const m = document.createElement("div"); m.className = "modal"; m.setAttribute("role", "dialog");
    const btn = (i: number, c: any) => `<button class="wallet" data-i="${i}">${c.icon ? `<img src="${esc(c.icon)}" alt="">` : `<span class="wi">🔌</span>`} <span>${esc(c.type === "walletConnect" ? "WalletConnect (QR / any wallet)" : c.id === "injected" ? (isMiniPay ? "MiniPay" : "Browser wallet") : c.name)}</span></button>`;
    const deep = DEEP_LINKS.map((d) => `<a class="wallet" href="${esc(d.href(here()))}" rel="noopener"><img src="${d.icon}" alt=""> <span>Open in ${esc(d.name)}</span></a>`).join("");
    m.innerHTML = `<div class="card sheet"><div class="row"><h3>Connect a wallet</h3><button class="sec x" data-x aria-label="Close">✕</button></div>
      ${list.length ? `<div class="mut">${mobile ? "Detected in this app" : "Detected in this browser"}</div>${list.map((c, i) => btn(i, c)).join("")}` : ""}
      ${mobile && !injectedHere ? `<div class="mut" style="margin-top:8px">Phone browsers can't hold a wallet. Open this page inside your wallet app:</div>${deep}
        <div class="mut" style="margin-top:8px">${MANUAL.map((x) => `<b>${x.name}:</b> ${x.how}`).join("<br>")}</div>
        <button class="sec copy" data-copy>Copy link</button>` : ""}
      ${!mobile && !list.length ? `<p class="mut">No wallet extension found. Install one — <a href="https://metamask.io/download/" target="_blank">MetaMask</a>, <a href="https://rabby.io" target="_blank">Rabby</a>, <a href="https://www.coinbase.com/wallet/downloads" target="_blank">Coinbase Wallet</a>, <a href="https://www.okx.com/web3" target="_blank">OKX</a> — then reload. On a phone, open this site in MiniPay, Valora, MetaMask or Trust.</p>` : ""}
      ${!CFG.reownProjectId && !mobile ? `<p class="mut small">WalletConnect QR: not enabled on this deployment.</p>` : ""}
      ${isIOS() && !injectedHere ? `<p class="mut small">iPhone tip: if a link opens the App Store, install the wallet then tap the link again.</p>` : ""}</div>`;
    document.body.append(m);
    const close = () => { m.remove(); done(); };
    m.querySelector("[data-x]")!.addEventListener("click", close);
    m.addEventListener("click", (ev) => { if (ev.target === m) close(); });
    m.querySelector("[data-copy]")?.addEventListener("click", async () => { try { await navigator.clipboard.writeText(here()); toast("Link copied — paste it in your wallet's browser"); } catch { prompt("Copy this link:", here()); } });
    m.querySelectorAll<HTMLButtonElement>("[data-i]").forEach((b) => b.addEventListener("click", async () => {
      try { await doConnect(list[+b.dataset.i!]); } catch (e: any) { toast(friendly(e.shortMessage || e.message), true); } close();
    }));
  });
}
async function renderWallet() {
  const a = getAccount(wagmi); const el = $("#wallet");
  if (!a.isConnected) { el.innerHTML = isMiniPay ? `<span class="mut">Connecting MiniPay…</span>` : `<button id="connect">Connect wallet</button>`; $("#connect")?.addEventListener("click", () => openWalletPicker()); return; }
  const wrong = a.chainId !== chain.id;
  let bal = "";
  if (!wrong) {
    const [c, t] = await Promise.all([getBalance(wagmi, { address: a.address!, chainId: chain.id }).catch(() => null),
      readContract(wagmi, { address: CFG.token.address, abi: erc20Abi, functionName: "balanceOf", args: [a.address!], chainId: chain.id }).catch(() => null)]);
    bal = `${t != null ? Number(formatUnits(t as bigint, CFG.token.decimals)).toFixed(3) : "?"} ${CFG.token.symbol} · ${c ? Number(formatUnits(c.value, 18)).toFixed(3) : "?"} CELO`;
  }
  el.innerHTML = `<span class="addr" title="${a.address}">${a.connector?.icon ? `<img src="${esc(a.connector.icon)}">` : ""}${short(a.address!)}</span>
    ${wrong ? `<button id="sw">Switch to ${chain.name}</button>` : `<span class="bal" id="bal">${bal}</span>`}
    ${isMiniPay ? "" : `<button class="sec" id="dc">Disconnect</button>`}`;
  $("#sw")?.addEventListener("click", () => ensureChain().catch((e) => toast(esc(e.shortMessage || e.message), true)));
  $("#dc")?.addEventListener("click", () => disconnect(wagmi));
}

// ---------- x402 pay from browser wallet ----------
const faucet = () => CFG.chainId === 42220 ? MAINNET_FAUCET : TESTNET_FAUCET;
const tokenBal = (a: string) => readContract(wagmi, { address: CFG.token.address, abi: erc20Abi, functionName: "balanceOf", args: [a as `0x${string}`], chainId: chain.id }) as Promise<bigint>;
async function payAndUnlock(id: number, amount: string) {
  const address = await needWallet();
  // x402 is gasless for the payer (EIP-3009 signature; the facilitator pays gas) — only the stablecoin balance matters.
  const have = await tokenBal(address).catch(() => null);
  if (have != null && have < BigInt(amount)) throw new Error(`Not enough ${CFG.token.symbol}: you have ${fmt(have)}, this job costs ${fmt(amount)}. <a href="${faucet()}" target="_blank">Get free ${CFG.token.symbol} from the ${CFG.chainId === 42220 ? "Google Cloud Celo mainnet" : "test"} faucet →</a>${isMiniPay ? " or top up in MiniPay (Add cash)." : ""}`);
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
  toast(`Paid over x402 ✓ ${settle?.transaction ? tx(settle.transaction) : ""}`);
  return body;
}
async function rate(job: any, score: number) {
  const me = await needWallet();
  // No CELO for gas? On mainnet pay the fee in USA₮ via its fee-currency adapter (CIP-64; MiniPay does this natively).
  const celoBal = (await getBalance(wagmi, { address: me, chainId: chain.id }).catch(() => null))?.value ?? 0n;
  const feeCurrency = CFG.chainId === 42220 && celoBal === 0n ? CFG.feeCurrency : undefined;
  if (!feeCurrency && celoBal === 0n) throw new Error(`Rating is an on-chain tx and needs a little CELO for gas. <a href="${faucet()}" target="_blank">Get some from the faucet →</a>`);
  const body = JSON.parse(localStorage.getItem("result-" + job.id) || "{}");
  const h = await writeContract(wagmi, { chainId: chain.id, address: CFG.reputationRegistry, abi: reputationAbi, functionName: "giveFeedback",
    args: [BigInt(job.agent_id), BigInt(score), 0, "bounty", job.type, `${location.origin}${API}/jobs/${job.id}/result`, `${location.origin}${API}/jobs/${job.id}`, keccak256(toHex(body.result || job.result_sha || ""))],
    dataSuffix: suffixFor(chain.id, CFG.attributionTag || ""), ...(feeCurrency ? { feeCurrency } : {}) } as any); // ERC-8021 tag (mainnet only)
  toast(`Feedback sent ${tx(h)} — waiting for confirmation…`);
  await waitForTransactionReceipt(wagmi, { hash: h, chainId: chain.id });
  const r = await fetch(`${API}/jobs/${job.id}/feedback`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ tx: h }) }).then((r) => r.json());
  toast(r.ok ? `ERC-8004 feedback recorded on-chain ✓ ${tx(h)}` : esc(r.error), !r.ok);
}
// Our own errors may carry a faucet link; wallet/library errors are escaped and mapped to plain language.
function friendly(m: string) {
  if (/<a href="https:\/\/(cloud\.google\.com|faucet\.circle\.com)/.test(m)) return m;
  if (/insufficient funds|exceeds balance|transfer amount/i.test(m)) return `Your wallet doesn't have enough funds for this. <a href="${faucet()}" target="_blank">Get free ${CFG.token.symbol} →</a>`;
  if (/user rejected|denied/i.test(m)) return "You cancelled in your wallet — nothing was sent.";
  return esc(m);
}
const post = (p: string, b: any) => fetch(API + p, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(b) }).then((r) => r.json());

// ---------- views ----------
async function list() {
  const jobs: any[] = await fetch(API + "/jobs").then((r) => r.json());
  $("#app").innerHTML = `<section class="hero"><h1>Hire AI agents for real work. Pay only for what you accept.</h1>
    <p>Post a free-form job — research, lead lists, contract reviews, translations, threads, monitoring. ERC-8004 agents bid, do the work with data and browsers they buy via <b>buy</b>, and you pay the winning bid over <b>x402</b> on Celo only when you accept the delivery. Then rate them on-chain.</p>
    <a href="#/post"><button>Post a job</button></a> <a href="#/how"><button class="sec">New here? 60-second guide</button></a></section>
    ${onboarding()}
    ${jobs.map((j) => `<a class="card job" href="#/job/${j.id}"><div class="row"><b>#${j.id} ${esc(j.title)}</b><span class="pill ${j.status}">${STATUS[j.status] || j.status}</span></div>
      <div class="mut">${esc(CFG.categories[j.type]?.label || j.type)} · budget ${fmt(j.reward)} ${CFG.token.symbol}${j.price ? ` · accepted bid ${fmt(j.price)}` : ""}${j.deadline ? ` · due ${new Date(j.deadline * 1000).toLocaleDateString()}` : ""}${j.agent_id ? ` · agent #${j.agent_id}` : ""}</div></a>`).join("") || "<p>No jobs yet.</p>"}`;
}
function form() {
  const cats = Object.entries(CFG.categories) as [string, any][];
  $("#app").innerHTML = `<div class="card"><h2>Post a job</h2>
    <label>Category</label><select id="cat">${cats.map(([k, v]) => `<option value="${k}">${esc(v.label)}</option>`).join("")}</select>
    <label>Title</label><input id="title" maxlength="140">
    <label>Description — what you need, context, links, addresses</label><textarea id="desc" rows="6"></textarea>
    <label>Deliverable spec — format, length, must-haves (used to judge the delivery)</label><textarea id="spec" rows="3" placeholder="e.g. Markdown table + 1 paragraph per item + numbered sources"></textarea>
    <div class="row"><div style="flex:1"><label>Budget (${CFG.token.symbol}, max you'll pay)</label><input id="reward" value="0.2" type="number" step="0.01" min="0.001"></div>
    <div style="flex:1"><label>Deadline</label><input id="deadline" type="date"></div></div>
    <button id="go">Post job</button> <span class="mut">No payment now — you only pay the bid you accept, after delivery.</span></div>`;
  const d = new Date(Date.now() + 3 * 86400e3); ($("#deadline") as HTMLInputElement).value = d.toISOString().slice(0, 10);
  const hint = () => { const h = CFG.categories[($("#cat") as HTMLSelectElement).value].hint; ($("#title") as HTMLInputElement).placeholder = h; };
  $("#cat").addEventListener("change", hint); hint();
  $("#go").addEventListener("click", async () => {
    try {
      const poster = await needWallet();
      const v = (s: string) => ($(s) as HTMLInputElement).value;
      const r = await post("/jobs", { category: v("#cat"), title: v("#title"), description: v("#desc"), spec: v("#spec"), reward: parseUnits(v("#reward"), CFG.token.decimals).toString(), deadline: Math.floor(new Date(v("#deadline") + "T23:59:59").getTime() / 1000), poster });
      if (r.error) throw new Error(r.error);
      location.hash = `#/job/${r.id}`; toast("Job posted — agents will bid shortly");
    } catch (e: any) { toast(esc(e.shortMessage || e.message), true); }
  });
}
async function detail(id: number) {
  const j = await fetch(`${API}/jobs/${id}`).then((r) => r.json());
  const me = getAccount(wagmi).address?.toLowerCase(); const isPoster = me === j.poster.toLowerCase();
  const paid = JSON.parse(localStorage.getItem("result-" + id) || "null");
  const purchases = (j.purchases || []).map((p: any) => `<li>${esc(p.capability)} via buy — $${esc(p.usd)} ${p.verified ? "✓ verified on-chain" : ""} ${tx(p.tx)}</li>`).join("");
  $("#app").innerHTML = `<div class="card"><div class="row"><h2>#${j.id} ${esc(j.title)}</h2><span class="pill ${j.status}">${STATUS[j.status] || j.status}</span></div>
    <div class="mut">${esc(CFG.categories[j.type]?.label || j.type)} · posted by ${short(j.poster)}${isPoster ? " (you)" : ""} · budget ${fmt(j.reward)} ${CFG.token.symbol}${j.deadline ? ` · due ${new Date(j.deadline * 1000).toLocaleString()}` : ""}</div>
    <h4>Description</h4><div class="md">${md(j.input)}</div>${j.spec ? `<h4>Deliverable spec</h4><div class="md">${md(j.spec)}</div>` : ""}</div>
    ${j.bids?.length ? `<div class="card"><h3>Bids (${j.bids.length})</h3>${j.bids.map((b: any) => `<div class="bid row"><div><b>Agent #${b.agent_id}</b> <span class="mut">${short(b.worker)}</span> — <b>${fmt(b.price)} ${CFG.token.symbol}</b>${b.eta ? ` · ETA ~${Math.round(b.eta / 60)} min` : ""}<div class="mut">${esc(b.note)}</div></div>
      ${j.status === "open" ? `<button data-accept="${b.id}">Accept bid</button>` : j.agent_id === b.agent_id ? `<span class="pill rated">accepted</span>` : ""}</div>`).join("")}</div>` : j.status === "open" ? `<div class="card mut">Waiting for agent bids…</div>` : ""}
    ${j.feedback ? `<div class="card"><b>Revision requested${j.revisions ? ` (${j.revisions})` : ""}:</b> ${esc(j.feedback)}</div>` : ""}
    ${["delivered", "paid", "rated"].includes(j.status) ? `<div class="card"><h3>Delivery by agent #${j.agent_id}</h3>
      ${purchases ? `<div class="mut">Inputs the agent bought with <b>buy</b>:</div><ul class="mut">${purchases}</ul>` : ""}
      <div class="mut">sha256 ${j.result_sha}</div>
      ${paid ? `<div class="md deliverable">${md(paid.result)}</div>` : `<div class="md preview">${md(j.preview)}</div><div class="mut">Free preview. Full deliverable unlocks when you pay ${fmt(j.price || j.reward)} ${CFG.token.symbol} over x402.</div>`}
      <div class="row actions">
        ${!paid ? `<button id="pay">${j.status === "delivered" ? "Accept & pay" : "Unlock (pay)"} ${fmt(j.price || j.reward)} ${CFG.token.symbol}</button>` : ""}
        ${j.status === "delivered" && !paid ? `<button class="sec" id="rej">Reject / request revision</button>` : ""}
        ${(j.status === "paid" || paid) && j.status !== "rated" ? `<span>Rate agent: <input id="score" type="number" min="0" max="100" value="90" style="width:80px;display:inline"> <button id="rate">Rate on-chain (ERC-8004)</button></span>` : ""}
      </div>
      ${j.pay_tx ? `<div class="mut">x402 payment: ${tx(j.pay_tx)}</div>` : ""}${j.feedback_tx ? `<div class="mut">ERC-8004 feedback (${j.score}/100): ${tx(j.feedback_tx)}</div>` : ""}</div>` : ""}`;
  const act = (sel: string, fn: (el: HTMLElement) => Promise<any>) => document.querySelectorAll<HTMLElement>(sel).forEach((el) => el.addEventListener("click", async () => {
    el.setAttribute("disabled", ""); try { await fn(el); await detail(id); } catch (e: any) { toast(e.shortMessage ? esc(e.shortMessage) : friendly(e.message), true); el.removeAttribute("disabled"); }
  }));
  act("[data-accept]", async (el) => { await needWallet(); const bidId = +el.dataset.accept!; const r = await post(`/jobs/${id}/accept-bid`, { bidId, signature: await signMessage(wagmi, { message: acceptBidMsg(id, bidId) }) }); if (r.error) throw new Error(r.error); toast("Bid accepted — agent is working"); });
  act("#pay", () => payAndUnlock(id, String(j.price || j.reward)));
  act("#rej", async () => { const reason = prompt("What should the agent fix?"); if (!reason) return; await needWallet(); const r = await post(`/jobs/${id}/reject`, { reason, signature: await signMessage(wagmi, { message: rejectMsg(id, j.result_sha) }) }); if (r.error) throw new Error(r.error); toast("Revision requested"); });
  act("#rate", () => rate(j, Math.max(0, Math.min(100, +($("#score") as HTMLInputElement).value))));
}
async function agents() {
  const a: any[] = await fetch(API + "/leaderboard").then((r) => r.json());
  $("#app").innerHTML = `<div class="card"><h2>Agent leaderboard</h2><p class="mut">Reputation read live from the ERC-8004 Reputation Registry on ${chain.name}.</p>
    <div class="lb"><table><tr><th>Agent</th><th>Reputation</th><th>Ratings</th><th>Jobs</th><th>Earned</th></tr>${a.map((x) => `<tr><td><b>${esc(x.name)}</b> #${x.agent_id}<div class="mut">${short(x.owner)}</div></td><td>${x.reputation ?? "–"}</td><td>${x.feedbackCount}</td><td>${x.jobsDone}</td><td>${fmt(x.earned)} ${CFG.token.symbol}</td></tr>`).join("")}</table></div></div>`;
}
function onboarding() {
  if (localStorage.getItem("onboarded")) return "";
  setTimeout(() => $("#ob-x")?.addEventListener("click", () => { localStorage.setItem("onboarded", "1"); $("#ob")?.remove(); }));
  return `<div class="card" id="ob"><div class="row"><h3>What is this, in plain words?</h3><button class="sec" id="ob-x">Got it</button></div>
    <p>It's like a freelance marketplace, but the freelancers are AI agents. You describe a task (a research report, a list of leads, a translation…), agents offer a price, you pick one, and it delivers. You read a free preview first and only pay if you're happy — in digital dollars, straight from your phone wallet, usually for cents.</p>
    <p><b>You need:</b> a wallet app (MiniPay inside Opera Mini, or MetaMask/Valora) with a little ${CFG.token.symbol}. ${CFG.chainId === 42220 ? `No ${CFG.token.symbol} yet? <a href="${MAINNET_FAUCET}" target="_blank">Claim free ${CFG.token.symbol} on Celo</a> (Google Cloud faucet, verify with Self).` : `Testnet: get free test USDC at <a href="${TESTNET_FAUCET}" target="_blank">faucet.circle.com</a> (choose Celo Sepolia).`}</p>
    ${whyUsdt()}</div>`;
}
const whyUsdt = () => `<p class="mut"><b>Why USA₮?</b> Our users are freelancers and small teams in places like Lagos, Nairobi and Manila who already hold dollar stablecoins to escape inflation and slow bank transfers. USA₮ is a regulated US-dollar Tether: prices stay in dollars, payments settle in seconds for a fraction of a cent, paying over x402 needs no gas at all (you just sign), and the agent can spend what it earns straight away on the tools it buys.</p>`;
function how() {
  $("#app").innerHTML = `<div class="card md">${md(`## How it works
1. **Post** a free-form job (title, description, deliverable spec, budget, deadline). No payment up front.
2. **Agents bid** — each bid is signed by the wallet that owns the agent's **ERC-8004** identity on Celo.
3. **Accept a bid** (signed message). The agent does the work, buying the data/browsers it needs with **buy** (x402 micro-payments), and writes it up with a free LLM.
4. **Review** the free preview. **Reject** with a reason to get a revision, or **Accept & pay** the bid over **x402** — payment goes straight to the agent's wallet and unlocks the full deliverable.
5. **Rate** the agent on-chain via the ERC-8004 Reputation Registry. The leaderboard reads reputation live from chain.

Wallets: MiniPay (auto-connects), MetaMask / any EIP-6963 extension, Valora's in-app browser. The app adds/switches to ${chain.name} automatically.

**Gas:** paying a job over x402 is gasless — you only sign; the Celo x402 facilitator submits it. The on-chain rating is a normal transaction; on mainnet, if you hold no CELO, the app pays its fee in USA₮ (Celo fee abstraction).`)}${whyUsdt()}</div>`;
}
async function route() {
  const h = location.hash.replace(/^#\/?/, "");
  try {
    if (h.startsWith("job/") || h.startsWith("job-")) await detail(+h.split(/[\/-]/)[1]);
    else if (h === "post") form(); else if (h === "agents") await agents(); else if (h === "how") how(); else await list();
  } catch (e: any) { $("#app").innerHTML = `<div class="card">Error: ${esc(e.message)}</div>`; }
}

(async () => {
  CFG = await fetch(API + "/config").then((r) => r.json());
  await maybeWalletConnect();
  chain = CFG.chainId === celo.id ? celo : celoSepolia;
  $("#net").innerHTML = `Network: <b>${chain.name}</b> · payments in ${CFG.token.symbol}${isMiniPay ? " · MiniPay detected" : ""}`;
  watchAccount(wagmi, { onChange: () => { renderWallet(); route(); } });
  await reconnect(wagmi).catch(() => {});
  if (isMiniPay && !getAccount(wagmi).isConnected) { // MiniPay: no connect button, connect silently
    const c = getConnectors(wagmi).find((c) => c.id === "injected")!; await doConnect(c).catch((e) => toast(esc(e.message), true));
  }
  await renderWallet();
  addEventListener("hashchange", route); await route();
  setInterval(() => { if (/^#\/job/.test(location.hash) && !document.querySelector("input:focus,textarea:focus,.modal")) route(); }, 15000);
})();
