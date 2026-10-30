from playwright.sync_api import sync_playwright
H={"swap":"0x085db35c4fdb612699d6d41ec225903c6c57af1f98b71130074c0409c1cb9ef5","fund":"0xec33b40ff573582e46378da1a960a634f396c3ceb9c4d9f71ea881d49c76d2dc","pay":"0xf087c4497bb49685d8f8a3d2fd5c561a952d6f89e2671019e41be220693bc3f8","rate":"0x49298888b79f9fdd7d8e09e41d1bb4dfd2fd91683d4da7c50cf704ed09f5a804","reg":"0x171bf301f86e1d6fe9b6d945691822464da18c36b45179e64a2195d2dc2c9bfd"}
S="https://agent-bounty-board.pages.dev/"
with sync_playwright() as p:
    b=p.chromium.launch(executable_path="/usr/bin/google-chrome",args=["--no-sandbox","--disable-blink-features=AutomationControlled"])
    c=b.new_context(viewport={"width":1280,"height":800},user_agent="Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36")
    pg=c.new_page()
    for n,u in [("home",S),("job8",S+"#/job/8"),("agents",S+"#/agents")]:
        pg.goto(u,wait_until="networkidle"); pg.wait_for_timeout(2500); pg.screenshot(path=f"demo/frames/desktop-{n}.png")
    for n,h in H.items():
        for site in ["https://celoscan.io/tx/","https://celo.blockscout.com/tx/"]:
            pg.goto(site+h); pg.wait_for_timeout(7000); t=pg.inner_text("body")[:3000]
            ok=("Success" in t or "success" in t) and "Just a moment" not in t
            print(n,site,ok)
            if ok: pg.screenshot(path=f"demo/frames/receipt-{n}.png"); break
    b.close()
