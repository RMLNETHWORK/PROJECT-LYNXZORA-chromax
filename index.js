// ── Theme ──
const themeToggle = document.getElementById('themeToggle');
const thumbEl     = document.getElementById('toggleThumb');
const htmlEl      = document.documentElement;
const saved = localStorage.getItem('chromax-theme') || 'light';
htmlEl.setAttribute('data-theme', saved);
thumbEl.textContent = saved === 'light' ? '☀️' : '🌙';

themeToggle.addEventListener('click', () => {
  const next = htmlEl.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
  htmlEl.setAttribute('data-theme', next);
  localStorage.setItem('chromax-theme', next);
  thumbEl.textContent = next === 'light' ? '☀️' : '🌙';
  redraw();
});

// ── Canvas & geometry ──
// Actual pixel size driven by CSS; canvas resolution matches
function getWheelSize() {
  return window.innerWidth <= 480 ? 200 : 240;
}
let W = getWheelSize(), CX = W/2, CY = W/2;
let WHEEL_OUTER = Math.round(W * 112/240);
let WHEEL_INNER = Math.round(W * 86/240);
let SQ_HALF = Math.floor(WHEEL_INNER / Math.sqrt(2)) - 2;

const wheelCanvas = document.getElementById('wheelCanvas');
const wCtx = wheelCanvas.getContext('2d');
const svCanvas = document.getElementById('svCanvas');
const sCtx = svCanvas.getContext('2d');

function resizeCanvases() {
  const newW = getWheelSize();
  if (newW === W) return;
  W = newW; CX = W/2; CY = W/2;
  WHEEL_OUTER = Math.round(W * 112/240);
  WHEEL_INNER = Math.round(W * 86/240);
  SQ_HALF = Math.floor(WHEEL_INNER / Math.sqrt(2)) - 2;
  wheelCanvas.width = W; wheelCanvas.height = W;
  svCanvas.width = W; svCanvas.height = W;
  // Update container size via inline style
  const cont = document.getElementById('wheelContainer');
  cont.style.width = W + 'px'; cont.style.height = W + 'px';
  wheelCanvas.style.width = W + 'px'; wheelCanvas.style.height = W + 'px';
  svCanvas.style.width = W + 'px'; svCanvas.style.height = W + 'px';
  // Update alpha strip width
  const strip = document.querySelector('.alpha-strip-wrap');
  if (strip && window.innerWidth <= 480) {
    strip.style.maxWidth = (W + 32) + 'px';
  } else {
    strip.style.maxWidth = '';
  }
  redraw();
  setHueCursor(masterH);
  setSVCursor(masterS, masterV);
}

window.addEventListener('resize', resizeCanvases);

// ── State ──
let masterH = 258, masterS = 63, masterV = 99;
let H = masterH, S = masterS, V = masterV;
let masterA = 1; // 0-1

// ── Color math ──
function hsvToRgb(h,s,v){
  s/=100;v/=100;
  const f=(n,k=(n+h/60)%6)=>v-v*s*Math.max(0,Math.min(k,4-k,1));
  return{r:Math.round(f(5)*255),g:Math.round(f(3)*255),b:Math.round(f(1)*255)};
}
function rgbToHex(r,g,b){
  return'#'+[r,g,b].map(v=>Math.round(v).toString(16).padStart(2,'0')).join('').toUpperCase();
}
function hexToRgb(hex){
  hex=hex.replace('#','');
  if(hex.length===3)hex=hex.split('').map(c=>c+c).join('');
  const n=parseInt(hex,16);
  return{r:(n>>16)&255,g:(n>>8)&255,b:n&255};
}
function rgbToHsv(r,g,b){
  r/=255;g/=255;b/=255;
  const max=Math.max(r,g,b),min=Math.min(r,g,b),d=max-min;
  let h=0;
  const s=max===0?0:d/max,v=max;
  if(d!==0){switch(max){
    case r:h=((g-b)/d+(g<b?6:0))/6;break;
    case g:h=((b-r)/d+2)/6;break;
    case b:h=((r-g)/d+4)/6;break;
  }}
  return{h:Math.round(h*360),s:Math.round(s*100),v:Math.round(v*100)};
}
function rgbToHsl(r,g,b){
  r/=255;g/=255;b/=255;
  const max=Math.max(r,g,b),min=Math.min(r,g,b);
  let h=0,s=0,l=(max+min)/2;
  if(max!==min){
    const d=max-min;
    s=l>0.5?d/(2-max-min):d/(max+min);
    switch(max){
      case r:h=((g-b)/d+(g<b?6:0))/6;break;
      case g:h=((b-r)/d+2)/6;break;
      case b:h=((r-g)/d+4)/6;break;
    }
  }
  return{h:Math.round(h*360),s:Math.round(s*100),l:Math.round(l*100)};
}
function rgbToCmyk(r,g,b){
  r/=255;g/=255;b/=255;
  const k=1-Math.max(r,g,b);
  if(k===1)return{c:0,m:0,y:0,k:100};
  return{c:Math.round((1-r-k)/(1-k)*100),m:Math.round((1-g-k)/(1-k)*100),
         y:Math.round((1-b-k)/(1-k)*100),k:Math.round(k*100)};
}
function clamp(n,min,max){return Math.max(min,Math.min(max,n));}

