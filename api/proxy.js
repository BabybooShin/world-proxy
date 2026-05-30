const TARGET = 'https://worldmonitor-eight-jet.vercel.app';

export default async function handler(req, res) {
  const path = req.url.replace(/^\/api\/proxy/, '') || '/';
  const targetUrl = TARGET + path;

  try {
    const headers = { ...req.headers };
    delete headers['host'];
    delete headers['x-forwarded-for'];
    delete headers['x-vercel-id'];
    headers['host'] = 'worldmonitor-eight-jet.vercel.app';
    headers['referer'] = TARGET + '/';
    headers['origin'] = TARGET;

    const fetchRes = await fetch(targetUrl, {
      method: req.method,
      headers,
      body: ['GET', 'HEAD'].includes(req.method) ? undefined : req.body,
      redirect: 'follow',
    });

    // Copy status
    res.status(fetchRes.status);

    // Copy headers nhưng XÓA các header chặn iframe
    fetchRes.headers.forEach((value, key) => {
      const lower = key.toLowerCase();
      if (
        lower === 'x-frame-options' ||
        lower === 'content-security-policy' ||
        lower === 'x-content-type-options' ||
        lower === 'transfer-encoding' ||
        lower === 'content-encoding'
      ) return;
      res.setHeader(key, value);
    });

    // Cho phép nhúng từ mọi nơi
    res.setHeader('X-Frame-Options', 'ALLOWALL');
    res.setHeader('Access-Control-Allow-Origin', '*');

    const contentType = fetchRes.headers.get('content-type') || '';

    if (contentType.includes('text/html')) {
      let html = await fetchRes.text();
      // Rewrite absolute URLs và relative paths về qua proxy
      html = html
        .replace(/(href|src|action)="\/(?!\/)/g, `$1="/api/proxy/`)
        .replace(/(href|src|action)='\/(?!\/)/g, `$1='/api/proxy/`)
        .replace(
          new RegExp(`(href|src|action)="${TARGET.replace(/\//g, '\\/')}`, 'g'),
          '$1="/api/proxy'
        );
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.send(html);
    } else {
      const buf = await fetchRes.arrayBuffer();
      res.send(Buffer.from(buf));
    }
  } catch (err) {
    console.error('Proxy error:', err);
    res.status(502).json({ error: 'Proxy error', detail: err.message });
  }
}
