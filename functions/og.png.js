// functions/og.png.js
//
// Generates a 1200x630 preview image for a given color on the fly.
// Requested as /og.png?c=HEX — referenced by the og:image tag that
// _middleware.js injects.
//
// Requires the "workers-og" package (Satori-based, built for the
// Cloudflare Workers/Pages runtime — no headless browser needed).
// Add it to your repo with:
//   npm install workers-og
// Cloudflare Pages will bundle it automatically at build/deploy time
// as long as package.json is at your repo root.

import { ImageResponse } from 'workers-og';

const HEX_RE = /^[0-9A-Fa-f]{6}$/;
const FALLBACK_HEX = '7C5CFC'; // ChromaX brand purple, used if c= is missing/invalid

export async function onRequest(context) {
  const url = new URL(context.request.url);
  const raw = (url.searchParams.get('c') || '').replace('#', '');
  const hex = HEX_RE.test(raw) ? raw.toUpperCase() : FALLBACK_HEX;

  const { r, g, b } = hexToRgb(hex);
  const textColor = isLight(r, g, b) ? '#111111' : '#FFFFFF';
  const subColor = isLight(r, g, b) ? 'rgba(17,17,17,0.7)' : 'rgba(255,255,255,0.75)';

  const html = `
    <div style="
      display:flex;
      flex-direction:column;
      justify-content:center;
      width:1200px;
      height:630px;
      background:#${hex};
      padding:90px;
      font-family:sans-serif;
    ">
      <div style="font-size:30px; letter-spacing:4px; color:${subColor};">CHROMAX</div>
      <div style="font-size:110px; font-weight:700; color:${textColor}; margin-top:24px;">#${hex}</div>
      <div style="font-size:34px; color:${subColor}; margin-top:18px;">
        rgb(${r}, ${g}, ${b})
      </div>
    </div>
  `;

  return new ImageResponse(html, {
    width: 1200,
    height: 630,
  });
}

function hexToRgb(hex) {
  return {
    r: parseInt(hex.slice(0, 2), 16),
    g: parseInt(hex.slice(2, 4), 16),
    b: parseInt(hex.slice(4, 6), 16),
  };
}

function isLight(r, g, b) {
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.6;
}