// 25002500 OKLCH 25002500
function rgbToOklch(r,g,b){
  const lin=v=>{v/=255;return v<=0.04045?v/12.92:Math.pow((v+0.055)/1.055,2.4);};
  const lr=lin(r),lg=lin(g),lb=lin(b);
  const X=0.4122214708*lr+0.5363325363*lg+0.0514459929*lb;
  const Y=0.2119034982*lr+0.6806995451*lg+0.1073969566*lb;
  const Z=0.0883024619*lr+0.2817188376*lg+0.6299787005*lb;
  const l_=Math.cbrt(0.8189330101*X+0.3618667424*Y-0.1288597137*Z);
  const m_=Math.cbrt(0.0329845436*X+0.9293118715*Y+0.0361456387*Z);
  const s_=Math.cbrt(0.0482003018*X+0.2643662691*Y+0.6338517070*Z);
  const L=0.2104542553*l_+0.7936177850*m_-0.0040720468*s_;
  const a=1.9779984951*l_-2.4285922050*m_+0.4505937099*s_;
  const bk=0.0259040371*l_+0.7827717662*m_-0.8086757660*s_;
  const C=Math.sqrt(a*a+bk*bk);
  let Hok=Math.atan2(bk,a)*180/Math.PI;
  if(Hok<0)Hok+=360;
  return{L:Math.round(L*1000)/10,C:Math.round(C*10000)/10000,H:Math.round(Hok*10)/10};
}
// ── CIE LAB ──
function rgbToLab(r,g,b){
  // sRGB → linear
  const lin=v=>{v/=255;return v<=0.04045?v/12.92:Math.pow((v+0.055)/1.055,2.4);};
  const lr=lin(r),lg=lin(g),lb=lin(b);
  // linear sRGB → XYZ D65
  let X=0.4124564*lr+0.3575761*lg+0.1804375*lb;
  let Y=0.2126729*lr+0.7151522*lg+0.0721750*lb;
  let Z=0.0193339*lr+0.1191920*lg+0.9503041*lb;
  // Normalize by D65 illuminant
  X/=0.95047; Y/=1.00000; Z/=1.08883;
  // XYZ → Lab
  const f=t=>t>0.008856?Math.cbrt(t):(7.787*t+16/116);
  const fx=f(X),fy=f(Y),fz=f(Z);
  const L=Math.round((116*fy-16)*10)/10;
  const a=Math.round((500*(fx-fy))*10)/10;
  const bk=Math.round((200*(fy-fz))*10)/10;
  return{L,a,b:bk};
}

function wrapHue(h){return Math.round((h%360+360)%360);}
function clamp01(n){return clamp(n,0,1);}

function setMasterHSV(h,s,v,_unused=false,fromHex=false){
  masterH=wrapHue(h);masterS=clamp(Math.round(s),0,100);masterV=clamp(Math.round(v),0,100);
  H=masterH;S=masterS;V=masterV;
  drawSV(H);setHueCursor(H);setSVCursor(S,V);updateChips(fromHex);
}

// ══════════════════════════════════════════════════════
//  CVD SIMULATION — Machado, Oliveira & Fernandes (2009)
//  "A Physiologically-based Model for Simulation of
//   Color Vision Deficiency"  IEEE TVCG 15(6) pp.1291-1298
//
//  Pipeline: sRGB → linearize → apply pre-multiplied 
//            CVD matrix (HPE-calibrated) → gamma-encode → clip
// ══════════════════════════════════════════════════════

// sRGB ↔ linear (IEC 61966-2-1)
function srgbToLinear(v){ v/=255; return v<=0.04045?v/12.92:Math.pow((v+0.055)/1.055,2.4); }
function linearToSrgb(v){ v=clamp01(v); return Math.round((v<=0.0031308?12.92*v:1.055*Math.pow(v,1/2.4)-0.055)*255); }

// CVD matrices — Machado 2009, severity=1.0, pre-multiplied linear RGB space
// Source: https://www.inf.ufrgs.br/~oliveira/pubs_files/CVD_Simulation/
const CVD_MATRICES = {
  deuteranopia: [
     0.367322,  0.860646, -0.227968,
     0.280085,  0.672501,  0.047413,
    -0.011820,  0.042940,  0.968881,
  ],
  protanopia: [
     0.152286,  1.052583, -0.204868,
     0.114503,  0.786281,  0.099216,
    -0.003882, -0.048116,  1.051998,
  ],
  tritanopia: [
     1.255528, -0.076749, -0.178779,
    -0.078411,  0.930809,  0.147602,
     0.004733,  0.691367,  0.303900,
  ],
};

