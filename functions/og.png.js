// functions/og.png.js
//
// Generates a 1200x630 preview image for a given color, with the
// ChromaX logo badge in the top-right corner for branding.
//
// Uses @cloudflare/pages-plugin-vercel-og (Cloudflare's Pages-Functions
// build of Vercel's og-image library).

import { ImageResponse } from '@cloudflare/pages-plugin-vercel-og/api';

const HEX_RE = /^[0-9A-Fa-f]{6}$/;
const FALLBACK_HEX = '7C5CFC'; // ChromaX brand purple
const LOGO_PATH = '/LynxZora%20-%20ChromaX%20Logo.png'; // spaces URL-encoded

export async function onRequest(context) {
  const url = new URL(context.request.url);
  const raw = (url.searchParams.get('c') || '').replace('#', '');
  const hex = HEX_RE.test(raw) ? raw.toUpperCase() : FALLBACK_HEX;

  const { r, g, b } = hexToRgb(hex);
  const textColor = isLight(r, g, b) ? '#111111' : '#FFFFFF';
  const subColor = isLight(r, g, b) ? 'rgba(17,17,17,0.7)' : 'rgba(255,255,255,0.75)';
  const badgeBg = isLight(r, g, b) ? 'rgba(17,17,17,0.12)' : 'rgba(255,255,255,0.18)';

  // Fetch the logo and inline it as a base64 data URI — Satori can't
  // fetch remote images mid-render, so this has to happen up front.
  const logoDataUri = await fetchAsDataUri(`${url.origin}${LOGO_PATH}`);

  const el = {
    type: 'div',
    props: {
      style: {
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        width: '1200px',
        height: '630px',
        background: `#${hex}`,
        padding: '90px',
      },
      children: [
        // Logo badge, top-right corner
        logoDataUri && {
          type: 'div',
          props: {
            style: {
              position: 'absolute',
              top: '50px',
              right: '50px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '96px',
              height: '96px',
              borderRadius: '24px',
              background: badgeBg,
            },
            children: {
              type: 'img',
              props: {
                src: logoDataUri,
                width: '64',
                height: '64',
              },
            },
          },
        },
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
      ].filter(Boolean),
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

async function fetchAsDataUri(assetUrl) {
  try {
    const res = await fetch(assetUrl);
    if (!res.ok) return null;
    const contentType = res.headers.get('content-type') || 'image/png';
    const buf = await res.arrayBuffer();
    const base64 = arrayBufferToBase64(buf);
    return `data:${contentType};base64,${base64}`;
  } catch {
    return null;
  }
}

function arrayBufferToBase64(buffer) {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}