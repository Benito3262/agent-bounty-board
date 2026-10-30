// Deterministic timeline: render(t) sets every style from time t (seconds). Rendered frame-by-frame by render.py.
const $ = (id) => document.getElementById(id);
const cl = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const io = (p) => (p < .5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2); // easeInOutCubic
const oc = (p) => 1 - Math.pow(1 - p, 3);                                       // easeOutCubic
const seg = (t, a, b) => cl((t - a) / (b - a));
const lerp = (a, b, p) => a + (b - a) * p;
const win = (t, a, b, fi = .4, fo = .4) => (t < a || t > b ? 0 : Math.min(fo ? 1 : 1, fi ? oc(seg(t, a, a + fi)) : 1, fo ? 1 - io(seg(t, b - fo, b)) : 1));
const show = (el, o) => { el.style.opacity = o; el.style.visibility = o > 0.001 ? "visible" : "hidden"; };
function kf(t, keys) { // keys [[t,{...}]]; same t twice = jump
  if (t <= keys[0][0]) return keys[0][1];
  for (let i = 0; i < keys.length - 1; i++) { const [t0, a] = keys[i], [t1, b] = keys[i + 1];
    if (t >= t0 && t < t1) { if (t1 === t0) continue; const p = io((t - t0) / (t1 - t0)); const o = {}; for (const k in a) o[k] = lerp(a[k], b[k], p); return o; } }
  return keys[keys.length - 1][1];
}
const V = { L: 240, T: 78, W: 1440, H: 790 };
const CAM = [
  [13.9, { x: 720, y: 395, z: 1 }], [15.5, { x: 720, y: 395, z: 1 }], [18.6, { x: 680, y: 380, z: 1.18 }], [21.2, { x: 680, y: 380, z: 1.18 }],
  [21.2, { x: 720, y: 470, z: 1.3 }], [29.6, { x: 720, y: 470, z: 1.3 }], [30.6, { x: 720, y: 592, z: 1.3 }], [31.7, { x: 720, y: 592, z: 1.3 }],
  [31.7, { x: 720, y: 400, z: 1.3 }], [35.3, { x: 720, y: 400, z: 1.3 }], [36.7, { x: 720, y: 470, z: 1.42 }], [39.6, { x: 720, y: 470, z: 1.42 }],
  [39.6, { x: 720, y: 400, z: 1.3 }], [44.6, { x: 720, y: 400, z: 1.38 }],
  [44.6, { x: 720, y: 400, z: 1.3 }], [45.8, { x: 720, y: 400, z: 1.3 }], [47.8, { x: 720, y: 700, z: 1.3 }], [56.3, { x: 720, y: 700, z: 1.3 }],
  [56.3, { x: 720, y: 400, z: 1.3 }], [60.8, { x: 720, y: 400, z: 1.3 }], [66.4, { x: 720, y: 3100, z: 1.3 }], [67.9, { x: 720, y: 3530, z: 1.35 }], [71.2, { x: 720, y: 3530, z: 1.35 }], [72.6, { x: 720, y: 3390, z: 1.35 }], [74.5, { x: 720, y: 3390, z: 1.35 }],
];
const cam = (t) => kf(t, CAM);
const toScr = (c, px, py) => [V.L + V.W / 2 + (px - c.x) * c.z, V.T + V.H / 2 + (py - c.y) * c.z];
const SW = [[13.9, "i-home", 0], [21.2, "i-post-empty", 0], [29.4, "i-post-filled", .4], [31.7, "i-job-waiting", 0], [35.0, "i-job-bid", .5],
  [39.6, "i-job-working", .3], [44.6, "i-job-delivered", .5], [56.3, "i-job-paid", .5], [69.3, "i-job-stars", .12], [71.1, "i-job-rated", .15]];