// Achromatopsia: weighted luminance (CIE 1931, sRGB coefficients)
function simulateAchromatopsia(r,g,b){
  const linR=srgbToLinear(r), linG=srgbToLinear(g), linB=srgbToLinear(b);
  const Y = 0.2126*linR + 0.7152*linG + 0.0722*linB; // linear luminance
  const out=linearToSrgb(Y);
  return {r:out,g:out,b:out};
}

function simulateCVD(type, r8, g8, b8){
  if(type==='achromatopsia') return simulateAchromatopsia(r8,g8,b8);
  const m=CVD_MATRICES[type];
  if(!m) return{r:r8,g:g8,b:b8};
  const r=srgbToLinear(r8),g=srgbToLinear(g8),b=srgbToLinear(b8);
  return{
    r:linearToSrgb(m[0]*r+m[1]*g+m[2]*b),
    g:linearToSrgb(m[3]*r+m[4]*g+m[5]*b),
    b:linearToSrgb(m[6]*r+m[7]*g+m[8]*b),
  };
}

function updateCVDPanel(hex){
  const {r,g,b}=hexToRgb(hex);
  const types=['deuteranopia','protanopia','tritanopia','achromatopsia'];
  types.forEach(type=>{
    document.getElementById('cvd-orig-'+type).style.background=hex;
    const sim=simulateCVD(type,r,g,b);
    const simHex=rgbToHex(sim.r,sim.g,sim.b);
    document.getElementById('cvd-sim-'+type).style.background=simHex;
    const hexEl=document.getElementById('cvd-hex-'+type);
    hexEl.textContent=simHex;
    hexEl.onclick=()=>{
      navigator.clipboard.writeText(simHex);
      showToast('Copied '+type+' sim: '+simHex);
    };
  });
}

// ── Draw hue wheel ──
function drawWheel(){
  wCtx.clearRect(0,0,W,W);
  for(let i=0;i<360;i++){
    const a0=(i/360)*Math.PI*2-Math.PI/2;
    const a1=((i+1)/360)*Math.PI*2-Math.PI/2;
    wCtx.beginPath();
    wCtx.arc(CX,CY,WHEEL_OUTER,a0,a1);
    wCtx.arc(CX,CY,WHEEL_INNER,a1,a0,true);
    wCtx.closePath();
    wCtx.fillStyle=`hsl(${i},100%,50%)`;
    wCtx.fill();
  }
  // Soft inner edge shadow on ring
  const innerGrad=wCtx.createRadialGradient(CX,CY,WHEEL_INNER-2,CX,CY,WHEEL_INNER+8);
  innerGrad.addColorStop(0,'rgba(0,0,0,0.18)');
  innerGrad.addColorStop(1,'rgba(0,0,0,0)');
  wCtx.beginPath();
  wCtx.arc(CX,CY,WHEEL_OUTER,0,Math.PI*2);
  wCtx.arc(CX,CY,WHEEL_INNER,0,Math.PI*2,true);
  wCtx.fillStyle=innerGrad;
  wCtx.fill();
}

// ── Draw SV square ──
function drawSV(hue){
  sCtx.clearRect(0,0,W,W);
  const x0=CX-SQ_HALF,y0=CY-SQ_HALF,size=SQ_HALF*2;

  sCtx.save();
  roundRect(sCtx,x0,y0,size,size,10);
  sCtx.clip();

  // Pure hue base
  sCtx.fillStyle=`hsl(${hue},100%,50%)`;
  sCtx.fillRect(x0,y0,size,size);

  // White gradient L→R (saturation)
  const gS=sCtx.createLinearGradient(x0,0,x0+size,0);
  gS.addColorStop(0,'rgba(255,255,255,1)');
  gS.addColorStop(1,'rgba(255,255,255,0)');
  sCtx.fillStyle=gS;
  sCtx.fillRect(x0,y0,size,size);

  // Black gradient T→B (value)
  const gV=sCtx.createLinearGradient(0,y0,0,y0+size);
  gV.addColorStop(0,'rgba(0,0,0,0)');
  gV.addColorStop(1,'rgba(0,0,0,1)');
  sCtx.fillStyle=gV;
  sCtx.fillRect(x0,y0,size,size);

  sCtx.restore();

  // Corner labels
  sCtx.font='500 8px DM Sans, sans-serif';
  sCtx.fillStyle='rgba(255,255,255,0.5)';
  sCtx.textAlign='left';  sCtx.textBaseline='top';    sCtx.fillText('W',x0+5,y0+4);
  sCtx.textAlign='right'; sCtx.textBaseline='top';    sCtx.fillText('Hue',x0+size-4,y0+4);
  sCtx.textAlign='left';  sCtx.textBaseline='bottom'; sCtx.fillText('K',x0+5,y0+size-4);
}

function roundRect(ctx,x,y,w,h,r){
  ctx.beginPath();
  ctx.moveTo(x+r,y);
  ctx.lineTo(x+w-r,y);ctx.quadraticCurveTo(x+w,y,x+w,y+r);
  ctx.lineTo(x+w,y+h-r);ctx.quadraticCurveTo(x+w,y+h,x+w-r,y+h);
  ctx.lineTo(x+r,y+h);ctx.quadraticCurveTo(x,y+h,x,y+h-r);
  ctx.lineTo(x,y+r);ctx.quadraticCurveTo(x,y,x+r,y);
  ctx.closePath();
}

