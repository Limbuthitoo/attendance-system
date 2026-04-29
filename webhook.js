const http = require('http');
const crypto = require('crypto');
const { execFile } = require('child_process');

const PORT = 9000;
const SECRET = process.env.WEBHOOK_SECRET;
const DEPLOY_SCRIPT = '/home/ubuntu/attendance/attendance-system/deploy.sh';

if (!SECRET) {
  console.error('WEBHOOK_SECRET environment variable is required');
  process.exit(1);
}

let deploying = false;

function verifySignature(payload, signature) {
  if (!signature) return false;
  const hmac = crypto.createHmac('sha256', SECRET);
  const digest = 'sha256=' + hmac.update(payload).digest('hex');
  const digestBuf = Buffer.from(digest);
  const sigBuf = Buffer.from(signature);
  if (digestBuf.length !== sigBuf.length) return false;
  return crypto.timingSafeEqual(digestBuf, sigBuf);
}

const server = http.createServer((req, res) => {
  if (req.method !== 'POST' || req.url !== '/webhook') {
    res.writeHead(404);
    return res.end('Not found');
  }

  let body = '';
  req.on('data', chunk => { body += chunk; });
  req.on('end', () => {
    const signature = req.headers['x-hub-signature-256'];

    if (!verifySignature(body, signature)) {
      console.log(`[${new Date().toISOString()}] Invalid signature - rejected`);
      res.writeHead(401);
      return res.end('Invalid signature');
    }

    let payload;
    try {
      payload = JSON.parse(body);
    } catch {
      res.writeHead(400);
      return res.end('Invalid JSON');
    }

    // Only deploy on pushes to main
    if (payload.ref !== 'refs/heads/main') {
      res.writeHead(200);
      return res.end('Ignored: not main branch');
    }

    if (deploying) {
      res.writeHead(200);
      return res.end('Deploy already in progress');
    }

    deploying = true;
    console.log(`[${new Date().toISOString()}] Push to main detected, deploying...`);

    res.writeHead(200);
    res.end('Deploying...');

    execFile('bash', [DEPLOY_SCRIPT], { timeout: 120000 }, (err, stdout, stderr) => {
      deploying = false;
      if (err) {
        console.error(`[${new Date().toISOString()}] Deploy failed:`, err.message);
        console.error(stderr);
      } else {
        console.log(`[${new Date().toISOString()}] Deploy completed successfully`);
      }
    });
  });
});

// Process-level error handlers
process.on('uncaughtException', (err) => {
  console.error(`[${new Date().toISOString()}] Uncaught exception:`, err);
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  console.error(`[${new Date().toISOString()}] Unhandled rejection:`, reason);
  process.exit(1);
});

// Graceful shutdown
function shutdown(signal) {
  console.log(`[${new Date().toISOString()}] Received ${signal}, shutting down...`);
  server.close(() => {
    console.log(`[${new Date().toISOString()}] Server closed`);
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 5000);
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

server.listen(PORT, () => {
  console.log(`Webhook server listening on port ${PORT}`);
});
