# Renders index.html frame-by-frame in headless Chrome -> ffmpeg (H.264 60fps) + music.
import sys, subprocess, time
from playwright.sync_api import sync_playwright
FPS=int(sys.argv[1]) if len(sys.argv)>1 else 60
STILLS=[float(x) for x in sys.argv[2].split(",")] if len(sys.argv)>2 else None
with sync_playwright() as p:
    b=p.chromium.launch(executable_path="/usr/bin/google-chrome",args=["--no-sandbox","--allow-file-access-from-files","--force-color-profile=srgb"])
    pg=b.new_page(viewport={"width":1920,"height":1080})
    pg.goto("file:///workspace/agent-bounty-board/demo/v2/index.html")
    pg.evaluate("Promise.all([...document.images].map(i=>i.decode())).then(()=>document.fonts.ready)")
    pg.wait_for_timeout(500)
    if STILLS:
        import os; os.makedirs("review",exist_ok=True)
        for t in STILLS: pg.evaluate(f"render({t})"); pg.screenshot(path=f"review/t{t:05.1f}.png"); print(t)
        sys.exit()
    D=pg.evaluate("DURATION"); N=int(D*FPS)
    ff=subprocess.Popen(["ffmpeg","-y","-v","error","-f","image2pipe","-framerate",str(FPS),"-c:v","mjpeg","-i","-",
        "-i","music.mp3","-filter_complex",f"[1:a]atrim=0:{D},afade=t=in:d=1.5,afade=t=out:st={D-3.5}:d=3.5,volume=-4dB[a]",
        "-map","0:v","-map","[a]","-c:v","libx264","-preset","slow","-crf","16","-pix_fmt","yuv420p","-movflags","+faststart","-c:a","aac","-b:a","192k","-shortest","../demo-v2.mp4"],stdin=subprocess.PIPE)
    s=time.time()
    for i in range(N):
        pg.evaluate(f"render({i/FPS})"); ff.stdin.write(pg.screenshot(type="jpeg",quality=95))
        if i%600==0: print(i,N,round(time.time()-s),flush=True)
    ff.stdin.close(); ff.wait(); print("done",round(time.time()-s))