function redraw(){ drawWheel(); drawSV(H); }

// ── Cursors ──
function setHueCursor(hue){
  const angle=(hue-90)*Math.PI/180;
  const r=(WHEEL_OUTER+WHEEL_INNER)/2;
  const el=document.getElementById('hueCursor');
  el.style.left=(CX+r*Math.cos(angle))+'px';
  el.style.top =(CY+r*Math.sin(angle))+'px';
  el.style.background=`hsl(${hue},100%,50%)`;
}
function setSVCursor(s,v){
  const x=CX-SQ_HALF+(s/100)*(SQ_HALF*2);
  const y=CY-SQ_HALF+((100-v)/100)*(SQ_HALF*2);
  const el=document.getElementById('svCursor');
  el.style.left=x+'px';
  el.style.top =y+'px';
  el.style.borderColor=v>55&&s<55?'rgba(0,0,0,0.6)':'#fff';
}

// ── Event helpers ──
function getPos(e){
  const rect=document.getElementById('wheelContainer').getBoundingClientRect();
  const cx=e.touches?e.touches[0].clientX:e.clientX;
  const cy=e.touches?e.touches[0].clientY:e.clientY;
  // rect.width is the CSS-rendered size; W is the logical canvas size — keep ratio 1:1
  return{x:(cx-rect.left),y:(cy-rect.top)};
}
function distC(p){const dx=p.x-CX,dy=p.y-CY;return Math.sqrt(dx*dx+dy*dy);}
function onWheel(p){return distC(p)>=WHEEL_INNER-6&&distC(p)<=WHEEL_OUTER+6;}
function onSquare(p){return p.x>=CX-SQ_HALF-3&&p.x<=CX+SQ_HALF+3&&p.y>=CY-SQ_HALF-3&&p.y<=CY+SQ_HALF+3;}

function pickHue(p){
  let angle=Math.atan2(p.y-CY,p.x-CX)*180/Math.PI+90;
  if(angle<0)angle+=360;
  setMasterHSV(Math.round(angle)%360,masterS,masterV,false);
}
function pickSV(p){
  const x0=CX-SQ_HALF,y0=CY-SQ_HALF,size=SQ_HALF*2;
  const nextS=Math.round(Math.max(0,Math.min(1,(p.x-x0)/size))*100);
  const nextV=Math.round(Math.max(0,Math.min(1,1-(p.y-y0)/size))*100);
  setMasterHSV(masterH,nextS,nextV,false);
}

let drag=null;
const cont=document.getElementById('wheelContainer');
cont.addEventListener('mousedown',e=>{const p=getPos(e);if(onWheel(p)){drag='w';pickHue(p);}else if(onSquare(p)){drag='s';pickSV(p);}});
window.addEventListener('mousemove',e=>{if(!drag)return;const p=getPos(e);if(drag==='w')pickHue(p);else pickSV(p);});
window.addEventListener('mouseup',()=>drag=null);
cont.addEventListener('touchstart',e=>{e.preventDefault();const p=getPos(e);if(onWheel(p)){drag='w';pickHue(p);}else if(onSquare(p)){drag='s';pickSV(p);}},{passive:false});
window.addEventListener('touchmove',e=>{if(!drag)return;e.preventDefault();const p=getPos(e);if(drag==='w')pickHue(p);else pickSV(p);},{passive:false});
window.addEventListener('touchend',()=>drag=null);

// ── Alpha strip ──
const alphaTrack = document.getElementById('alphaTrack');
const alphaThumb = document.getElementById('alphaThumb');

function setAlphaFromX(clientX) {
  const rect = alphaTrack.getBoundingClientRect();
  const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
  masterA = Math.round(ratio * 100) / 100;
  updateAlphaUI();
  updateChips();
}

function updateAlphaUI() {
  const pct = masterA * 100;
  const { r, g, b } = hsvToRgb(H, S, V);
  const hex6 = rgbToHex(r, g, b);
  // position thumb
  alphaThumb.style.left = (masterA * 100) + '%';
  alphaThumb.style.background = `rgba(${r},${g},${b},${masterA})`;
  // gradient overlay: transparent → current color
  document.getElementById('alphaGradient').style.background =
    `linear-gradient(to right, transparent, ${hex6})`;
  // label
  document.getElementById('alphaLabel').textContent =
    pct === 100 ? '100%' : (pct % 1 === 0 ? pct + '%' : pct.toFixed(0) + '%');
  // dim label when fully opaque (no alpha in play)
  document.getElementById('alphaLabel').style.color =
    masterA < 1 ? 'var(--accent)' : 'var(--muted)';
}

