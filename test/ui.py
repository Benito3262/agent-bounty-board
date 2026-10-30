import json, sys, time, urllib.request
from playwright.sync_api import sync_playwright
URL = "https://agent-bounty-board.pages.dev/"
ADDR = json.loads(urllib.request.urlopen(urllib.request.Request("http://127.0.0.1:8788", data=b'{"method":"address","params":[]}')).read())["result"]
MODE = sys.argv[1]  # minipay | metamask
MOCK = """
(() => {
 const MODE = %s, ADDR = %s; let chainId = MODE === 'minipay' ? '0xaa044c' : '0x1'; const L = {};
 const signer = (method, params) => window.__sign(JSON.stringify({method, params})).then(r => { const j = JSON.parse(r); if (j.error) throw new Error(j.error); return j.result; });
 const rpc = (method, params) => fetch('https://forno.celo-sepolia.celo-testnet.org', {method:'POST', headers:{'content-type':'application/json'}, body: JSON.stringify({jsonrpc:'2.0', id:1, method, params})}).then(r=>r.json()).then(j=>{ if (j.error) throw j.error; return j.result; });
 const known = new Set(['0x1']); if (MODE==='minipay') known.add('0xaa044c');
 const p = { isMetaMask: MODE==='metamask', isMiniPay: MODE==='minipay', on:(e,f)=>{(L[e]=L[e]||[]).push(f)}, removeListener:(e,f)=>{L[e]=(L[e]||[]).filter(x=>x!==f)},
  request: async ({method, params}) => { window.__log = (window.__log||[]).concat(method);
   switch (method) {
    case 'eth_requestAccounts': window.__ok = true; return [ADDR];
    case 'eth_accounts': return (MODE==='minipay' || window.__ok) ? [ADDR] : [];
    case 'eth_chainId': return chainId;
    case 'net_version': return String(parseInt(chainId));
    case 'wallet_switchEthereumChain': if (!known.has(params[0].chainId)) { const e = new Error('Unrecognized chain'); e.code = 4902; throw e; } chainId = params[0].chainId; (L.chainChanged||[]).forEach(f=>f(chainId)); return null;
    case 'wallet_addEthereumChain': known.add(params[0].chainId); window.__added = params[0]; chainId = params[0].chainId; (L.chainChanged||[]).forEach(f=>f(chainId)); return null; // MetaMask switches after add
    case 'wallet_requestPermissions': case 'wallet_revokePermissions': return [{parentCapability:'eth_accounts'}];
    case 'wallet_getPermissions': return [{parentCapability:'eth_accounts'}];
    case 'personal_sign': return signer(method, params);
    case 'eth_signTypedData_v4': return signer(method, params);
    case 'eth_sendTransaction': return signer(method, params);
    default: return rpc(method, params);
   } } };
 if (MODE === 'minipay') window.ethereum = p;
 else { const info = {uuid:'00000000-0000-4000-8000-000000000001', name:'MetaMask', icon:'data:image/svg+xml,<svg xmlns=%%22http://www.w3.org/2000/svg%%22/>', rdns:'io.metamask'};
   const ann = () => window.dispatchEvent(new CustomEvent('eip6963:announceProvider', {detail: Object.freeze({info, provider: p})}));
   window.addEventListener('eip6963:requestProvider', ann); ann(); }
})();
""" % (json.dumps(MODE), json.dumps(ADDR))
def sign(_, body):
    return urllib.request.urlopen(urllib.request.Request("http://127.0.0.1:8788", data=body.encode())).read().decode()
with sync_playwright() as pw:
    b = pw.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--no-sandbox"])
    pg = b.new_page(viewport={"width": 420 if MODE=="minipay" else 1280, "height": 900})
    pg.on("console", lambda m: m.type == "error" and print("console:", m.text[:200]))
    pg.expose_binding("__sign", sign); pg.add_init_script(MOCK)
    pg.goto(URL); pg.wait_for_selector(".addr" if MODE=="minipay" else "#connect", timeout=30000)
    if MODE == "metamask":
        pg.screenshot(path=f"test/{MODE}-0-disconnected.png"); pg.click("#connect"); pg.wait_for_selector(".modal")
        pg.screenshot(path=f"test/{MODE}-1-picker.png"); print("picker:", pg.inner_text(".modal")[:200].replace("\n"," | "))
        pg.click("button.wallet >> text=MetaMask"); pg.wait_for_timeout(8000); print("DBG", pg.inner_text("#wallet"), pg.evaluate("window.__log"), pg.inner_text("body")[-300:]); pg.wait_for_selector("#bal", timeout=30000)
        print("added chain:", pg.evaluate("window.__added && window.__added.chainName"), pg.evaluate("window.__added && window.__added.chainId"))
    pg.wait_for_function("document.querySelector('#bal') && /USDC/.test(document.querySelector('#bal').innerText)", timeout=30000)
    print("wallet:", pg.inner_text("#wallet").replace("\n"," "), "| connect button visible:", pg.is_visible("#connect"))
    pg.screenshot(path=f"test/{MODE}-2-connected.png")
    if MODE != "minipay": b.close(); sys.exit()
    # full flow through the UI: post → accept bid → accept & pay (x402) → rate (ERC-8004)
    pg.goto(URL + "#/post"); pg.wait_for_selector("#cat")
    pg.select_option("#cat", "translation")
    pg.fill("#title", "Translate our MiniPay launch announcement into Brazilian Portuguese")
    pg.fill("#desc", "Translate for Brazilian users, informal but clear:\n\n\"Agent Bounty Board is live on Celo. Post any job - research, lead lists, contract reviews - and AI agents bid to do it. You only pay, in stablecoins over x402, when you accept the work. Then rate the agent on-chain so the best agents rise to the top.\"")
    pg.fill("#spec", "Markdown. Natural pt-BR, keep product names (Celo, x402, MiniPay) in English, plus 2-3 translator notes.")
    pg.fill("#reward", "0.05"); pg.screenshot(path="test/minipay-3-post.png", full_page=True); pg.click("#go")
    pg.wait_for_url("**/#/job/*"); jid = pg.url.split("/")[-1]; print("posted job", jid)
    pg.wait_for_selector("[data-accept]", timeout=120000); pg.screenshot(path="test/minipay-4-bid.png", full_page=True); pg.click("[data-accept]")
    pg.wait_for_selector("#pay", timeout=400000); pg.screenshot(path="test/minipay-5-delivered.png", full_page=True); pg.click("#pay")
    pg.wait_for_selector("#rate", timeout=120000); pg.screenshot(path="test/minipay-6-paid.png", full_page=True)
    print("pay toast/links:", pg.inner_text("body")[-600:].replace("\n"," | "))
    pg.fill("#score", "91"); pg.click("#rate")
    pg.wait_for_function("/ERC-8004 feedback \\(91/.test(document.body.innerText)", timeout=120000)
    pg.screenshot(path="test/minipay-7-rated.png", full_page=True)
    print(json.dumps(json.loads(urllib.request.urlopen(f"https://agent-bounty-board.pages.dev/api/jobs/{jid}").read()), indent=0)[:1500])
    print("wallet methods used:", sorted(set(pg.evaluate("window.__log"))))
    b.close()
