// Offline checks for mainnet readiness + the revision path (no network, no txs).
import test from "node:test"; import assert from "node:assert/strict";
import { NETWORKS, feeCurrencyFor } from "../src/config";
import { buySandbox } from "../src/buy";
import { brief, finish } from "../src/jobs";

test("mainnet prices in USA₮ (6 decimals) via the Celo x402 facilitator", () => {
  const m = NETWORKS.mainnet;
  assert.equal(m.token.address, "0xD2ab3C9A02DBBAB236BfEC45D1d755DF4267F771");
  assert.equal(m.token.decimals, 6); assert.equal(m.caip2, "eip155:42220");
  assert.equal(m.facilitator, "https://api.x402.celo.org");
});

test("gas in USA₮ only on mainnet when CELO balance is 0", () => {
  assert.equal(feeCurrencyFor(NETWORKS.mainnet, 0n), "0x0357EE22278c922e1D36cFe6b899269b161880C4");
  assert.equal(feeCurrencyFor(NETWORKS.mainnet, 1n), undefined);
  assert.equal(feeCurrencyFor(NETWORKS.testnet, 0n), undefined);
});

test("buy is live (never sandbox) on mainnet", () => {
  assert.equal(buySandbox({ NETWORK: "mainnet", BUY_SANDBOX: "1" }), false);
  assert.equal(buySandbox({ NETWORK: "testnet" }), true);
  assert.equal(buySandbox({ NETWORK: "testnet", BUY_SANDBOX: "0" }), false);
});

test("revision: poster feedback reaches the LLM prompt (job #4 regression)", async () => {
  const job = { category: "leads", title: "20 Celo builders", description: "find builders", spec: "table", feedback: "Remove giveaway accounts and add follower counts" };
  assert.match(brief(job), /THEIR FEEDBACK: Remove giveaway accounts and add follower counts/);
  assert.doesNotMatch(brief({ ...job, feedback: null }), /FEEDBACK/);
  const orig = globalThis.fetch; let sent = "";
  globalThis.fetch = (async (_u: any, init: any) => { sent = init.body; return new Response(JSON.stringify({ choices: [{ message: { content: "revised" } }] })); }) as any;
  try {
    const d = await finish({ purchases: [], sources: [], log: [] } as any, job, "evidence", "fallback");
    assert.match(sent, /Remove giveaway accounts and add follower counts/);
    assert.match(d.markdown, /^revised/);
  } finally { globalThis.fetch = orig; }
});
