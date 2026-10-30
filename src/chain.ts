import "dotenv/config";
import { createPublicClient, createWalletClient, http, defineChain } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { withAttribution } from "@celo/attribution-tags";
import { net } from "./config";

export const N = net(process.env.NETWORK);
export const API = process.env.API_URL || "https://agent-bounty-board.pages.dev/api";
export const chain = defineChain({ id: N.chainId, name: N.name, nativeCurrency: { name: "CELO", symbol: "CELO", decimals: 18 }, rpcUrls: { default: { http: [N.rpc] } } });
export const publicClient = createPublicClient({ chain, transport: http(N.rpc) });

/** Wallet client. Every non-x402 tx gets the ERC-8021 Celo attribution suffix when ATTRIBUTION_TAG is set. */
export function wallet(pk: string) {
  const account = privateKeyToAccount(pk as `0x${string}`);
  const w = createWalletClient({ account, chain, transport: http(N.rpc) });
  const tag = process.env.ATTRIBUTION_TAG;
  return tag ? (w.extend(withAttribution(tag) as any) as typeof w) : w;
}
export const tx = (h: string) => `${N.explorer}/tx/${h}`;
