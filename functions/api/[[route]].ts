// Agent Bounty Board API — Cloudflare Pages Function (Hono) + D1 + x402 (Celo facilitator).
import { Hono } from "hono";
import { handle } from "hono/cloudflare-pages";
import { paymentMiddleware, x402ResourceServer } from "@x402/hono";
import { HTTPFacilitatorClient } from "@x402/core/server";
import { ExactEvmScheme } from "@x402/evm/exact/server";
import { createPublicClient, http, getAddress, isAddress, verifyMessage, parseEventLogs, decodeFunctionData } from "viem";
import { net, JOB_TYPES, claimMsg, deliverMsg, sha256hex } from "../../src/config";
import { identityAbi, reputationAbi, erc20Abi } from "../../src/abi";

type Env = { DB: D1Database; NETWORK?: string; X402_API_KEY: string; ATTRIBUTION_TAG?: string };
const BUY_PAYTO = "0x20faAca5F980E29639A0FCC6dcA6988E18ed333B"; // buy gateway payTo (same on Celo + Celo Sepolia)
const now = () => Math.floor(Date.now() / 1000);

const app = new Hono<{ Bindings: Env }>().basePath("/api");

const client = (e: Env) => createPublicClient({ transport: http(net(e.NETWORK).rpc) });
const pub = (j: any) => { const { result, ...rest } = j; return { ...rest, purchases: JSON.parse(rest.purchases || "[]") }; }; // never leak paid deliverable

app.get("/config", (c) => {
  const n = net(c.env.NETWORK);
  return c.json({ network: c.env.NETWORK || "testnet", ...n, jobTypes: JOB_TYPES, attributionTag: c.env.ATTRIBUTION_TAG || null });
});

app.get("/jobs", async (c) => {
  const status = c.req.query("status");
  const q = status
    ? c.env.DB.prepare("SELECT * FROM jobs WHERE network=? AND status=? ORDER BY id DESC LIMIT 100").bind(c.env.NETWORK || "testnet", status)
    : c.env.DB.prepare("SELECT * FROM jobs WHERE network=? ORDER BY id DESC LIMIT 100").bind(c.env.NETWORK || "testnet");
  const { results } = await q.all();
  return c.json(results.map(pub));
});

app.get("/jobs/:id", async (c) => {
  const j = await c.env.DB.prepare("SELECT * FROM jobs WHERE id=?").bind(+c.req.param("id")).first();
  return j ? c.json(pub(j)) : c.json({ error: "not found" }, 404);
});

app.post("/jobs", async (c) => {
  const b = await c.req.json<any>();
  if (!(b.type in JOB_TYPES)) return c.json({ error: "unknown job type" }, 400);
  if (!isAddress(b.poster || "")) return c.json({ error: "poster must be a wallet address" }, 400);
  const reward = String(b.reward ?? "10000");
  if (!/^\d+$/.test(reward) || BigInt(reward) < 1000n || BigInt(reward) > 5_000_000n) return c.json({ error: "reward must be 0.001–5 (base units 1000–5000000)" }, 400);
  const input = String(b.input || "").slice(0, 2000);
  if (!input) return c.json({ error: "input required" }, 400);
  const title = String(b.title || `${b.type}: ${input}`).slice(0, 120);
  const t = now();
  const r = await c.env.DB.prepare("INSERT INTO jobs (network,type,title,input,reward,poster,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?) RETURNING id")
    .bind(c.env.NETWORK || "testnet", b.type, title, input, reward, getAddress(b.poster), t, t).first<{ id: number }>();
  return c.json({ id: r!.id }, 201);
});

// Worker claims with a signature from the wallet that owns its ERC-8004 identity.
app.post("/jobs/:id/claim", async (c) => {
  const id = +c.req.param("id");
  const { agentId, signature } = await c.req.json<any>();
  const n = net(c.env.NETWORK);
  let owner: `0x${string}`;
  try { owner = await client(c.env).readContract({ address: n.identityRegistry, abi: identityAbi, functionName: "ownerOf", args: [BigInt(agentId)] }); }
  catch { return c.json({ error: "agentId is not a registered ERC-8004 agent on " + n.name }, 400); }
  const ok = await verifyMessage({ address: owner, message: claimMsg(id, String(agentId)), signature });
  if (!ok) return c.json({ error: "signature does not match the ERC-8004 agent owner" }, 401);
  const r = await c.env.DB.prepare("UPDATE jobs SET status='claimed', agent_id=?, worker=?, updated_at=? WHERE id=? AND status='open'").bind(String(agentId), owner, now(), id).run();
  if (!r.meta.changes) return c.json({ error: "job not open" }, 409);
  return c.json({ ok: true, worker: owner });
});

