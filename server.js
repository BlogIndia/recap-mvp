// Minimal multi-user sync server for the Recap meeting-notes MVP.
// No dependencies — plain Node http + fs. Run with: node server.js
const http = require('http');
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'meetings.json');
const PORT = process.env.PORT || 5175;

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(DATA_FILE)) fs.writeFileSync(DATA_FILE, '{}');

function readDB() {
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8') || '{}');
  } catch (err) {
    return {};
  }
}

function writeDB(db) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(db, null, 2));
}

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,PUT,POST,DELETE,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function send(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json', ...CORS_HEADERS });
  res.end(JSON.stringify(body));
}

const server = http.createServer((req, res) => {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, CORS_HEADERS);
    res.end();
    return;
  }

  const u = new URL(req.url, `http://${req.headers.host}`);
  const parts = u.pathname.split('/').filter(Boolean);

  if (parts[0] !== 'api' || parts[1] !== 'meetings') {
    send(res, 404, { error: 'Not found' });
    return;
  }

  const id = parts[2];

  if (req.method === 'GET' && !id) {
    const db = readDB();
    const list = Object.values(db).map(m => ({ id: m.id, title: m.title, createdAt: m.createdAt, updatedAt: m.updatedAt }));
    send(res, 200, list);
    return;
  }

  if (req.method === 'GET' && id) {
    const db = readDB();
    if (!db[id]) { send(res, 404, { error: 'Meeting not found' }); return; }
    send(res, 200, db[id]);
    return;
  }

  if (req.method === 'PUT' && id) {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const meeting = JSON.parse(body);
        meeting.id = id;
        meeting.updatedAt = Date.now();
        const db = readDB();
        db[id] = meeting;
        writeDB(db);
        send(res, 200, meeting);
      } catch (err) {
        send(res, 400, { error: 'Invalid JSON body' });
      }
    });
    return;
  }

  send(res, 405, { error: 'Method not allowed' });
});

server.listen(PORT, () => {
  console.log(`Recap sync server listening on http://localhost:${PORT}`);
});