let alphaDrag = false;
alphaTrack.addEventListener('mousedown', e => { alphaDrag = true; setAlphaFromX(e.clientX); });
window.addEventListener('mousemove', e => { if (alphaDrag) setAlphaFromX(e.clientX); });
window.addEventListener('mouseup', () => { alphaDrag = false; });
alphaTrack.addEventListener('touchstart', e => { e.preventDefault(); alphaDrag = true; setAlphaFromX(e.touches[0].clientX); }, { passive: false });
window.addEventListener('touchmove', e => { if (alphaDrag) { e.preventDefault(); setAlphaFromX(e.touches[0].clientX); } }, { passive: false });
window.addEventListener('touchend', () => { alphaDrag = false; });

// ── Format-aware Color Input Bar ──
const FORMAT_META = {
  hex:   { placeholder: '#7C5CFC',                    hint: '#RRGGBB' },
  rgb:   { placeholder: 'rgb(124, 92, 252)',           hint: 'rgb(r, g, b)' },
  hsl:   { placeholder: 'hsl(258, 96%, 67%)',          hint: 'hsl(h, s%, l%)' },
  hsv:   { placeholder: 'hsv(258, 63%, 99%)',          hint: 'hsv(h, s%, v%)' },
  cmyk:  { placeholder: 'cmyk(51%, 63%, 0%, 1%)',      hint: 'cmyk(c%, m%, y%, k%)' },
  lab:   { placeholder: 'lab(45.2 38.4 -67.1)',        hint: 'lab(L a b)' },
  oklch: { placeholder: 'oklch(67.0% 0.1934 258.0)',   hint: 'oklch(L% C H)' },
  css:   { placeholder: '--color: #7C5CFC',            hint: '--varname: #RRGGBB' },
};

