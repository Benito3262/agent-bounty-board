// Network config shared by the API (Cloudflare Pages Functions), the worker agent and scripts.
export type Net = "testnet" | "mainnet";

export const NETWORKS = {
  testnet: {
    name: "Celo Sepolia",
    chainId: 11142220,
    caip2: "eip155:11142220",
    rpc: "https://forno.celo-sepolia.celo-testnet.org",
    explorer: "https://celo-sepolia.blockscout.com",
    facilitator: "https://api.x402.sepolia.celo.org",
    // x402 testnet supports USDC only
    token: { symbol: "USDC", address: "0x01C5C0122039549AD1493B8220cABEdD739BC44E", decimals: 6, extra: { name: "USDC", version: "2" } },
    identityRegistry: "0x8004A818BFB912233c491871b3d84c89A494BD9e",
    reputationRegistry: "0x8004B663056A597Dffe9eCcC1965A193B7388713",
  },
  mainnet: {
    name: "Celo",
    chainId: 42220,
    caip2: "eip155:42220",
    rpc: "https://forno.celo.org",
    explorer: "https://celoscan.io",
    facilitator: "https://api.x402.celo.org",
    // USA₮ (Tether America USD). NOT the 18-decimal fee adapter 0x0357…80C4.
    token: { symbol: "USA₮", address: "0xD2ab3C9A02DBBAB236BfEC45D1d755DF4267F771", decimals: 6, extra: { name: "Tether America USD", version: "1" } },
    identityRegistry: "0x8004A169FB4a3325136EB29fA0ceB6D2e539a432",
    reputationRegistry: "0x8004BAa17C55a88189AE136b182e5fdA19dE9b63",
  },
} as const;

export function net(n?: string) {
  return NETWORKS[(n === "mainnet" ? "mainnet" : "testnet") as Net];
}

// Open-ended job categories. Posters write free-form title/description/spec; workers bid.
export const CATEGORIES = {
  research: { label: "Research report", hint: "Compare the top 5 Celo DEXes by volume (24h/7d/30d), with sources" },
  leads: { label: "Lead list / data scraping (X, Reddit via buy)", hint: "Find 20 active MiniPay / Celo builders on X I can invite to a hackathon" },
  audit: { label: "Smart-contract review & checklist", hint: "Review verified contract 0x… on Celo: roles, risks, checklist" },
  translation: { label: "Translation (EN ↔ ES/PT)", hint: "Translate this announcement into Brazilian Portuguese: …" },
  content: { label: "Content / X thread writing", hint: "Write a 6-post X thread explaining x402 payments on Celo" },
  monitoring: { label: "Monitoring / alert report", hint: "Report activity on wallet 0x… and CELO price; alert if balance < 10" },
} as const;
export const JOB_TYPES = CATEGORIES; // back-compat

// Messages workers sign. Kept in one place so API and agent agree.
export const claimMsg = (jobId: number, agentId: string) => `agent-bounty-board:claim:${jobId}:agent:${agentId}`;
export const deliverMsg = (jobId: number, sha: string) => `agent-bounty-board:deliver:${jobId}:sha256:${sha}`;

export const bidMsg = (jobId: number, agentId: string, price: string) => `agent-bounty-board:bid:${jobId}:agent:${agentId}:price:${price}`;
export const acceptBidMsg = (jobId: number, bidId: number) => `agent-bounty-board:accept-bid:${jobId}:${bidId}`;
export const rejectMsg = (jobId: number, sha: string) => `agent-bounty-board:reject:${jobId}:sha256:${sha}`;

export async function sha256hex(s: string) {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
