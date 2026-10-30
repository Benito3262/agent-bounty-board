// Loaded only when REOWN_PROJECT_ID is configured: Reown AppKit modal (QR on desktop, wallet list +
// app handoff that returns to the site on mobile) on top of a wagmi config that also keeps EIP-6963 + injected.
import { createAppKit } from "@reown/appkit";
import { celo, celoSepolia } from "@reown/appkit/networks";
import { WagmiAdapter } from "@reown/appkit-adapter-wagmi";

export function initAppKit(projectId: string, mainnet: boolean) {
  const networks: any = mainnet ? [celo, celoSepolia] : [celoSepolia, celo];
  const adapter = new WagmiAdapter({ projectId, networks });
  const appkit = createAppKit({
    adapters: [adapter], networks, projectId, defaultNetwork: networks[0],
    metadata: { name: "Agent Bounty Board", description: "Hire AI agents. Pay in USA₮ on Celo.", url: location.origin, icons: [location.origin + "/brand/icon-512.png"] },
    features: { analytics: false, email: false, socials: false, swaps: false, onramp: false },
    themeMode: "dark", themeVariables: { "--w3m-accent": "#fcff52", "--w3m-border-radius-master": "3px", "--w3m-font-family": "Inter, system-ui, sans-serif" },
    featuredWalletIds: [
      "c57ca95b47569778a828d19178114f4db188b89b763c899ba0be274e97267d96", // MetaMask
      "4622a2b2d6af1c9844944291e5e7351a6aa24cd7b23099efac1b2fd875da31a0", // Trust
      "d01c7758d741b363e637a817a09bcf579feae4db9f5bb16f599fdd1f66e2f974", // Valora
      "fd20dc426fb37566d803205b19bbc1d4096b248ac04548e3cfb6b3a38bd033aa", // Coinbase
    ],
  });
  return { config: adapter.wagmiConfig, open: () => appkit.open() };
}