// Parse any supported format string → {r, g, b, a} or null
// Alpha (a) is 0-1; defaults to 1 if not present in the string.
function parseColorInput(fmt, raw) {
  raw = raw.trim();
  let m;
  // Shared alpha extractor — looks for "/ 0.5" or ", 0.5" or "/ 50%" at end
  function extractAlpha(str) {
    const slash = str.match(/\/\s*([\d.]+)(%?)\s*\)?\s*$/);
    if (slash) {
      return slash[2] === '%' ? clamp(+slash[1] / 100, 0, 1) : clamp(+slash[1], 0, 1);
    }
    // legacy comma-separated 4th arg: rgba(r,g,b,a)
    const comma = str.match(/,\s*([\d.]+)\s*\)\s*$/);
    if (comma) return clamp(+comma[1], 0, 1);
    return null;
  }
  try {
    if (fmt === 'hex') {
      let v = raw.startsWith('#') ? raw : '#' + raw;
      // 8-digit hex with alpha (#RRGGBBAA)
      if (/^#[0-9A-Fa-f]{8}$/.test(v)) {
        const rgb = hexToRgb(v.slice(0, 7));
        const a = parseInt(v.slice(7, 9), 16) / 255;
        return { ...rgb, a: Math.round(a * 100) / 100 };
      }
      if (/^#[0-9A-Fa-f]{6}$/.test(v)) return { ...hexToRgb(v), a: 1 };
      return null;
    }
    if (fmt === 'css') {
      // Accept "--name: rgba(r,g,b,a)" or "--name: #RRGGBBAA" etc.
      const hexMatch = raw.match(/#([0-9A-Fa-f]{6,8})(?=\s*$|;)/);
      if (hexMatch) {
        const full = '#' + hexMatch[1];
        if (hexMatch[1].length === 8) {
          const rgb = hexToRgb(full.slice(0, 7));
          const a = parseInt(full.slice(7), 16) / 255;
          return { ...rgb, a: Math.round(a * 100) / 100 };
        }
        return { ...hexToRgb(full), a: 1 };
      }
      // rgba() inside css var
      const rgbaMatch = raw.match(/rgba?\s*\(([^)]+)\)/i);
      if (rgbaMatch) {
        const parts = rgbaMatch[1].split(',').map(s => s.trim());
        const r = clamp(+parts[0], 0, 255), g = clamp(+parts[1], 0, 255), b = clamp(+parts[2], 0, 255);
        const a = parts[3] !== undefined ? clamp(+parts[3], 0, 1) : 1;
        return { r, g, b, a };
      }
      return null;
    }
    if (fmt === 'rgb') {
      m = raw.match(/rgba?\s*\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)(.*)/i);
      if (m) {
        const a = extractAlpha(m[4]) ?? 1;
        return { r: clamp(+m[1],0,255), g: clamp(+m[2],0,255), b: clamp(+m[3],0,255), a };
      }
      // modern space syntax: rgb(r g b / a)
      m = raw.match(/rgba?\s*\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)(.*)/i);
      if (m) {
        const a = extractAlpha(m[4]) ?? 1;
        return { r: clamp(+m[1],0,255), g: clamp(+m[2],0,255), b: clamp(+m[3],0,255), a };
      }
      return null;
    }
    if (fmt === 'hsl') {
      m = raw.match(/hsla?\s*\(\s*([\d.]+)\s*[,\s]\s*([\d.]+)%?\s*[,\s]\s*([\d.]+)%?(.*)/i);
      if (m) {
        const h=+m[1], s=+m[2], l=+m[3];
        if(s<0||s>100||l<0||l>100) return null;
        const a = extractAlpha(m[4]) ?? 1;
        return { ...hexToRgb(hslToHex(h, s, l)), a };
      }
      return null;
    }
    if (fmt === 'hsv') {
      m = raw.match(/hsva?\s*\(\s*([\d.]+)\s*[,\s]\s*([\d.]+)%?\s*[,\s]\s*([\d.]+)%?(.*)/i);
      if (m) {
        const h=+m[1], s=clamp(+m[2],0,100), v=clamp(+m[3],0,100);
        const a = extractAlpha(m[4]) ?? 1;
        return { ...hsvToRgb(h, s, v), a };
      }
      return null;
    }
    if (fmt === 'cmyk') {
      // CMYK has no standard alpha, but support "/ 0.5" suffix
      m = raw.match(/cmyk\s*\(\s*([\d.]+)%?\s*,\s*([\d.]+)%?\s*,\s*([\d.]+)%?\s*,\s*([\d.]+)%?(.*)/i);
      if (m) {
        const c=+m[1]/100, my=+m[2]/100, y=+m[3]/100, k=+m[4]/100;
        const a = extractAlpha(m[5]) ?? 1;
        return {
          r: Math.round(255*(1-c)*(1-k)),
          g: Math.round(255*(1-my)*(1-k)),
          b: Math.round(255*(1-y)*(1-k)),
          a,
        };
      }
      return null;
    }
    if (fmt === 'lab') {
      // lab(L a b / alpha) — CSS Color 4 syntax
      m = raw.match(/lab\s*\(?\s*([\d.]+)%?\s+([\-\d.]+)\s+([\-\d.]+)(.*)/i);
      if (m) {
        const a = extractAlpha(m[4]) ?? 1;
        return { ...labToRgb(+m[1], +m[2], +m[3]), a };
      }
      return null;
    }
    if (fmt === 'oklch') {
      // oklch(L% C H / alpha)
      m = raw.match(/oklch\s*\(?\s*([\d.]+)%?\s+([\d.]+)\s+([\d.]+)(.*)/i);
      if (m) {
        const a = extractAlpha(m[4]) ?? 1;
        return { ...oklchToRgb(+m[1]/100, +m[2], +m[3]), a };
      }
      return null;
    }
  } catch(e) {}
  return null;
}

// LAB → RGB (inverse of rgbToLab)
function labToRgb(L, a, b) {
  let fy = (L + 16) / 116;
  let fx = a / 500 + fy;
  let fz = fy - b / 200;
  const d = 6/29, d3 = d*d*d, d2 = 3*d*d;
  const xn=0.95047, yn=1.0, zn=1.08883;
  const X = xn * (fx*fx*fx > d3 ? fx*fx*fx : (fx - 16/116)*d2);
  const Y = yn * (fy*fy*fy > d3 ? fy*fy*fy : (fy - 16/116)*d2);
  const Z = zn * (fz*fz*fz > d3 ? fz*fz*fz : (fz - 16/116)*d2);
  // XYZ D65 → linear sRGB
  let r =  3.2404542*X - 1.5371385*Y - 0.4985314*Z;
  let g = -0.9692660*X + 1.8760108*Y + 0.0415560*Z;
  let bv =  0.0556434*X - 0.2040259*Y + 1.0572252*Z;
  // linear → sRGB gamma
  const gc = v => { v=clamp(v,0,1); return Math.round((v<=0.0031308?12.92*v:1.055*Math.pow(v,1/2.4)-0.055)*255); };
  return {r:gc(r), g:gc(g), b:gc(bv)};
}

// OKLCH → RGB
function oklchToRgb(L, C, H) {
  const hRad = H * Math.PI / 180;
  const a = C * Math.cos(hRad);
  const bv = C * Math.sin(hRad);
  // OKLab → LMS cube roots
  const l_ = L + 0.3963377774*a + 0.2158037573*bv;
  const m_ = L - 0.1055613458*a - 0.0638541728*bv;
  const s_ = L - 0.0894841775*a - 1.2914855480*bv;
  const l3 = l_*l_*l_, m3 = m_*m_*m_, s3 = s_*s_*s_;
  // LMS → linear sRGB
  let r =  4.0767416621*l3 - 3.3077115913*m3 + 0.2309699292*s3;
  let g = -1.2684380046*l3 + 2.6097574011*m3 - 0.3413193965*s3;
  let b = -0.0041960863*l3 - 0.7034186147*m3 + 1.7076147010*s3;
  const gc = v => { v=clamp(v,0,1); return Math.round((v<=0.0031308?12.92*v:1.055*Math.pow(v,1/2.4)-0.055)*255); };
  return {r:gc(r), g:gc(g), b:gc(b)};
}

let _activeFormat = 'hex';
const colorInputEl = document.getElementById('colorInput');
const formatSelectEl = document.getElementById('formatSelect');
const cibErrorEl = document.getElementById('cibError');

function setCibError(msg) {
  if (msg) {
    cibErrorEl.textContent = msg;
    cibErrorEl.classList.add('visible');
    colorInputEl.classList.add('error');
  } else {
    cibErrorEl.classList.remove('visible');
    colorInputEl.classList.remove('error');
  }
}

function applyColorInput(raw, fmt) {
  const rgb = parseColorInput(fmt, raw);
  if (!rgb) {
    setCibError('Invalid ' + fmt.toUpperCase() + ' — try: ' + FORMAT_META[fmt].hint);
    return;
  }
  setCibError(null);
  // Apply alpha if present in the parsed result
  if (rgb.a !== undefined && rgb.a !== masterA) {
    masterA = clamp(Math.round(rgb.a * 100) / 100, 0, 1);
    updateAlphaUI();
  }
  const hsv = rgbToHsv(rgb.r, rgb.g, rgb.b);
  setMasterHSV(hsv.h, hsv.s, hsv.v, false, true);
}

colorInputEl.addEventListener('input', e => {
  applyColorInput(e.target.value.trim(), _activeFormat);
});

colorInputEl.addEventListener('keydown', e => {
  if (e.key === 'Enter') applyColorInput(colorInputEl.value.trim(), _activeFormat);
});

formatSelectEl.addEventListener('change', () => {
  _activeFormat = formatSelectEl.value;
  // Populate the input with the current color in the new format
  syncCibToCurrentColor();
  setCibError(null);
  colorInputEl.focus();
});

function syncCibToCurrentColor() {
  const {r,g,b} = hsvToRgb(H, S, V);
  const hex = rgbToHex(r, g, b);
  const hsl = rgbToHsl(r, g, b);
  const cmyk = rgbToCmyk(r, g, b);
  const oklch = rgbToOklch(r, g, b);
  const lab = rgbToLab(r, g, b);
  const A = masterA;
  const hasA = A < 1;
  const aR = Math.round(A * 100) / 100;
  // 8-digit hex alpha suffix
  const hexAlphaSuffix = Math.round(A * 255).toString(16).padStart(2, '0').toUpperCase();
  const vals = {
    hex:   hasA ? hex + hexAlphaSuffix : hex,
    rgb:   hasA ? `rgba(${r}, ${g}, ${b}, ${aR})` : `rgb(${r}, ${g}, ${b})`,
    hsl:   hasA ? `hsla(${hsl.h}, ${hsl.s}%, ${hsl.l}%, ${aR})` : `hsl(${hsl.h}, ${hsl.s}%, ${hsl.l}%)`,
    hsv:   hasA ? `hsva(${H}, ${S}%, ${V}%, ${aR})` : `hsv(${H}, ${S}%, ${V}%)`,
    cmyk:  hasA ? `cmyk(${cmyk.c}%, ${cmyk.m}%, ${cmyk.y}%, ${cmyk.k}%) / ${aR}` : `cmyk(${cmyk.c}%, ${cmyk.m}%, ${cmyk.y}%, ${cmyk.k}%)`,
    lab:   hasA ? `lab(${lab.L} ${lab.a} ${lab.b} / ${aR})` : `lab(${lab.L} ${lab.a} ${lab.b})`,
    oklch: hasA ? `oklch(${oklch.L}% ${oklch.C} ${oklch.H} / ${aR})` : `oklch(${oklch.L}% ${oklch.C} ${oklch.H})`,
    css:   hasA ? `--color: rgba(${r}, ${g}, ${b}, ${aR})` : `--color: ${hex}`,
  };
  colorInputEl.value = vals[_activeFormat] || hex;
  // Update live swatch dot — show transparency via semi-transparent background
  const swatchEl = document.getElementById('cibSwatch');
  if (swatchEl) swatchEl.style.background = hasA ? `rgba(${r},${g},${b},${aR})` : hex;
}

// ── Update ──
function updateChips(fromHex=false){
  const {r,g,b}=hsvToRgb(H,S,V);
  const hex=rgbToHex(r,g,b);
  const hsl=rgbToHsl(r,g,b);
  const cmyk=rgbToCmyk(r,g,b);
  const oklch=rgbToOklch(r,g,b);
  const lab=rgbToLab(r,g,b);
  const A=masterA;
  const hasAlpha=A<1;
  const aRounded=Math.round(A*100)/100;
  const aPct=Math.round(A*100);

  // HEX: 6-digit when opaque, 8-digit when transparent
  const hexAlpha=Math.round(A*255).toString(16).padStart(2,'0').toUpperCase();
  const hexOut=hasAlpha?hex+hexAlpha:hex;

  // CSS display color (used for logo dot and harmony base)
  const cssColor=hasAlpha?`rgba(${r},${g},${b},${aRounded})`:hex;

  // Drive chip accent bars and hex-badge border with the live color
  document.documentElement.style.setProperty('--chip-accent', cssColor);

  if(!fromHex) syncCibToCurrentColor();
  document.getElementById('logoDot').style.background=cssColor;
  document.getElementById('logoDot').style.boxShadow=`0 0 0 3px var(--bg), 0 0 0 5px ${hex}88`;
  document.getElementById('toggleThumb').style.background=cssColor;

  document.getElementById('val-hex').textContent =hexOut;
  document.getElementById('val-rgb').textContent =hasAlpha
    ?`rgba(${r}, ${g}, ${b}, ${aRounded})`
    :`rgb(${r}, ${g}, ${b})`;
  document.getElementById('val-hsl').textContent =hasAlpha
    ?`hsla(${hsl.h}, ${hsl.s}%, ${hsl.l}%, ${aRounded})`
    :`hsl(${hsl.h}, ${hsl.s}%, ${hsl.l}%)`;
  document.getElementById('val-hsv').textContent =hasAlpha
    ?`hsva(${H}, ${S}%, ${V}%, ${aRounded})`
    :`hsv(${H}, ${S}%, ${V}%)`;
  document.getElementById('val-cmyk').textContent=hasAlpha
    ?`cmyk(${cmyk.c}%, ${cmyk.m}%, ${cmyk.y}%, ${cmyk.k}%) / ${aPct}%`
    :`cmyk(${cmyk.c}%, ${cmyk.m}%, ${cmyk.y}%, ${cmyk.k}%)`;
  document.getElementById('val-css').textContent  =hasAlpha
    ?`--color: rgba(${r}, ${g}, ${b}, ${aRounded})`
    :`--color: ${hex}`;
  const oklchEl=document.getElementById('val-oklch');
  if(oklchEl)oklchEl.textContent=hasAlpha
    ?`oklch(${oklch.L}% ${oklch.C} ${oklch.H} / ${aRounded})`
    :`oklch(${oklch.L}% ${oklch.C} ${oklch.H})`;
  const labEl=document.getElementById('val-lab');
  if(labEl)labEl.textContent=hasAlpha
    ?`lab(${lab.L} ${lab.a} ${lab.b} / ${aRounded})`
    :`lab(${lab.L} ${lab.a} ${lab.b})`;

  updateAlphaUI();
  updateCVDPanel(hex);
  renderHarmonies(hex);
}

// ── Harmonies ──
function hslToHex(h,s,l){
  s/=100;l/=100;
  const k=n=>(n+h/30)%12,a=s*Math.min(l,1-l);
  const f=n=>l-a*Math.max(-1,Math.min(k(n)-3,Math.min(9-k(n),1)));
  return rgbToHex(Math.round(f(0)*255),Math.round(f(8)*255),Math.round(f(4)*255));
}
function renderHarmonies(hex){
  const {r,g,b}=hexToRgb(hex);
  const {h,s,l}=rgbToHsl(r,g,b);
  const rot=d=>((h+d)%360+360)%360;
  const sets={
    'h-complementary':[hex,hslToHex(rot(180),s,l)],
    'h-analogous':[hslToHex(rot(-30),s,l),hex,hslToHex(rot(30),s,l),hslToHex(rot(60),s,l)],
    'h-triadic':[hex,hslToHex(rot(120),s,l),hslToHex(rot(240),s,l)],
    'h-split':[hex,hslToHex(rot(150),s,l),hslToHex(rot(210),s,l)],
    'h-tetradic':[hex,hslToHex(rot(90),s,l),hslToHex(rot(180),s,l),hslToHex(rot(270),s,l)],
    'h-tints':[10,20,30,40,50,60,70,80,90].map(lt=>hslToHex(h,s,lt)),
  };
  for(const [id,colors] of Object.entries(sets)){
    const wrap=document.getElementById(id);
    wrap.innerHTML='';
    colors.forEach(color=>{
      const div=document.createElement('div');
      div.className='swatch'+(color.toUpperCase()===hex.toUpperCase()?' active':'');
      div.style.background=color;
      const label=document.createElement('span');
      label.className='swatch-hex';label.textContent=color.toUpperCase();
      div.appendChild(label);
      div.addEventListener('click',()=>{
        const {r,g,b}=hexToRgb(color);
        const hsv=rgbToHsv(r,g,b);
        setMasterHSV(hsv.h,hsv.s,hsv.v,true);
      });
      wrap.appendChild(div);
    });
  }
}

function copyChip(el){
  const val=el.querySelector('.chip-value').textContent;
  navigator.clipboard.writeText(val).then(()=>{
    el.classList.add('copied');
    el.querySelector('.chip-copy').textContent='copied!';
    showToast('Copied: '+val);
    setTimeout(()=>{el.classList.remove('copied');el.querySelector('.chip-copy').textContent='copy';},1500);
  });
}
function showToast(msg){
  const t=document.getElementById('toast');
  t.textContent=msg;t.classList.add('show');
  clearTimeout(t._t);t._t=setTimeout(()=>t.classList.remove('show'),2000);
}

// ── Init ──
redraw();
setHueCursor(masterH);
setSVCursor(masterS, masterV);
updateAlphaUI();
updateChips();
syncCibToCurrentColor();