app.post("/jobs/:id/deliver", async (c) => {
  const id = +c.req.param("id");
  const { result, signature, purchases } = await c.req.json<any>();
  const j = await c.env.DB.prepare("SELECT * FROM jobs WHERE id=?").bind(id).first<any>();
  if (!j || j.status !== "claimed") return c.json({ error: "job not claimed" }, 409);
  const text = String(result || "").slice(0, 20000);
  const sha = await sha256hex(text);
  if (!(await verifyMessage({ address: j.worker, message: deliverMsg(id, sha), signature }))) return c.json({ error: "bad worker signature" }, 401);
  const preview = text.slice(0, 160) + (text.length > 160 ? "…" : "");
  // Build with buy: verify each claimed purchase on-chain (stablecoin Transfer to the buy gateway's payTo).
  const verified = [] as any[];
  for (const p of (Array.isArray(purchases) ? purchases : []).slice(0, 5)) {
    try {
      const rc = await client(c.env).getTransactionReceipt({ hash: p.tx });
      const logs = parseEventLogs({ abi: erc20Abi, logs: rc.logs, eventName: "Transfer" }) as any[];
      const hit = logs.find((l) => l.args.to.toLowerCase() === BUY_PAYTO.toLowerCase());
      verified.push({ ...p, payer: hit?.args.from ?? null, amount: hit ? String(hit.args.value) : p.amount, verified: !!hit });
    } catch { verified.push({ ...p, verified: false }); }
  }
  await c.env.DB.prepare("UPDATE jobs SET status='delivered', result=?, result_sha=?, preview=?, purchases=?, updated_at=? WHERE id=?").bind(text, sha, preview, JSON.stringify(verified), now(), id).run();
  return c.json({ ok: true, sha256: sha });
});

// Pay-on-delivery: the full deliverable is behind x402. payTo = the worker's wallet, price = the job reward.
app.use("/jobs/:id/result", async (c, next) => {
  const id = +c.req.param("id");
  const j = await c.env.DB.prepare("SELECT * FROM jobs WHERE id=?").bind(id).first<any>();
  if (!j) return c.json({ error: "not found" }, 404);
  if (j.status === "open" || j.status === "claimed") return c.json({ error: "not delivered yet" }, 409);
  const n = net(c.env.NETWORK);
  const facilitator = new HTTPFacilitatorClient({
    url: n.facilitator,
    createAuthHeaders: async () => { const h = { "X-API-Key": c.env.X402_API_KEY }; return { verify: h, settle: h, supported: h }; },
  });
  const server = new x402ResourceServer(facilitator);
  server.register("eip155:*", new ExactEvmScheme());
  server.onAfterSettle(async (ctx: any) => {
    const tx = ctx?.result?.transaction;
    if (tx) await c.env.DB.prepare("UPDATE jobs SET status=CASE WHEN status='delivered' THEN 'paid' ELSE status END, pay_tx=COALESCE(pay_tx,?), updated_at=? WHERE id=?").bind(tx, now(), id).run();
  });
  const routes = {
    "GET /api/jobs/:id/result": {
      accepts: [{ scheme: "exact", network: n.caip2, payTo: getAddress(j.worker),
        price: { amount: String(j.reward), asset: getAddress(n.token.address), extra: n.token.extra } }],
      description: `Deliverable for bounty #${id}: ${j.title}`,
      mimeType: "application/json",
    },
  } as any;
  return paymentMiddleware(routes, server)(c, next);
});
app.get("/jobs/:id/result", async (c) => {
  const j = await c.env.DB.prepare("SELECT id,title,type,result,result_sha,worker,agent_id FROM jobs WHERE id=?").bind(+c.req.param("id")).first();
  return c.json(j);
});

// Record on-chain ERC-8004 feedback. We verify the tx really is giveFeedback(agentId) from the poster.
app.post("/jobs/:id/feedback", async (c) => {
  const id = +c.req.param("id");
  const { tx } = await c.req.json<any>();
  const j = await c.env.DB.prepare("SELECT * FROM jobs WHERE id=?").bind(id).first<any>();
  if (!j || !j.agent_id) return c.json({ error: "job not found/claimed" }, 404);
  const pc = client(c.env); const n = net(c.env.NETWORK);
  const t = await pc.getTransaction({ hash: tx });
  const rc = await pc.getTransactionReceipt({ hash: tx });
  if (rc.status !== "success" || t.to?.toLowerCase() !== n.reputationRegistry.toLowerCase()) return c.json({ error: "not a successful reputation-registry tx" }, 400);
  const d = decodeFunctionData({ abi: reputationAbi, data: t.input.slice(0, t.input.length) as `0x${string}` });
  if (d.functionName !== "giveFeedback" || String(d.args[0]) !== String(j.agent_id)) return c.json({ error: "feedback is for a different agent" }, 400);
  await c.env.DB.prepare("UPDATE jobs SET status='rated', feedback_tx=?, score=?, updated_at=? WHERE id=?").bind(tx, Number(d.args[1]), now(), id).run();
  return c.json({ ok: true, score: Number(d.args[1]) });
});

