# Crisp 2x DPR captures of the real live site, states driven by intercepting /api/jobs/8 with real job #8 data.
import json, re, copy, urllib.request
from playwright.sync_api import sync_playwright
U="https://agent-bounty-board.pages.dev/"; OUT="demo/v2/cap/"
src=open("test/ui_mainnet.py").read(); MOCKT=re.search(r'MOCK = """(.*?)"""',src,re.S).group(1)
ADDR="0xBe3AeA9A8131219E01CbD1f0419268ec4493b4b8"; MOCK=MOCKT%(json.dumps("minipay"),json.dumps(ADDR))
MOCK=MOCK.replace("window.__sign(","Promise.resolve(JSON.stringify({result:'0x'}))||(")
J=json.loads(urllib.request.urlopen(urllib.request.Request(U+"api/jobs/8",headers={"User-Agent":"Mozilla/5.0"})).read())
RES=open("demo/job8-result.md").read()
def st(status,bids=True,**kw):
    j=copy.deepcopy(J); j["status"]=status
    if status=="open": j.update(agent_id=None,worker=None,result_sha=None,preview=None,pay_tx=None,feedback_tx=None,score=None,price=None)
    if status=="assigned": j.update(result_sha=None,preview=None,pay_tx=None,feedback_tx=None,score=None)
    if status=="delivered": j.update(pay_tx=None,feedback_tx=None,score=None)
    if status=="paid": j.update(feedback_tx=None,score=None)
    if not bids: j["bids"]=[]
    j.update(kw); return j
CUR={"j":J}
with sync_playwright() as p:
    b=p.chromium.launch(executable_path="/usr/bin/google-chrome",args=["--no-sandbox","--hide-scrollbars"])
    c=b.new_context(viewport={"width":1440,"height":900},device_scale_factor=2)
    c.add_init_script(MOCK)
    c.route("**/api/jobs/8",lambda r:r.fulfill(status=200,content_type="application/json",body=json.dumps(CUR["j"])))
    pg=c.new_page()
    css="#toast,.toast{display:none!important}"
    BOX={}
    def shot(name,url,j=None,local=False,full=False,before=None,sels=()):
        CUR["j"]=j or J
        pg.goto("about:blank"); pg.goto(U)
        pg.evaluate("k=>localStorage.removeItem(k)","result-8")
        if local: pg.evaluate("([k,v])=>localStorage.setItem(k,v)",["result-8",json.dumps({"result":RES})])
        pg.goto(U+url); pg.wait_for_timeout(3500); pg.add_style_tag(content=css)
        if before: before(); pg.wait_for_timeout(600)
        BOX[name]={k:pg.locator(k).first.bounding_box() for k in sels}; BOX[name]["_h"]=pg.evaluate("document.documentElement.scrollHeight"); BOX[name]["_sy"]=pg.evaluate("scrollY")
        pg.screenshot(path=OUT+name+".png",full_page=full); print(name)
    shot("home","",sels=(".hero .btn.primary","a.job"))
    shot("home-full","",full=True)
    def fill():
        pg.click("[data-cat=research]"); pg.fill("#title",J["title"]); pg.fill("#desc",J["input"]); pg.fill("#reward","0.50")
    shot("post-empty","#/post")
    shot("post-filled","#/post",before=fill,sels=("#go","#title","#desc","#reward"))
    shot("job-waiting","#/job/8",st("open",bids=False))
    shot("job-bid","#/job/8",st("open"),full=True,sels=("[data-accept]",".bid"))
    shot("job-working","#/job/8",st("assigned"))
    shot("job-delivered","#/job/8",st("delivered"),full=True,sels=("#pay",))
    shot("job-paid","#/job/8",st("paid"),local=True,full=True)
    shot("job-stars","#/job/8",st("paid"),local=True,full=True,before=lambda: pg.click(".star[data-s='5']"),sels=(".star[data-s='5']","#rate",".rate"))
    shot("job-rated","#/job/8",J,local=True,full=True,sels=("text=Rated 100/100",))
    json.dump(BOX,open(OUT+"boxes.json","w"),indent=1)
    shot("agents","#/agents")
    c2=b.new_context(viewport={"width":1440,"height":900},device_scale_factor=2,user_agent="Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36")
    q=c2.new_page()
    for n,h in [("cs-pay","0xf087c4497bb49685d8f8a3d2fd5c561a952d6f89e2671019e41be220693bc3f8"),("cs-rate","0x49298888b79f9fdd7d8e09e41d1bb4dfd2fd91683d4da7c50cf704ed09f5a804")]:
        q.goto("https://celoscan.io/tx/"+h); q.wait_for_timeout(6000)
        q.add_style_tag(content="#consentModal,.cookie-banner,[id*=cookie],[class*=cookie],#ContentPlaceHolder1_divSponsored{display:none!important}")
        try: q.click("text=Got it!",timeout=2000)
        except: pass
        q.wait_for_timeout(500); q.screenshot(path=OUT+n+".png"); print(n)
    b.close()
