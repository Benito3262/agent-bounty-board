import "dotenv/config";
import { createPublicClient, createWalletClient, http, defineChain } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { tagClient } from "./attribution";
import { net } from "./config";

export const N = net(process.env.NETWORK);
export const API = process.env.API_URL || "https://agent-bounty-board.pages.dev/api";
export const chain = defineChain({ id: N.chainId, name: N.name, nativeCurrency: { name: "CELO", symbol: "CELO", decimals: 18 }, rpcUrls: { default: { http: [N.rpc] } } });
export const publicClient = createPublicClient({ chain, transport: http(N.rpc) });

/** Wallet client. On Celo mainnet every tx it sends carries the ERC-8021 suffix for ATTRIBUTION_TAG. */
export function wallet(pk: string) {
  const account = privateKeyToAccount(pk as `0x${string}`);
  const w = createWalletClient({ account, chain, transport: http(N.rpc) });
  return tagClient(w, N.chainId); // ERC-8021 tag on Celo mainnet only
}
export const tx = (h: string) => `${N.explorer}/tx/${h}`;
