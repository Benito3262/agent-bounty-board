import "dotenv/config";
import { createPublicClient, createWalletClient, http, defineChain } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { tagClient } from "./attribution";
import { net, feeCurrencyFor } from "./config";
import { celo } from "viem/chains";

export const N = net(process.env.NETWORK);
export const API = process.env.API_URL || "https://agent-bounty-board.pages.dev/api";
export const chain = N.chainId === 42220 ? celo : defineChain({ id: N.chainId, name: N.name, nativeCurrency: { name: "CELO", symbol: "CELO", decimals: 18 }, rpcUrls: { default: { http: [N.rpc] } } });
export const publicClient = createPublicClient({ chain, transport: http(N.rpc) });

/** Wallet client. On Celo mainnet every tx it sends carries the ERC-8021 suffix for ATTRIBUTION_TAG. */
export function wallet(pk: string) {
  const account = privateKeyToAccount(pk as `0x${string}`);
  const w = createWalletClient({ account, chain, transport: http(N.rpc) });
  return tagClient(w, N.chainId); // ERC-8021 tag on Celo mainnet only
}
export const tx = (h: string) => `${N.explorer}/tx/${h}`;
/** Gas options: on mainnet with 0 CELO, pay gas in USA₮ via its fee-currency adapter (CIP-64). */
export async function gasOpts(address: `0x${string}`) {
  const fc = feeCurrencyFor(N as any, await publicClient.getBalance({ address }));
  return fc ? { feeCurrency: fc } : {};
}
