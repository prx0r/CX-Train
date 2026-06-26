import { execFileSync } from 'child_process';
import fs from 'fs';
import https from 'https';
import httpProxy from 'http-proxy';

const listenHost = process.env.HTTPS_PROXY_HOST || '0.0.0.0';
const listenPort = Number(process.env.HTTPS_PROXY_PORT || 3000);
const targetHost = process.env.NEXT_HOST || '127.0.0.1';
const targetPort = Number(process.env.NEXT_PORT || 3001);
const certKeyPath = process.env.HTTPS_PROXY_KEY || '/tmp/cx-train-localhost.key';
const certPath = process.env.HTTPS_PROXY_CERT || '/tmp/cx-train-localhost.crt';
const publicHost = process.env.PUBLIC_HOST || process.env.PUBLIC_IP || '';

function ensureCertificate() {
  if (fs.existsSync(certKeyPath) && fs.existsSync(certPath)) return;

  const altNames = [
    'DNS:localhost',
    'IP:127.0.0.1',
    'IP:0.0.0.0',
    publicHost && (/^\d+\.\d+\.\d+\.\d+$/.test(publicHost) ? `IP:${publicHost}` : `DNS:${publicHost}`),
  ].filter(Boolean).join(',');

  execFileSync('openssl', [
    'req',
    '-x509',
    '-newkey',
    'rsa:2048',
    '-nodes',
    '-sha256',
    '-days',
    '365',
    '-keyout',
    certKeyPath,
    '-out',
    certPath,
    '-subj',
    '/CN=localhost',
    '-addext',
    `subjectAltName=${altNames}`,
  ], { stdio: 'ignore' });
}

ensureCertificate();

const proxy = httpProxy.createProxyServer({
  target: `http://${targetHost}:${targetPort}`,
  changeOrigin: true,
  ws: true,
  xfwd: true,
});

proxy.on('proxyReq', (proxyReq) => {
  proxyReq.setHeader('X-Forwarded-Proto', 'https');
  proxyReq.setHeader('X-Forwarded-Ssl', 'on');
});

proxy.on('error', (err, _req, res) => {
  console.error('[https-proxy]', err.message);
  if (res && !res.headersSent) {
    res.writeHead(502, { 'Content-Type': 'text/plain' });
  }
  res?.end('Proxy error');
});

const server = https.createServer({
  key: fs.readFileSync(certKeyPath),
  cert: fs.readFileSync(certPath),
}, (req, res) => {
  proxy.web(req, res);
});

server.on('upgrade', (req, socket, head) => {
  proxy.ws(req, socket, head);
});

server.listen(listenPort, listenHost, () => {
  console.log(`HTTPS proxy https://${listenHost}:${listenPort} -> http://${targetHost}:${targetPort}`);
  console.log(`Certificate: ${certPath}`);
});
