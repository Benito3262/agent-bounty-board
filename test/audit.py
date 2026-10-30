# Responsive audit: iPhone / Android / desktop. Screenshots → test/audit-*.png; reports console errors, HTTP errors, horizontal overflow.
import sys
from playwright.sync_api import sync_playwright
URL = sys.argv[1] if len(sys.argv) > 1 else "https://agent-bounty-board.pages.dev/"
IOS = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1"
AND = "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36"
EXT = """(() => { const mk=(name,rdns,color)=>{const p={request:async({method})=>method==='eth_chainId'?'0xaa044c':method==='eth_accounts'?[]:null,on(){},removeListener(){}};
 const info={uuid:crypto.randomUUID(),name,rdns,icon:`data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 10 10'><rect width='10' height='10' fill='${color}'/></svg>`};
 const ann=()=>window.dispatchEvent(new CustomEvent('eip6963:announceProvider',{detail:Object.freeze({info,provider:p})})); window.addEventListener('eip6963:requestProvider',ann); ann(); return p;};
 window.ethereum = mk('MetaMask','io.metamask','%23f6851b'); mk('Rabby Wallet','io.rabby','%237084ff'); mk('Coinbase Wallet','com.coinbase.wallet','%230052ff'); mk('OKX Wallet','com.okex.wallet','%23000'); })();"""
DEVICES = [("iphone", dict(viewport={"width": 390, "height": 844}, device_scale_factor=2, is_mobile=True, has_touch=True, user_agent=IOS), False),
           ("android", dict(viewport={"width": 412, "height": 915}, device_scale_factor=2, is_mobile=True, has_touch=True, user_agent=AND), False),
           ("desktop", dict(viewport={"width": 1366, "height": 860}), True)]
issues = []
with sync_playwright() as pw:
    b = pw.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--no-sandbox"])
    for name, opts, ext in DEVICES:
        ctx = b.new_context(**opts)
        if ext: ctx.add_init_script(EXT)
        pg = ctx.new_page()
        pg.on("console", lambda m, n=name: m.type == "error" and issues.append(f"{n} console: {m.text[:160]}"))
        pg.on("pageerror", lambda e, n=name: issues.append(f"{n} pageerror: {e}"))
        pg.on("response", lambda r, n=name: r.status >= 400 and "402" not in str(r.status) and issues.append(f"{n} HTTP {r.status} {r.url}"))
        for route in ["", "post", "job/3", "agents", "how"]:
            pg.goto(URL + "#/" + route); pg.wait_for_timeout(2500)
            ov = pg.evaluate("document.documentElement.scrollWidth - innerWidth")
            if ov > 1: issues.append(f"{name} #{route}: horizontal overflow {ov}px")
            small = pg.evaluate("""[...document.querySelectorAll('input,select,textarea')].filter(e=>parseFloat(getComputedStyle(e).fontSize)<16).length""")
            if small: issues.append(f"{name} #{route}: {small} inputs <16px")
            pg.screenshot(path=f"test/audit-{name}-{route.replace('/', '') or 'home'}.png", full_page=route in ("", "job/3"))
        pg.goto(URL + "#/"); pg.wait_for_timeout(2000)
        pg.click("#connect"); pg.wait_for_timeout(800)
        print(name, "picker:", pg.evaluate("[...document.querySelectorAll('.modal .wallet')].map(e=>e.textContent.trim()).join(' | ')"))
        pg.screenshot(path=f"test/audit-{name}-wallets.png")
        ctx.close()
    b.close()
print("\n".join(issues) or "no issues")
