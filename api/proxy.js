const TARGET_BASE = 'https://worldmonitor-eight-jet.vercel.app';

module.exports = async function handler(req, res) {
  const qs = req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : '';
  const targetUrl = TARGET_BASE + '/' + qs;

  try {
    const reqHeaders = {};
    const skip = new Set([
      'host','x-forwarded-for','x-vercel-id','x-vercel-deployment-url',
      'x-vercel-forwarded-for','x-real-ip','cf-ray','cf-connecting-ip'
    ]);
    for (const [k, v] of Object.entries(req.headers)) {
      if (!skip.has(k.toLowerCase())) reqHeaders[k] = v;
    }
    reqHeaders['host'] = 'worldmonitor-eight-jet.vercel.app';
    reqHeaders['origin'] = TARGET_BASE;
    reqHeaders['referer'] = TARGET_BASE + '/';

    const upstream = await fetch(targetUrl, {
      method: req.method,
      headers: reqHeaders,
      redirect: 'follow',
    });

    const STRIP = new Set(['x-frame-options','content-security-policy','transfer-encoding','content-encoding']);
    res.status(upstream.status);
    for (const [k, v] of upstream.headers.entries()) {
      if (!STRIP.has(k.toLowerCase())) res.setHeader(k, v);
    }
    res.setHeader('X-Frame-Options', 'ALLOWALL');
    res.setHeader('Access-Control-Allow-Origin', '*');

    const ct = upstream.headers.get('content-type') || '';
    if (ct.includes('text/html')) {
      let html = await upstream.text();
      html = html.replace(/<head([^>]*)>/i, `<head$1><base href="${TARGET_BASE}/">`);
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.end(html);
    } else {
      const buf = await upstream.arrayBuffer();
      res.end(Buffer.from(buf));
    }
  } catch (err) {
    res.status(502).json({ error: 'Proxy error', message: err.message });
  }
};
