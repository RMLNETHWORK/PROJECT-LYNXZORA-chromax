// functions/og.png.js
//
// Generates a 1200x630 preview image for a given color.
//
// Layout: fixed dark background (#1c1c1c) so text contrast never
// depends on the shared color. Left 40% holds branding + color
// details; right 60% shows the color itself as a rounded-rect swatch,
// so it reads as a designed card rather than a full-bleed color fill.

import { ImageResponse } from '@cloudflare/pages-plugin-vercel-og/api';

const HEX_RE = /^[0-9A-Fa-f]{6}$/;
const FALLBACK_HEX = '7C5CFC'; // ChromaX brand purple
const LOGO_PATH = '/LynxZora%20-%20ChromaX%20Logo.png'; // spaces URL-encoded

const CARD_BG = '#1c1c1c';
const TEXT_COLOR = '#FFFFFF';
const SUB_COLOR = 'rgba(255,255,255,0.55)';

const WIDTH = 1200;
const HEIGHT = 630;
const LEFT_WIDTH = Math.round(WIDTH * 0.4); // 480
const RIGHT_WIDTH = WIDTH - LEFT_WIDTH; // 720

export async function onRequest(context) {
  const url = new URL(context.request.url);
  const raw = (url.searchParams.get('c') || '').replace('#', '');
  const hex = HEX_RE.test(raw) ? raw.toUpperCase() : FALLBACK_HEX;
  const { r, g, b } = hexToRgb(hex);

  const logoDataUri = await fetchAsDataUri(`${url.origin}${LOGO_PATH}`);

  const el = {
    type: 'div',
    props: {
      style: {
        display: 'flex',
        width: `${WIDTH}px`,
        height: `${HEIGHT}px`,
        background: CARD_BG,
      },
      children: [
        // Left 40% — branding + color details
        {
          type: 'div',
          props: {
            style: {
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              width: `${LEFT_WIDTH}px`,
              height: `${HEIGHT}px`,
              padding: '70px',
            },
            children: [
              {
                type: 'div',
                props: {
                  style: { display: 'flex', alignItems: 'center' },
                  children: [
                    logoDataUri && {
                      type: 'img',
                      props: { src: logoDataUri, width: '40', height: '40' },
                    },
                    {
                      type: 'div',
                      props: {
                        style: {
                          fontSize: '26px',
                          letterSpacing: '3px',
                          color: SUB_COLOR,
                          marginLeft: logoDataUri ? '16px' : '0',
                        },
                        children: 'CHROMAX',
                      },
                    },
                  ].filter(Boolean),
                },
              },
              {
                type: 'div',
                props: {
                  style: { fontSize: '86px', fontWeight: 700, color: TEXT_COLOR, marginTop: '36px' },
                  children: `#${hex}`,
                },
              },
              {
                type: 'div',
                props: {
                  style: { fontSize: '28px', color: SUB_COLOR, marginTop: '18px' },
                  children: `rgb(${r}, ${g}, ${b})`,
                },
              },
            ],
          },
        },
        // Right 60% — color swatch as a rounded card
        {
          type: 'div',
          props: {
            style: {
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: `${RIGHT_WIDTH}px`,
              height: `${HEIGHT}px`,
              padding: '48px 48px 48px 0',
            },
            children: {
              type: 'div',
              props: {
                style: {
                  display: 'flex',
                  width: '100%',
                  height: '100%',
                  borderRadius: '40px',
                  background: `#${hex}`,
                },
              },
            },
          },
        },
      ],
    },
  };

  return new ImageResponse(el, {
    width: WIDTH,
    height: HEIGHT,
  });
}

function hexToRgb(hex) {
  return {
    r: parseInt(hex.slice(0, 2), 16),
    g: parseInt(hex.slice(2, 4), 16),
    b: parseInt(hex.slice(4, 6), 16),
  };
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