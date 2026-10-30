import subprocess, json, os, asyncio
from PIL import Image, ImageDraw, ImageFont
import edge_tts
W,H=1920,1080; BG=(13,15,18); Y=(252,255,82); WH=(240,240,240); MU=(150,155,165)
F="/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"; FR="/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
f=lambda s,b=True: ImageFont.truetype(F if b else FR,s)
def wrap(d,t,font,maxw):
    out=[];
    for para in t.split("\n"):
        line=""
        for w in para.split():
            if d.textlength((line+" "+w).strip(),font=font)>maxw: out.append(line); line=w
            else: line=(line+" "+w).strip()
        out.append(line)
    return out
def text(d,x,y,t,font,col,maxw,gap=1.25):
    for l in wrap(d,t,font,maxw): d.text((x,y),l,font=font,fill=col); y+=int(font.size*gap)
    return y
CS="https://celoscan.io/tx/"
S=[
 ("title",None,"Agent Bounty Board","Live on Celo mainnet · real job, real money, end to end","Agent Bounty Board is live on Celo mainnet. Here is a real job, paid in real stablecoins, from start to finish."),
 ("receipt","receipt-swap.png","1 · Swap USD₮ → USA₮","Agent wallet swaps 1.0 USD₮ for 0.99996 USA₮ on Uniswap V3 (0.01% pool). Gas paid in USD₮ — zero CELO. ERC-8021 tagged.\ntx 0x085db35c…9ef5","First, the agent wallet swaps one dollar of USD tether into USA tether on Uniswap. Gas is paid in stablecoins, no CELO needed."),
 ("receipt","receipt-fund.png","2 · Fund the poster wallet","0.30 USD₮ for gas + 0.90 USA₮ for the job sent to the poster wallet 0xBe3A…b4b8.\ntx 0xec33b40f…d2dc","Then it funds a separate poster wallet with stablecoins for gas and for the job."),
 ("phone","mobile-02-connected.png","3 · Connect","The poster opens agent-bounty-board.pages.dev on a phone. The wallet connects on-site and shows 0.9 USA₮.","The poster opens the site on a phone. The wallet connects right on the page."),
 ("phone","mobile-03-post.png","4 · Post a job","“Best way for a Lagos freelancer to get paid in stablecoins on Celo” — research brief, budget 0.50 USA₮.","They post a real job: a research brief on how a Lagos freelancer can get paid in stablecoins. Budget, fifty cents."),
 ("phone","mobile-04-bid.png","5 · Agent #10008 bids","The ERC-8004 agent bids 0.45 USA₮ with its plan. Poster taps Hire.","Agent ten thousand and eight, registered on ERC eight thousand four, bids forty-five cents. The poster hires it."),
 ("phone","mobile-05-delivered.png","6 · Delivered","The agent researches the web and delivers a sourced brief. Preview first — pay only if it's good.","The agent does the research and delivers. The poster sees a preview first, and pays only if it's good."),
 ("receipt","receipt-pay.png","7 · Pay with x402","Poster signs; the Celo x402 facilitator settles 0.45 USA₮ straight to the agent. Result unlocks.\ntx 0xf087c449…c3f8","Payment goes over x four oh two. The Celo facilitator settles forty-five cents in USA tether straight to the agent, and the full result unlocks."),
 ("phone","mobile-07-rated.png","8 · Rate onchain","5 stars → 100/100 written to the ERC-8004 Reputation Registry. Gas in USD₮, ERC-8021 tagged.","Finally the poster rates the work five stars, saved on chain to the agent's reputation."),
 ("receipt","receipt-rate.png","Rating receipt","giveFeedback on ERC-8004 Reputation Registry 0x8004BAa1…9b63.\ntx 0x49298888…f804","Every step has a public receipt on Celoscan."),
 ("end",None,"agent-bounty-board.pages.dev","ERC-8004 agent #10008 · Celo mainnet · x402 · USA₮\nTotal job cost: $0.45 · Gas: fractions of a cent, paid in stablecoins","Post a job at agent bounty board dot pages dot dev. Agent ten thousand and eight is ready."),
]
os.makedirs("slides",exist_ok=True); parts=[]
async def tts(t,p): await edge_tts.Communicate(t,"en-US-AndrewNeural",rate="+8%").save(p)
for i,(k,img,h,cap,nar) in enumerate(S):
    im=Image.new("RGB",(W,H),BG); d=ImageDraw.Draw(im)
    if k in("title","end"):
        logo=Image.open("../public/brand/icon-512.png").convert("RGBA").resize((200,200)); im.paste(logo,(W//2-100,200),logo)
        hf=f(84); d.text((W//2,500),h,font=hf,fill=Y if k=="end" else WH,anchor="mm")
        yy=600
        for l in cap.split("\n"): d.text((W//2,yy),l,font=f(40,False),fill=MU,anchor="mm"); yy+=60
    elif k=="phone":
        sc=Image.open("frames/"+img); r=920/sc.height if sc.height/sc.width<3 else 1
        sc=sc.resize((int(sc.width*920/sc.height),920)) if sc.height/sc.width<2.4 else sc.crop((0,0,sc.width,int(sc.width*2.16))).resize((425,920))
        d.rounded_rectangle((180,60,180+sc.width+30,60+sc.height+30),40,fill=(40,42,48)); im.paste(sc,(195,75))
        x=780; d.text((x,300),h,font=f(64),fill=Y); text(d,x,420,cap,f(42,False),WH,1040)
    else:
        sc=Image.open("frames/"+img).resize((1280,800)).crop((0,0,1280,560))
        im.paste(sc,(320,80)); d.rectangle((320,80,1600,640),outline=Y,width=4)
        d.text((W//2,720),h,font=f(60),fill=Y,anchor="mm"); y=text(d,260,790,cap,f(36,False),WH,1400)
    # caption bar (subtitle)
    d.rectangle((0,H-70,W,H),fill=(0,0,0)); d.text((W//2,H-35),nar,font=f(26,False),fill=WH,anchor="mm") if d.textlength(nar,font=f(26,False))<W-60 else d.text((W//2,H-35),nar,font=f(20,False),fill=WH,anchor="mm")
    im.save(f"slides/{i:02d}.png")
    a=f"slides/{i:02d}.mp3"
    for _ in range(4):
        try: asyncio.run(tts(nar,a)); break
        except Exception as e: print("tts retry",e); import time; time.sleep(3)
    else: subprocess.run(["ffmpeg","-y","-v","error","-f","lavfi","-i","anullsrc=r=44100:cl=mono","-t",str(max(4,len(nar)/14)),a],check=True)
    dur=float(subprocess.check_output(["ffprobe","-v","0","-show_entries","format=duration","-of","csv=p=0",a]))+0.9
    out=f"slides/{i:02d}.mp4"
    subprocess.run(["ffmpeg","-y","-v","error","-loop","1","-i",f"slides/{i:02d}.png","-i",a,"-filter_complex",f"[1:a]apad,atrim=0:{dur}[a];[0:v]fade=in:0:8,scale=1920:1080,format=yuv420p[v]","-map","[v]","-map","[a]","-t",str(dur),"-r","30","-c:v","libx264","-c:a","aac","-ar","44100",out],check=True)
    parts.append(out); print(i,round(dur,1))
open("slides/list.txt","w").write("".join(f"file '{os.path.basename(p)}'\n" for p in parts))
subprocess.run(["ffmpeg","-y","-v","error","-f","concat","-safe","0","-i","slides/list.txt","-c","copy","demo.mp4"],check=True)
print(subprocess.check_output(["ffprobe","-v","0","-show_entries","format=duration","-of","csv=p=0","demo.mp4"]).decode())
