const TARGET_BASE = 'https://worldmonitor-eight-jet.vercel.app';

export default async function handler(req, res) {
  // Lấy path sau /api/proxy
  let path = req.url.replace(/^\/api\/proxy/, '') || '/';
  if (!path.startsWith('/')) path = '/' + path;

  const targetUrl = TARGET_BASE + path;

  try {
    const reqHeaders = {};
    const skip = new Set(['host','x-forwarded-for','x-vercel-id','x-vercel-deployment-url','x-vercel-forwarded-for','x-real-ip','cf-ray','cf-connecting-ip']);
    for (const [k, v] of Object.entries(req.headers)) {
      if (!skip.has(k.toLowerCase())) reqHeaders[k] = v;
    }
    reqHeaders['host'] = 'worldmonitor-eight-jet.vercel.app';
    reqHeaders['origin'] = TARGET_BASE;
    reqHeaders['referer'] = TARGET_BASE + '/';

    const fetchOptions = {
      method: req.method,
      headers: reqHeaders,
      redirect: 'follow',
    };
    if (!['GET', 'HEAD'].includes(req.method)) {
      fetchOptions.body = req.body;
    }

    const upstream = await fetch(targetUrl, fetchOptions);

    // Xóa headers chặn iframe
    const BLOCKED_HEADERS = new Set([
      'x-frame-options',
      'content-security-policy',
      'x-content-type-options',
      'transfer-encoding',
    ]);

    res.status(upstream.status);
    for (const [k, v] of upstream.headers.entries()) {
      if (!BLOCKED_HEADERS.has(k.toLowerCase())) {
        res.setHeader(k, v);
      }
    }
    res.setHeader('X-Frame-Options', 'ALLOWALL');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');

    const ct = upstream.headers.get('content-type') || '';

    if (ct.includes('text/html')) {
      let html = await upstream.text();

      // Base tag để relative URLs resolve đúng
      const baseTag = `<base href="${TARGET_BASE}/">`;
      html = html.replace(/<head([^>]*)>/i, `<head$1>${baseTag}`);

      // Inject script để fix navigation trong iframe
      const fixScript = `
<script>
(function(){
  // Override fetch để đi qua proxy nếu cần
  const _orig = window.fetch;
  window.fetch = function(url, opts) {
    return _orig.call(this, url, opts);
  };
})();
</script>`;
      html = html.replace('</head>', fixScript + '</head>');

      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.setHeader('Content-Length', Buffer.byteLength(html, 'utf-8').toString());
      res.end(html);
    } else {
      // Stream binary as-is
      const buf = await upstream.arrayBuffer();
      res.end(Buffer.from(buf));
    }
  } catch (err) {
    console.error('[proxy error]', err);
    res.status(502).json({ error: 'Proxy error', message: err.message, url: targetUrl });
  }
}
