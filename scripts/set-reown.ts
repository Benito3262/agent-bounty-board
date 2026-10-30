// npm run set-reown -- <REOWN_PROJECT_ID>
// Stores the Reown (WalletConnect) project ID as a Cloudflare Pages secret (production) and redeploys.
// The frontend reads it at runtime from /api/config, so no code change is needed.
import { execSync } from "node:child_process";
const id = (process.argv[2] || "").trim();
if (!/^[0-9a-f]{32}$/i.test(id)) { console.error("Usage: npm run set-reown -- <32-char Reown project ID from cloud.reown.com>"); process.exit(1); }
execSync("npx wrangler@3 pages secret put REOWN_PROJECT_ID --project-name agent-bounty-board", { input: id, stdio: ["pipe", "inherit", "inherit"] });
execSync("npm run deploy", { stdio: "inherit" });
const cfg = await fetch("https://agent-bounty-board.pages.dev/api/config").then((r) => r.json()).catch(() => ({}));
console.log(cfg.reownProjectId ? "✓ WalletConnect/AppKit enabled on https://agent-bounty-board.pages.dev" : "Deployed — reload in a minute and check /api/config.reownProjectId");
console.log("Reown dashboard → your project → Domain / Allowed origins: add https://agent-bounty-board.pages.dev");
