// functions/og.png.js — TEMPORARY DEBUG VERSION
// Hardcoded, no query params, no template literals, no color logic.
// If this still renders blank, the bug is in workers-og/Satori itself
// in this environment, not in our dynamic code.

import { ImageResponse } from 'workers-og';

export async function onRequest() {
  const html = `
    <div style="display:flex; width:1200px; height:630px; background:#7C5CFC; align-items:center; justify-content:center;">
      <div style="color:white; font-size:80px;">TEST</div>
    </div>
  `;

  return new ImageResponse(html, {
    width: 1200,
    height: 630,
  });
}