// Read-only: agent wallet's Celo MAINNET balances + whether it holds an ERC-8004 identity there. Sends nothing.
import "dotenv/config";
import { createPublicClient, http, formatUnits } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { NETWORKS } from "../src/config";
import { identityAbi, erc20Abi } from "../src/abi";
const M = NETWORKS.mainnet;
const pc = createPublicClient({ transport: http(M.rpc) });
const addr = privateKeyToAccount(process.env.WORKER_PK as `0x${string}`).address;
const [celo, usat, ids] = await Promise.all([
  pc.getBalance({ address: addr }),
  pc.readContract({ address: M.token.address, abi: erc20Abi, functionName: "balanceOf", args: [addr] }),
  pc.readContract({ address: M.identityRegistry, abi: [{ type: "function", name: "balanceOf", stateMutability: "view", inputs: [{ name: "owner", type: "address" }], outputs: [{ type: "uint256" }] }] as const, functionName: "balanceOf", args: [addr] }).catch(() => null),
]);
console.log(`Agent wallet ${addr} on Celo mainnet (chain ${M.chainId})`);
console.log(`  CELO: ${formatUnits(celo, 18)}`);
console.log(`  ${M.token.symbol}: ${formatUnits(usat as bigint, M.token.decimals)}`);
console.log(`  ERC-8004 identities owned (${M.identityRegistry}): ${ids ?? "unknown"} → ${ids && ids > 0n ? "REGISTERED" : "not registered"}`);
const id = process.env.MAINNET_AGENT_ID;
if (id) console.log(`  MAINNET_AGENT_ID ${id} owner: ${await pc.readContract({ address: M.identityRegistry, abi: identityAbi, functionName: "ownerOf", args: [BigInt(id)] }).catch(() => "does not exist")}`);
console.log(`  ATTRIBUTION_TAG: ${process.env.ATTRIBUTION_TAG || "(unset)"} (applied to mainnet txs only)`);
console.log(celo === 0n ? "  ⚠ needs CELO for network fees before registering on mainnet" : "  ✓ has CELO for network fees");