// Fallback payment record (if afterSettle didn't fire): verify a token Transfer poster→worker ≥ reward.
app.post("/jobs/:id/paid", async (c) => {
  const id = +c.req.param("id");
  const { tx } = await c.req.json<any>();
  const j = await c.env.DB.prepare("SELECT * FROM jobs WHERE id=?").bind(id).first<any>();
  if (!j || !j.worker) return c.json({ error: "no worker" }, 404);
  const n = net(c.env.NETWORK);
  const rc = await client(c.env).getTransactionReceipt({ hash: tx });
  const logs = parseEventLogs({ abi: erc20Abi, logs: rc.logs.filter((l) => l.address.toLowerCase() === n.token.address.toLowerCase()), eventName: "Transfer" });
  const hit = logs.find((l: any) => l.args.to.toLowerCase() === j.worker.toLowerCase() && l.args.value >= BigInt(j.reward));
  if (!hit) return c.json({ error: "no matching payment in tx" }, 400);
  await c.env.DB.prepare("UPDATE jobs SET status=CASE WHEN status='delivered' THEN 'paid' ELSE status END, pay_tx=?, updated_at=? WHERE id=?").bind(tx, now(), id).run();
  return c.json({ ok: true });
});

// Worker agents list themselves (ERC-8004 identity verified on-chain).
app.post("/agents", async (c) => {
  const { agentId, name, skills } = await c.req.json<any>();
  const n = net(c.env.NETWORK); const pc = client(c.env);
  try {
    const owner = await pc.readContract({ address: n.identityRegistry, abi: identityAbi, functionName: "ownerOf", args: [BigInt(agentId)] });
    const uri = await pc.readContract({ address: n.identityRegistry, abi: identityAbi, functionName: "tokenURI", args: [BigInt(agentId)] }).catch(() => "");
    await c.env.DB.prepare("INSERT OR REPLACE INTO agents (network,agent_id,owner,uri,name,skills,created_at) VALUES (?,?,?,?,?,?,?)")
      .bind(c.env.NETWORK || "testnet", String(agentId), owner, uri, String(name || `Agent #${agentId}`).slice(0, 60), JSON.stringify(skills || []), now()).run();
    return c.json({ ok: true, owner });
  } catch { return c.json({ error: "not a registered ERC-8004 agent" }, 400); }
});

// Leaderboard: reputation read live from the ERC-8004 Reputation Registry.
app.get("/leaderboard", async (c) => {
  const n = net(c.env.NETWORK); const pc = client(c.env); const nw = c.env.NETWORK || "testnet";
  const { results: agents } = await c.env.DB.prepare("SELECT * FROM agents WHERE network=?").bind(nw).all<any>();
  const out = await Promise.all(agents.map(async (a) => {
    const stats = await c.env.DB.prepare("SELECT COUNT(*) jobs, SUM(CASE WHEN pay_tx IS NOT NULL THEN CAST(reward AS INTEGER) ELSE 0 END) earned FROM jobs WHERE network=? AND agent_id=? AND status IN ('delivered','paid','rated')").bind(nw, a.agent_id).first<any>();
    let count = 0, avg = null as number | null;
    try {
      const clients = await pc.readContract({ address: n.reputationRegistry, abi: reputationAbi, functionName: "getClients", args: [BigInt(a.agent_id)] });
      if (clients.length) {
        const [cnt, val, dec] = await pc.readContract({ address: n.reputationRegistry, abi: reputationAbi, functionName: "getSummary", args: [BigInt(a.agent_id), clients, "", ""] });
        count = Number(cnt); avg = Number(val) / 10 ** Number(dec);
      }
    } catch {}
    return { ...a, skills: JSON.parse(a.skills || "[]"), feedbackCount: count, reputation: avg, jobsDone: stats?.jobs || 0, earned: String(stats?.earned || 0) };
  }));
  out.sort((x, y) => (y.reputation ?? -1) - (x.reputation ?? -1) || y.jobsDone - x.jobsDone);
  return c.json(out);
});

app.onError((err, c) => c.json({ error: String(err?.message || err) }, 500));
export const onRequest = handle(app);
