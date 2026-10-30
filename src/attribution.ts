// ERC-8021 attribution (celo-org/attribution-tags BUILDERS.md). Issued code from loops.house, MAINNET ONLY.
import { toDataSuffix, withAttribution } from "@celo/attribution-tags";
export const CELO_MAINNET_ID = 42220;
export const attributionTag = (env: Record<string, string | undefined> = (globalThis as any).process?.env ?? {}) => env.ATTRIBUTION_TAG || "";
/** Suffix to append to calldata, or undefined when not on Celo mainnet / no tag. */
export const suffixFor = (chainId: number, tag = attributionTag()) => (chainId === CELO_MAINNET_ID && tag ? (toDataSuffix(tag) as `0x${string}`) : undefined);
/** Attach the tag at client level so every sendTransaction / writeContract is tagged (BUILDERS.md "Recommended setup"). */
export function tagClient<T extends { extend: (f: any) => any }>(w: T, chainId: number, tag = attributionTag()): T {
  return chainId === CELO_MAINNET_ID && tag ? (w.extend(withAttribution(tag) as any) as T) : w;
}
