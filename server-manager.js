/**
 * Lightweight on-demand process manager for the CodeCollab server.
 * Runs on port 5001. The portfolio frontend calls /start when a user
 * joins CodeCollab — this spawns the Socket.io server (port 5000)
 * if it isn't already running.
 */

const http = require('http');
const { spawn } = require('child_process');
const path = require('path');

const COLLAB_DIR = path.resolve(__dirname, '../projects/RealTimeCoding');
const PORT = 5001;

let serverProcess = null;

function isRunning() {
  return serverProcess !== null && !serverProcess.killed;
}

const manager = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Content-Type', 'application/json');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // GET /status — is the collab server running?
  if (req.method === 'GET' && req.url === '/status') {
    res.writeHead(200);
    res.end(JSON.stringify({ running: isRunning() }));
    return;
  }

  // POST /start — start the collab server if not already running
  if (req.method === 'POST' && req.url === '/start') {
    if (isRunning()) {
      res.writeHead(200);
      res.end(JSON.stringify({ status: 'already_running' }));
      return;
    }

    console.log('[manager] Starting CodeCollab server…');
    serverProcess = spawn('node', ['index.js'], {
      cwd: COLLAB_DIR,
      stdio: 'inherit',
    });

    serverProcess.on('error', (err) => {
      console.error('[manager] Failed to start server:', err.message);
      serverProcess = null;
    });

    serverProcess.on('exit', (code) => {
      console.log(`[manager] CodeCollab server exited (code ${code})`);
      serverProcess = null;
    });

    // Allow socket.io time to bind before telling the client to connect
    setTimeout(() => {
      res.writeHead(200);
      res.end(JSON.stringify({ status: 'started' }));
    }, 900);
    return;
  }

  res.writeHead(404);
  res.end(JSON.stringify({ error: 'not found' }));
});

manager.listen(PORT, () => {
  console.log(`[manager] Server manager ready on port ${PORT}`);
});
