// Mobile deep links: open this dapp inside a wallet's in-app browser (no WalletConnect project ID needed).
export const ua = () => navigator.userAgent || "";
export const isIOS = () => /iPhone|iPad|iPod/i.test(ua()) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
export const isAndroid = () => /Android/i.test(ua());
export const isMobile = () => isIOS() || isAndroid();

export type DeepLink = { id: string; name: string; icon: string; href: (url: string) => string; note?: string };
const strip = (u: string) => u.replace(/^https?:\/\//, "");
const e = encodeURIComponent;
// Icons are local SVG monograms (no third-party hotlinking).
const mono = (t: string, bg: string, fg = "#fff") => `data:image/svg+xml,${e(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"><rect width="40" height="40" rx="10" fill="${bg}"/><text x="20" y="26" font-family="Arial,sans-serif" font-size="15" font-weight="700" fill="${fg}" text-anchor="middle">${t}</text></svg>`)}`;

export const DEEP_LINKS: DeepLink[] = [
  { id: "minipay", name: "MiniPay", icon: mono("MP", "#fcff52", "#000"), href: (u) => `https://link.minipay.xyz/browse?url=${e(u)}`, note: "Opens in MiniPay (Opera Mini) if this site is on MiniPay's list; otherwise copy the link into MiniPay's browser." },
  { id: "metamask", name: "MetaMask", icon: mono("MM", "#f6851b"), href: (u) => `https://metamask.app.link/dapp/${strip(u)}` },
  { id: "trust", name: "Trust Wallet", icon: mono("TW", "#0500ff"), href: (u) => `https://link.trustwallet.com/open_url?coin_id=52752&url=${e(u)}` },
  { id: "coinbase", name: "Coinbase Wallet", icon: mono("CB", "#0052ff"), href: (u) => `https://go.cb-w.com/dapp?cb_url=${e(u)}` },
  { id: "okx", name: "OKX Wallet", icon: mono("OKX", "#000"), href: (u) => `https://www.okx.com/download?deeplink=${e("okx://wallet/dapp/url?dappUrl=" + e(u))}` },
  { id: "bitget", name: "Bitget Wallet", icon: mono("BG", "#00f0ff", "#000"), href: (u) => isIOS() ? `bitkeep://bkconnect?action=dapp&url=${e(u)}` : `https://bkcode.vip?action=dapp&url=${e(u)}` },
];
// No documented "open URL in dapp browser" link: user copies the link and pastes it in the wallet's browser.
export const MANUAL = [
  { name: "Valora", how: "Valora → Explore/Discover → paste the link" },
  { name: "Rabby mobile", how: "Rabby → Dapps → paste the link" },
];
