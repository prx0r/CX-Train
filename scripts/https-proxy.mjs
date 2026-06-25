import https from 'https';
import http from 'http';
import fs from 'fs';

const options = {
  key: fs.readFileSync('/tmp/cert.key'),
  cert: fs.readFileSync('/tmp/cert.crt'),
};

https.createServer(options, (req, res) => {
  const proxyReq = http.request({
    hostname: '127.0.0.1', port: 3001, path: req.url, method: req.method,
    headers: req.headers,
  }, proxyRes => {
    res.writeHead(proxyRes.statusCode, proxyRes.headers);
    proxyRes.pipe(res);
  });
  proxyReq.on('error', () => { res.writeHead(502); res.end('Proxy error'); });
  req.pipe(proxyReq);
}).listen(3000, '0.0.0.0', () => {
  console.log('HTTPS proxy :3000 → :3001');
});
