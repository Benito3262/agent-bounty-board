// Verifies ERC-8021 encoding against celo-org/attribution-tags BUILDERS.md / INDEXERS.md (Schema 0):
// [calldata][code ascii][len:1][schema 0x00][marker 0x80218021 x8]. No network, no txs.
import test from "node:test"; import assert from "node:assert/strict";
import { createWalletClient, custom, encodeFunctionData, parseTransaction, toHex, concat, keccak256 } from "viem";
import { privateKeyToAccount, generatePrivateKey } from "viem/accounts";
import { celo, celoSepolia } from "viem/chains";
import { toDataSuffix, fromDataSuffix } from "@celo/attribution-tags";
import { suffixFor, tagClient } from "../src/attribution";
import { reputationAbi } from "../src/abi";

const TAG = "celo_620289f1f610"; const MARKER = "80218021802180218021802180218021";

test("suffix bytes match the Schema 0 wire format", () => {
  const manual = "0x" + Buffer.from(TAG).toString("hex") + TAG.length.toString(16).padStart(2, "0") + "00" + MARKER;
  assert.equal(toDataSuffix(TAG), manual);
  assert.equal(manual, "0x63656c6f5f363230323839663166363130110080218021802180218021802180218021");
  assert.deepEqual(fromDataSuffix(concat(["0xdeadbeef", manual as `0x${string}`])), { codes: [TAG], schemaId: 0 });
});

test("suffix only on Celo mainnet (42220)", () => {
  assert.equal(suffixFor(42220, TAG), toDataSuffix(TAG));
  assert.equal(suffixFor(11142220, TAG), undefined);
  assert.equal(suffixFor(42220, ""), undefined);
});

// Capture the signed raw tx instead of broadcasting it.
function mockClient(chain: any) {
  let raw: `0x${string}` | null = null;
  const transport = custom({ async request({ method, params }: any) {
    switch (method) {
      case "eth_chainId": return toHex(chain.id);
      case "eth_getTransactionCount": return "0x0";
      case "eth_estimateGas": return "0x30000";
      case "eth_gasPrice": case "eth_maxPriorityFeePerGas": return "0x3b9aca00";
      case "eth_getBlockByNumber": return { baseFeePerGas: "0x3b9aca00", number: "0x1", timestamp: "0x1" };
      case "eth_sendRawTransaction": raw = params[0]; return keccak256(params[0]);
      default: throw new Error("unexpected " + method);
    } } });
  return { w: createWalletClient({ account: privateKeyToAccount(generatePrivateKey()), chain, transport }), raw: () => raw! };
}
const args = [880n, 95n, 0, "bounty", "research", "https://x/result", "https://x/job", ("0x" + "11".repeat(32)) as `0x${string}`] as const;
const plain = encodeFunctionData({ abi: reputationAbi, functionName: "giveFeedback", args: args as any });

test("mainnet client tags writeContract (feedback/register) calldata", async () => {
  const m = mockClient(celo); const w = tagClient(m.w, celo.id, TAG);
  await w.writeContract({ address: "0x8004BAa17C55a88189AE136b182e5fdA19dE9b63", abi: reputationAbi, functionName: "giveFeedback", args: args as any } as any);
  const data = parseTransaction(m.raw()).data!;
  assert.equal(data, concat([plain, toDataSuffix(TAG) as `0x${string}`]));
  assert.ok(data.endsWith(MARKER));
  assert.deepEqual(fromDataSuffix(data), { codes: [TAG], schemaId: 0 });
});

test("mainnet client tags plain sendTransaction", async () => {
  const m = mockClient(celo); const w = tagClient(m.w, celo.id, TAG);
  await w.sendTransaction({ to: "0x000000000000000000000000000000000000dEaD", value: 0n } as any);
  assert.deepEqual(fromDataSuffix(parseTransaction(m.raw()).data!), { codes: [TAG], schemaId: 0 });
});

test("Celo Sepolia client is NOT tagged", async () => {
  const m = mockClient(celoSepolia); const w = tagClient(m.w, celoSepolia.id, TAG);
  await w.writeContract({ address: "0x8004B663056A597Dffe9eCcC1965A193B7388713", abi: reputationAbi, functionName: "giveFeedback", args: args as any } as any);
  assert.equal(parseTransaction(m.raw()).data, plain);
});
