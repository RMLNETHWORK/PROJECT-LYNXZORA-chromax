// functions/og.png.js
//
// Generates a 1200x630 preview image for a given color on the fly.
// Uses @cloudflare/pages-plugin-vercel-og — the version of Vercel's
// og-image library built and maintained specifically for Cloudflare
// Pages Functions (as opposed to "workers-og", which targets raw
// Workers and had WASM-bundling issues in the Pages Functions build).
//
// No JSX needed — nodes are built as plain objects, which Satori
// (the underlying renderer) accepts just as well as JSX.
//
// Install with: npm install @cloudflare/pages-plugin-vercel-og

import { ImageResponse } from '@cloudflare/pages-plugin-vercel-og/api';

const HEX_RE = /^[0-9A-Fa-f]{6}$/;
const FALLBACK_HEX = '7C5CFC'; // ChromaX brand purple

export async function onRequest(context) {
  const url = new URL(context.request.url);
  const raw = (url.searchParams.get('c') || '').replace('#', '');
  const hex = HEX_RE.test(raw) ? raw.toUpperCase() : FALLBACK_HEX;

  const { r, g, b } = hexToRgb(hex);
  const textColor = isLight(r, g, b) ? '#111111' : '#FFFFFF';
  const subColor = isLight(r, g, b) ? 'rgba(17,17,17,0.7)' : 'rgba(255,255,255,0.75)';

  const el = {
    type: 'div',
    props: {
      style: {
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        width: '1200px',
        height: '630px',
        background: `#${hex}`,
        padding: '90px',
      },
      children: [
        {
          type: 'div',
          props: {
            style: { fontSize: '30px', letterSpacing: '4px', color: subColor },
            children: 'CHROMAX',
          },
        },
        {
          type: 'div',
          props: {
            style: { fontSize: '110px', fontWeight: 700, color: textColor, marginTop: '24px' },
            children: `#${hex}`,
          },
        },
        {
          type: 'div',
          props: {
            style: { fontSize: '34px', color: subColor, marginTop: '18px' },
            children: `rgb(${r}, ${g}, ${b})`,
          },
        },
      ],
    },
  };

  return new ImageResponse(el, {
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