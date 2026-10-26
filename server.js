const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = fs.existsSync(path.join(__dirname, 'public_html'))
  ? path.join(__dirname, 'public_html')
  : __dirname;

const server = http.createServer((req, res) => {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = decodeURIComponent(parsedUrl.pathname);

  // 1. PHP Execution (Central License API / Install)
  if (pathname.startsWith('/license-api') || pathname.startsWith('/install') || pathname.endsWith('.php')) {
    let scriptPath = path.join(PUBLIC_DIR, pathname.startsWith('/') ? pathname.slice(1) : pathname);
    if (fs.existsSync(scriptPath) && fs.statSync(scriptPath).isDirectory()) {
      scriptPath = path.join(scriptPath, 'index.php');
    }
    if (!fs.existsSync(scriptPath)) {
      scriptPath = path.join(PUBLIC_DIR, 'license-api', 'index.php');
    }

    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => {
      const body = Buffer.concat(chunks);
      const env = {
        ...process.env,
        REQUEST_METHOD: req.method,
        REQUEST_URI: req.url,
        SCRIPT_FILENAME: scriptPath,
        CONTENT_TYPE: req.headers['content-type'] || 'application/json',
        CONTENT_LENGTH: String(body.length),
        HTTP_AUTHORIZATION: req.headers['authorization'] || '',
        REMOTE_ADDR: req.socket.remoteAddress || '127.0.0.1',
      };

      const php = spawn('php', [scriptPath], { env });
      const phpOut = [];
      const phpErr = [];

      php.stdin.write(body);
      php.stdin.end();

      php.stdout.on('data', (d) => phpOut.push(d));
      php.stderr.on('data', (d) => phpErr.push(d));

      php.on('close', (code) => {
        const fullOutput = Buffer.concat(phpOut).toString('utf-8');
        const headerEnd = fullOutput.indexOf('\r\n\r\n');
        if (headerEnd !== -1) {
          const rawHeaders = fullOutput.substring(0, headerEnd).split('\r\n');
          const bodyOutput = fullOutput.substring(headerEnd + 4);
          let statusCode = 200;
          rawHeaders.forEach((h) => {
            const idx = h.indexOf(': ');
            if (idx !== -1) {
              const k = h.substring(0, idx);
              const v = h.substring(idx + 2);
              if (k.toLowerCase() === 'status') {
                statusCode = parseInt(v, 10) || 200;
              } else {
                res.setHeader(k, v);
              }
            }
          });
          res.writeHead(statusCode);
          res.end(bodyOutput);
        } else {
          res.writeHead(200, { 'Content-Type': 'application/json; charset=UTF-8' });
          res.end(fullOutput);
        }
      });
    });
    return;
  }

  // 2. Static File Serving
  let filePath = path.join(PUBLIC_DIR, pathname === '/' ? 'index.html' : pathname);
  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    filePath = path.join(PUBLIC_DIR, 'index.html');
  }

  const ext = path.extname(filePath).toLowerCase();
  const mimes = {
    '.html': 'text/html; charset=UTF-8',
    '.js': 'application/javascript; charset=UTF-8',
    '.css': 'text/css; charset=UTF-8',
    '.json': 'application/json; charset=UTF-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
  };

  const contentType = mimes[ext] || 'application/octet-stream';
  fs.readFile(filePath, (err, content) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not Found');
    } else {
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content);
    }
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Vendra Portal Node.js server listening on port ${PORT}`);
});
