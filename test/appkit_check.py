import sys
from playwright.sync_api import sync_playwright
url=sys.argv[1] if len(sys.argv)>1 else "https://agent-bounty-board.pages.dev/"
with sync_playwright() as p:
    b=p.chromium.launch(executable_path="/usr/bin/google-chrome",args=["--no-sandbox"])
    for name,vp,mob in [("desktop",{"width":1280,"height":800},False),("iphone",{"width":390,"height":844},True)]:
        c=b.new_context(viewport=vp,is_mobile=mob,has_touch=mob)
        pg=c.new_page(); errs=[]
        pg.on("console",lambda m: m.type=="error" and errs.append(m.text))
        pg.goto(url,wait_until="networkidle"); pg.wait_for_timeout(2000)
        pg.click("#wallet button, #connect, #wallet",timeout=8000)
        pg.wait_for_timeout(6000)
        txt=pg.evaluate("""()=>{const m=document.querySelector('w3m-modal');if(!m)return 'NO w3m-modal';
          function walk(n,o){if(!n)return;if(n.shadowRoot)walk(n.shadowRoot,o);for(const ch of n.children||[]){walk(ch,o)};if(n.tagName)o.push(n.tagName.toLowerCase())}
          const o=[];walk(m,o);return [...new Set(o.filter(t=>/qr|wallet-list|list-wallet|connect/.test(t)))].join(',')}""")
        pg.screenshot(path=f"test/redesign-appkit-{name}.png")
        print(name,"->",txt[:400]); print(" errors:",[e[:150] for e in errs][:5])
        c.close()
    b.close()