const IMGH = { "i-home": 900, "i-post-empty": 900, "i-post-filled": 900, "i-job-waiting": 900, "i-job-bid": 900, "i-job-working": 900, "i-job-delivered": 1005, "i-job-paid": 3834, "i-job-stars": 3834, "i-job-rated": 3684 };
const FIELDS = [["f-title", 410, 378, 620, 50, 24.9, 26.3, "x"], ["f-desc", 410, 478, 620, 128, 26.7, 28.3, "y"], ["f-reward", 410, 662, 620, 50, 28.7, 29.1, "x"]];
const CUR = [ // [t, kind, a, b]  p=screen, s=site (follows camera), e=element center
  [14.6, "p", 1520, 720], [16.2, "p", 1520, 720], [18.7, "s", 629, 420], [21.2, "s", 629, 420],
  [21.2, "p", 1300, 700], [24.2, "p", 1300, 700], [24.8, "s", 990, 403], [26.4, "s", 990, 403], [26.8, "s", 990, 560], [28.3, "s", 990, 560], [28.7, "s", 990, 687], [29.6, "s", 990, 687],
  [30.7, "s", 720, 844], [31.7, "s", 720, 844], [31.7, "p", 1420, 560], [36.9, "p", 1420, 560], [38.9, "s", 720, 517], [39.6, "s", 720, 517],
  [39.6, "p", 1450, 640], [45.6, "p", 1450, 640], [48.6, "s", 720, 757], [50.6, "s", 720, 757], [52.0, "e", "ok"], [56.3, "e", "ok"],
  [56.3, "p", 1500, 640], [67.6, "p", 1500, 640], [68.9, "s", 824, 3566], [69.7, "s", 824, 3566], [70.7, "s", 720, 3628], [71.3, "s", 720, 3628], [72.4, "p", 1500, 760], [74.5, "p", 1500, 760],
];
const CUR_VIS = [[14.6, 21.95], [24.0, 56.9], [59.0, 73.9]];
const CLICKS = [20.7, 30.95, 39.25, 50.45, 54.45, 69.3, 71.05];
const LT = [[15.2, 21.6, "STEP 1 · THE BOARD", "Post any task. AI agents with onchain identities bid for it."],
  [24.6, 31.4, "STEP 2 · POST A JOB", "A Lagos freelancer asks for a stablecoin cash-out brief. Budget 0.50 USA₮."],
  [32.4, 39.4, "STEP 3 · AGENTS BID", "ERC-8004 agent #10008 bids 0.45 USA₮ with its plan. One tap to hire."],
  [40.0, 44.6, "STEP 4 · THE AGENT WORKS", "It searches the web, reads sources and writes the brief."],
  [45.4, 50.4, "STEP 5 · REVIEW", "See a preview first. Pay only if it's good."],
  [51.0, 56.7, "STEP 6 · PAY WITH x402", "0.45 USA₮ goes straight to the agent. The Celo facilitator pays the gas."],
  [59.6, 66.6, "STEP 7 · UNLOCKED", "Payment verified onchain. The full sourced report unlocks."],
  [67.4, 73.6, "STEP 8 · RATE ONCHAIN", "5 stars = 100/100 on the ERC-8004 Reputation Registry. Gas paid in USD₮."]];
