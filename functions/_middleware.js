// functions/_middleware.js
//
// Runs on every request served by Cloudflare Pages.
// If the request is for the HTML document AND has a ?c=HEX param,
// it rewrites the OG/Twitter meta tags, <title>, and canonical link
// in-flight (streaming, no extra fetch) so link previews on
// Slack/Discord/Twitter/etc. show the actual shared color.
//
// Your index.html, index.css, and index.js are NOT modified —
// this only touches the response bytes as they're served.

const HEX_RE = /^[0-9A-Fa-f]{6}$/;

export async function onRequest(context) {
  const { request, next } = context;
  const url = new URL(request.url);
  const response = await next();

  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('text/html')) {
    return response;
  }

  const rawParam = (url.searchParams.get('c') || '').replace('#', '');
  const hasColor = HEX_RE.test(rawParam);
  const hex = hasColor ? rawParam.toUpperCase() : null;

  // Sharing an actual color gets the generated card. Sharing the bare
  // homepage URL gets the app icon itself, straight from the static file.
  const ogImage = hasColor
    ? `${url.origin}/og.png?c=${hex}`
    : `${url.origin}/LynxZora%20-%20ChromaX%20Logo.png`;

  // Title/description/url/canonical only change when an actual color
  // is being shared — otherwise the homepage keeps its existing,
  // already-good static copy.
  let title = null;
  let description = null;
  let pageUrl = null;

  if (hasColor) {
    const { r, g, b } = hexToRgb(hex);
    title = `#${hex} — ChromaX Color Converter`;
    description = `View #${hex} (rgb(${r}, ${g}, ${b})) on ChromaX — see every format, its harmony palette, and how it looks to colorblind users.`;
    pageUrl = `${url.origin}${url.pathname}?c=${hex}`;
  }

  class AttrRewriter {
    element(el) {
      const prop = el.getAttribute('property');
      const name = el.getAttribute('name');

      if (prop === 'og:image' || name === 'twitter:image') {
        el.setAttribute('content', ogImage);
      }
      if (!hasColor) return;

      if (prop === 'og:title' || name === 'twitter:title') {
        el.setAttribute('content', title);
      }
      if (prop === 'og:description' || name === 'twitter:description') {
        el.setAttribute('content', description);
      }
      if (prop === 'og:url') {
        el.setAttribute('content', pageUrl);
      }
      if (name === 'description') {
        el.setAttribute('content', description);
      }
    }
  }

  class TitleRewriter {
    element(el) {
      if (hasColor) el.setInnerContent(title);
    }
  }

  class CanonicalRewriter {
    element(el) {
      if (hasColor) el.setAttribute('href', pageUrl);
    }
  }

  return new HTMLRewriter()
    .on('meta[property], meta[name]', new AttrRewriter())
    .on('title', new TitleRewriter())
    .on('link[rel="canonical"]', new CanonicalRewriter())
    .transform(response);
}

function hexToRgb(hex) {
  return {
    r: parseInt(hex.slice(0, 2), 16),
    g: parseInt(hex.slice(2, 4), 16),
    b: parseInt(hex.slice(4, 6), 16),
  };
}