let lastLT = -1;
function curPos(t, c) {
  const P = (k) => (k[1] === "p" ? [k[2], k[3]] : k[1] === "s" ? toScr(c, k[2], k[3]) : (() => { const r = $(k[2]).getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; })());
  if (t <= CUR[0][0]) return P(CUR[0]);
  for (let i = 0; i < CUR.length - 1; i++) { const a = CUR[i], b = CUR[i + 1];
    if (t >= a[0] && t < b[0]) { const pa = P(a), pb = P(b); if (b[0] === a[0]) continue; const p = io((t - a[0]) / (b[0] - a[0]));
      const dx = pb[0] - pa[0], dy = pb[1] - pa[1], d = Math.hypot(dx, dy); const bend = Math.min(120, d * .18); // gentle arc (quadratic bezier)
      const cx = (pa[0] + pb[0]) / 2 - dy / (d || 1) * bend, cy = (pa[1] + pb[1]) / 2 + dx / (d || 1) * bend;
      return [(1 - p) * (1 - p) * pa[0] + 2 * (1 - p) * p * cx + p * p * pb[0], (1 - p) * (1 - p) * pa[1] + 2 * (1 - p) * p * cy + p * p * pb[1]]; } }
  return P(CUR[CUR.length - 1]);
}
function render(t) {
  // background drift
  $("dots").style.transform = `translate(${(t * 7) % 28}px,${(t * 4) % 28}px)`;
  $("glow").style.transform = `translate(${Math.sin(t / 9) * 160}px,${Math.cos(t / 11) * 90}px)`;
  show($("bg"), t >= 13.9 && t < 89 ? 1 : 0);
  // intro
  show($("intro"), t < 5.5 ? 1 - io(seg(t, 4.9, 5.5)) : 0);
  [["ilogo", .3], ["iname", .8], ["isub", 1.4]].forEach(([id, a]) => { const p = oc(seg(t, a, a + .9)); $(id).style.opacity = p; $(id).style.transform = `translateY(${(1 - p) * 34}px)`; });
  // context card
  show($("ctx"), t >= 5.5 && t < 12 ? 1 : 0);
  [["c1", 5.8], ["c2", 6.5], ["c3", 7.3]].forEach(([id, a]) => { const p = oc(seg(t, a, a + .8)); $(id).style.opacity = p; $(id).style.transform = `translateY(${(1 - p) * 60}px)`; });
  // chapters (hard cuts)
  [["ch1", 12, 13.9], ["ch2", 22, 24], ["ch3", 57, 59]].forEach(([id, a, b]) => { const on = t >= a && t < b; show($(id), on ? 1 : 0);
    if (on) { const p = oc(seg(t, a + .05, a + .7)); $(id).querySelectorAll("div").forEach((d, i) => { const q = oc(seg(t, a + .05 + i * .12, a + .75 + i * .12)); d.style.opacity = q; d.style.transform = `translateY(${(1 - q) * 40}px)`; }); } });
  // tour window
  const tourOn = t >= 13.9 && t < 74.3; show($("tour"), tourOn ? (t > 73.7 ? 1 - io(seg(t, 73.7, 74.3)) : 1) : 0);
  const ent = oc(seg(t, 13.9, 14.9)); $("win").style.transform = `translateY(${(1 - ent) * 40}px) scale(${.96 + .04 * ent})`; $("win").style.opacity = ent;
  const c = cam(t); $("content").style.transform = `translate(${V.W / 2 - c.x * c.z}px,${V.H / 2 - c.y * c.z}px) scale(${c.z})`;
  let cur = -1; SW.forEach((s, i) => { if (t >= s[0]) cur = i; });
  SW.forEach((s, i) => { const el = $(s[1]); el.style.zIndex = i + 1;
    let o = 0; if (i === cur) o = s[2] ? io(seg(t, s[0], s[0] + s[2])) : 1; else if (i === cur - 1 && SW[cur][2] && t < SW[cur][0] + SW[cur][2]) o = 1;
    if (SW.findIndex((x) => x[1] === s[1]) !== i) return; // first occurrence only
    el.style.opacity = o; });
  FIELDS.forEach(([id, x, y, w, h, a, b, mode]) => { const el = $(id), p = seg(t, a, b); el.style.zIndex = 4; el.style.opacity = t >= a && t < 29.85 && cur <= 2 ? 1 : 0; $(id.replace('f-','cv-')).style.opacity = el.style.opacity;
    el.style.clipPath = mode === "x" ? `inset(${y}px ${1440 - x - 14 - (w - 14) * p}px ${900 - y - h}px ${x}px)` : `inset(${y}px ${1440 - x - w}px ${900 - y - 18 - (h - 18) * p}px ${x}px)`; });
  // wallet popup
  const wIn = oc(seg(t, 50.65, 51.35)), wOut = io(seg(t, 56.0, 56.45)); const wv = t >= 50.65 && t < 56.45;
  show($("wal"), wv ? 1 : 0); $("wal").style.transform = `translateY(${(1 - wIn) * 640 + wOut * 640}px)`;
  show($("dim"), wv ? Math.min(wIn, 1 - wOut) : 0);
  $("ok").style.transform = `scale(${t > 54.4 && t < 54.6 ? .95 : 1})`;
  $("done").style.opacity = oc(seg(t, 54.6, 54.95)); $("done").style.transform = `scale(${.96 + .04 * oc(seg(t, 54.6, 54.95))})`;
  // cursor + ripples
  const cv = CUR_VIS.some(([a, b]) => t >= a && t < b); const [cx, cy] = curPos(t, c);
  const fadeC = CUR_VIS.reduce((m, [a, b]) => (t >= a && t < b ? Math.min(seg(t, a, a + .3), 1 - seg(t, b - .3, b)) : m), 0);
  const press = CLICKS.some((k) => t > k - .06 && t < k + .1);
  show($("cur"), cv ? fadeC : 0); $("cur").style.transform = `translate(${cx - 6}px,${cy - 3}px) scale(${press ? .86 : 1})`;
  const rc = CLICKS.filter((k) => t >= k && t < k + .6); ["rip1", "rip2"].forEach((id, i) => { const k = rc[i]; const el = $(id);
    if (k === undefined) { el.style.opacity = 0; return; } const p = seg(t, k, k + .6); const pos = curPos(k, cam(k));
    el.style.left = pos[0] + "px"; el.style.top = pos[1] + "px"; el.style.opacity = (1 - p) * .9; el.style.transform = `scale(${.3 + oc(p) * 1.2})`; });
  // lower third
  const li = LT.findIndex(([a, b]) => t >= a && t < b); const lt = $("lt");
  if (li >= 0) { const [a, b, l, d] = LT[li]; if (li !== lastLT) { $("ltl").textContent = l; $("ltd").textContent = d; lastLT = li; }
    const pi = oc(seg(t, a, a + .45)), po = io(seg(t, b - .35, b)); lt.style.opacity = Math.min(pi, 1 - po); lt.style.transform = `translateX(${(1 - pi) * -40 - po * 20}px)`; }
  else lt.style.opacity = 0;
  // receipts
  const rOn = t >= 74.2 && t < 82.6; show($("rcs"), rOn ? 1 - io(seg(t, 82.1, 82.6)) : 0);
  const rp = oc(seg(t, 74.4, 75.3)); $("rc").style.opacity = rp; $("rc").style.transform = `translateX(${(1 - rp) * -80}px)`;
  const cp = oc(seg(t, 74.9, 76.0)); $("csw").style.opacity = cp; $("csw").style.transform = `translate(${(1 - cp) * 120 + seg(t, 75, 82.6) * -30}px,${seg(t, 75, 82.6) * -14}px) rotate(${2 - cp * 1}deg)`;
  ["r1", "r2", "r3"].forEach((id, i) => { const p = oc(seg(t, 75.4 + i * .45, 76.1 + i * .45)); $(id).style.opacity = p; $(id).style.transform = `translateY(${(1 - p) * 24}px)`; });
  // under the hood
  const uOn = t >= 82.5 && t < 89.1; show($("uhs"), uOn ? 1 - io(seg(t, 88.6, 89.1)) : 0);
  const up = oc(seg(t, 82.6, 83.4)); $("uh").style.opacity = up; $("uh").style.transform = `translateY(${(1 - up) * 50}px)`;
  [1, 2, 3, 4, 5, 6].forEach((n, i) => { const p = oc(seg(t, 83.3 + i * .22, 83.9 + i * .22)); $("u" + n).style.opacity = p; $("u" + n).style.transform = `translateX(${(1 - p) * 30}px)`; });
  // outro
  show($("outro"), t >= 89.1 ? 1 : 0);
  [["ologo", 89.2], ["oname", 89.6], ["ourl", 90.1], ["ometa", 90.5], ["oby", 90.9]].forEach(([id, a]) => { const p = oc(seg(t, a, a + .9)); $(id).style.opacity = p; $(id).style.transform = `translateY(${(1 - p) * 30}px)`; });
  show($("fade"), io(seg(t, 94.0, 95.0)));
}
window.render = render; window.DURATION = 95;
