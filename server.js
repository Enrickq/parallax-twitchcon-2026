'use strict';
/**
 * PARALLAX — tiny dependency-free Twitch-to-visuals engine.
 * Start: node server.js. No secret is needed in demo mode.
 */
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const tls = require('node:tls');
const crypto = require('node:crypto');

const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || '127.0.0.1';
const CONTROL_KEY = process.env.CONTROL_KEY || '';
const CHANNEL = (process.env.TWITCH_CHANNEL || '').replace(/^#/, '').trim().toLowerCase();
const BOT = (process.env.TWITCH_BOT_USERNAME || '').trim().toLowerCase();
const TOKEN = (process.env.TWITCH_OAUTH_TOKEN || '').replace(/^oauth:/i, '').trim();
const TWITCH_ENABLED = Boolean(CHANNEL && BOT && TOKEN);
const PUBLIC = path.join(__dirname, 'public');
const DATA_FILE = process.env.DATA_FILE || path.join(__dirname, '.parallax-data.json');
const PERSIST = require.main === module;
if (!['127.0.0.1', 'localhost', '::1'].includes(HOST) && !CONTROL_KEY) {
  console.error('Refusing publicly accessible director controls without CONTROL_KEY.');
  process.exit(1);
}

const themes = [
  { a: { name: 'AURORA', tagline: 'A world that learns to bloom', effect: 'Harmony grows' }, b: { name: 'SUPERNOVA', tagline: 'A world that dares to burn', effect: 'Entropy rises' } },
  { a: { name: 'ECHO', tagline: 'Preserve every memory', effect: 'Memory grows' }, b: { name: 'RIFT', tagline: 'Rewrite the impossible', effect: 'Chaos rises' } },
  { a: { name: 'ORIGIN', tagline: 'Begin again, together', effect: 'Harmony grows' }, b: { name: 'ECLIPSE', tagline: 'Embrace the unknown', effect: 'Entropy rises' } }
];
const limits = { maxRecent: 18, maxNames: 90, maxHistory: 12, maxSparks: 10 };
let voters = new Map();
let sparkAuthors = new Set();
let connections = new Set();
let twitchSocket = null;
let reconnectTimer = null;
let reconnectAttempt = 0;
let saveTimer = null;

const state = {
  version: 2,
  mode: TWITCH_ENABLED ? 'live' : 'demo',
  connected: false,
  channel: CHANNEL || 'your-channel',
  phase: 'idle',
  round: 1,
  endsAt: null,
  winner: null,
  votes: { a: 0, b: 0 },
  totalVotes: 0,
  uniqueViewers: 0,
  world: { harmony: 50, entropy: 50, memory: 0, words: 0, dna: 137 },
  history: [],
  participants: [],
  sparks: [],
  feed: [],
  lastImpact: null,
  theme: themes[0]
};

// Persist only accumulated world history, never credentials or chat logs.
if (PERSIST) {
  try {
    const previous = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    if (Number.isInteger(previous.round) && previous.round >= 1) state.round = previous.round;
    if (previous.world && Number.isFinite(previous.world.harmony) && Number.isFinite(previous.world.memory)) {
      state.world = { harmony: Math.max(5, Math.min(95, previous.world.harmony)), entropy: Math.max(5, Math.min(95, 100-previous.world.harmony)), memory: Math.max(0, previous.world.memory), words: Number.isInteger(previous.world.words)?Math.max(0,previous.world.words):0, dna: Number.isInteger(previous.world.dna) ? Math.max(0, Math.min(996, previous.world.dna)) : 137 };
    }
    if (Array.isArray(previous.history)) state.history = previous.history.slice(0, limits.maxHistory);
    if (Number.isInteger(previous.uniqueViewers)) state.uniqueViewers = previous.uniqueViewers;
    state.theme = themes[(state.round-1)%themes.length];
  } catch (e) { if (e.code !== 'ENOENT') console.error('Could not restore prior world:', e.message); }
}
function scheduleSave() {
  if (!PERSIST) return;
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    const stored = { round: state.round, world: state.world, history: state.history, uniqueViewers: state.uniqueViewers };
    const temporary = DATA_FILE + '.tmp';
    fs.writeFile(temporary, JSON.stringify(stored, null, 2), { mode: 0o600 }, err => {
      if (err) return console.error('Persistence failed:', err.message);
      fs.rename(temporary, DATA_FILE, err2 => { if (err2) console.error('Persistence rename failed:', err2.message); });
    });
  }, 600);
  saveTimer.unref();
}
function safeText(value, maxLen = 36) {
  return String(value ?? '').replace(/[\u0000-\u001F\u007F<>]/g, '').trim().slice(0, maxLen);
}
function cleanUsername(v) { return safeText(v, 25).replace(/[^a-z0-9_]/gi, '').toLowerCase(); }
function addFeed(kind, headline, detail = '', name = '') {
  state.feed.unshift({ id: crypto.randomUUID(), at: new Date().toISOString(), kind, headline: safeText(headline, 64), detail: safeText(detail, 125), name: cleanUsername(name) });
  state.feed = state.feed.slice(0, limits.maxRecent);
}
function snapshot() { return JSON.stringify(state); }
function send(res) {
  res.write(`event: state\ndata: ${snapshot()}\n\n`);
}
function publish() {
  for (const res of connections) {
    try { send(res); } catch { connections.delete(res); }
  }
}
function openRound(duration = 45) {
  if (state.phase === 'voting') return false;
  const seconds = [20, 30, 45, 60, 90].includes(Number(duration)) ? Number(duration) : 45;
  state.phase = 'voting';
  state.endsAt = Date.now() + seconds * 1000;
  state.votes = { a: 0, b: 0 };
  state.totalVotes = 0;
  state.participants = [];
  state.sparks = [];
  state.winner = null;
  state.lastImpact = null;
  state.theme = themes[(state.round - 1) % themes.length];
  voters = new Map();
  sparkAuthors = new Set();
  addFeed('system', 'THE TIMELINE HAS SPLIT', `${seconds}s to choose reality`);
  scheduleSave(); publish();
  return true;
}
function vote(name, branch, source = 'twitch') {
  if (source === 'demo' && state.mode !== 'demo') return false;
  if (state.phase !== 'voting' || (state.endsAt && Date.now() >= state.endsAt)) return false;
  const username = cleanUsername(name);
  if (!username || !['a', 'b'].includes(branch)) return false;
  if (voters.has(username)) return false; // One viewer, one vote per round.
  voters.set(username, branch);
  state.votes[branch]++;
  state.totalVotes++;
  state.uniqueViewers++;
  state.participants.unshift({ name: username, branch, id: crypto.randomUUID() });
  state.participants = state.participants.slice(0, limits.maxNames);
  addFeed('vote', `${username} changed the future`, state.theme[branch].name, username);
  scheduleSave(); publish();
  return true;
}
function spark(name, word, source = 'twitch') {
  if (source === 'demo' && state.mode !== 'demo') return false;
  if (state.phase !== 'voting' || (state.endsAt && Date.now() >= state.endsAt)) return false;
  const username = cleanUsername(name);
  const cleaned = safeText(word, 20).replace(/[^\p{L}\p{N} _'-]/gu, '').trim();
  if (!username || cleaned.length < 2) return false;
  // The public display is a bounded rolling buffer; authors remain deduplicated
  // even after their word scrolls out of it.
  if (sparkAuthors.has(username)) return false;
  sparkAuthors.add(username);
  state.sparks.unshift({ name: username, word: cleaned });
  state.sparks = state.sparks.slice(0, limits.maxSparks);
  addFeed('spark', `${username} planted a spark`, cleaned, username);
  scheduleSave(); publish();
  return true;
}
function projectFuture(before, branch, total, sparks) {
  const shift = Math.min(16, 5 + Math.round(total * 0.7));
  const harmony = Math.max(5, Math.min(95, before.harmony + (branch === 'a' ? shift : -shift)));
  const words = sparks.map(s => s.word.toLowerCase()).join('|');
  let fingerprint = (before.dna ?? 137) * 31 + total * 17 + (branch === 'a' ? 11 : 43);
  for (const ch of words) fingerprint = (fingerprint * 33 + ch.codePointAt(0)) % 997;
  return { harmony, entropy: 100 - harmony, memory: before.memory + total,
    words: before.words + sparks.length, dna: fingerprint % 997 };
}
function closeRound() {
  if (state.phase !== 'voting') return false;
  const a = state.votes.a, b = state.votes.b;
  // Fair, documented tie behavior: harmony wins ties, including zero votes.
  const winner = a >= b ? 'a' : 'b';
  const shift = Math.min(16, 5 + Math.round(state.totalVotes * 0.7));
  const before = { ...state.world };
  // Both branches start at the same world, using the same contributions. Only
  // the canonical winner is committed; the other remains a read-only what-if.
  const projectedA = projectFuture(before, 'a', state.totalVotes, state.sparks);
  const projectedB = projectFuture(before, 'b', state.totalVotes, state.sparks);
  const futures = {
    a: { branch: 'a', title: state.theme.a.name, ...projectedA },
    b: { branch: 'b', title: state.theme.b.name, ...projectedB }
  };
  state.world = winner === 'a' ? projectedA : projectedB;
  state.phase = 'reveal';
  state.endsAt = null;
  state.winner = winner;
  state.lastImpact = { branch: winner, shift, participants: state.totalVotes };
  const outcome = { round: state.round, title: state.theme[winner].name, winner, votes: { ...state.votes }, total: state.totalVotes, sparks: state.sparks.map(s => s.word), at: new Date().toISOString(), harmony: state.world.harmony, dna: state.world.dna, before, futures, theme: structuredClone(state.theme) };
  outcome.gene = crypto.createHash('sha256').update(JSON.stringify({ round: outcome.round, before, votes: outcome.votes, sparks: outcome.sparks, winner, futures })).digest('hex').slice(0, 12);
  state.history.unshift(outcome);
  state.history = state.history.slice(0, limits.maxHistory);
  addFeed('reveal', 'REALITY HAS COLLAPSED', `${outcome.title} is now canon`);
  state.round++;
  scheduleSave(); publish();
  return true;
}
function resetWorld() {
  state.phase = 'idle';
  state.round = 1;
  state.endsAt = null;
  state.winner = null;
  state.votes = { a: 0, b: 0 };
  state.totalVotes = 0;
  state.uniqueViewers = 0;
  state.world = { harmony: 50, entropy: 50, memory: 0, words: 0, dna: 137 };
  state.history = [];
  state.participants = [];
  state.sparks = [];
  state.lastImpact = null;
  state.theme = themes[0];
  voters = new Map();
  sparkAuthors = new Set();
  addFeed('system', 'UNIVERSE RESET', 'A blank canvas awaits');
  scheduleSave(); publish();
}
function handleChat(name, message) {
  const msg = safeText(message, 200).toLowerCase();
  if (/^!(aurora|echo|origin|a)(?:\s|$)/.test(msg) || /^!future\s+(a|aurora|echo|origin)(?:\s|$)/.test(msg)) return vote(name, 'a');
  if (/^!(supernova|rift|eclipse|b)(?:\s|$)/.test(msg) || /^!future\s+(b|supernova|rift|eclipse)(?:\s|$)/.test(msg)) return vote(name, 'b');
  const match = /^!spark\s+(.+)/.exec(msg);
  if (match) return spark(name, match[1]);
  return false;
}
function simulate(count = 16) {
  if (state.mode !== 'demo') return false;
  if (state.phase !== 'voting') openRound(45);
  const names = ['starwhisper', 'nebulafox', 'pixelghost', 'luna_404', 'cosmicbeans', 'glitchqueen', 'nova_waves', 'astrokit', 'mira_void', 'futurepilot', 'spectralink', 'bluecomet', 'velvetmoon', 'pulsarjane', 'dreambyte', 'orbitcraft', 'neonwisp', 'loopwalker', 'infinitex', 'littlequasar', 'celestial', 'raymondx', 'lunar_dusk', 'glowmode', 'pixelstorm', 'orbit_17', 'nightpulse', 'auroracat', 'hypernova', 'streamdream'];
  const words = ['HOPE', 'WONDER', 'TOGETHER', 'DREAM', 'COURAGE'];
  const n = Math.max(1, Math.min(40, Number(count) || 16));
  const base = voters.size;
  for (let i = 0; i < n; i++) {
    const name = names[(base + i + state.round) % names.length];
    vote(name, Math.random() < 0.53 ? 'a' : 'b', 'demo');
    if (i % 5 === 0) spark(name, words[i / 5 % words.length], 'demo');
  }
  publish();
  return true;
}
function sameOrigin(req) {
  const host = req.headers.host || '';
  let hostname;
  try { hostname = new URL(`http://${host}`).hostname; } catch { return false; }
  // Protect loopback controls against DNS rebinding as well as cross-site POSTs.
  if (['127.0.0.1', 'localhost', '::1'].includes(HOST) && !['127.0.0.1', 'localhost', '[::1]'].includes(hostname)) return false;
  if (req.headers['sec-fetch-site'] === 'cross-site') return false;
  if (!req.headers.origin) return true; // CLI clients need not send Origin.
  try {
    const origin = new URL(req.headers.origin);
    return ['http:', 'https:'].includes(origin.protocol) && origin.host === host;
  } catch { return false; }
}
function authorized(req) {
  if (CONTROL_KEY) {
    const supplied = req.headers['x-control-key'] || '';
    const a = Buffer.from(String(supplied)); const b = Buffer.from(CONTROL_KEY);
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  }
  const ip = req.socket.remoteAddress || '';
  return ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(ip);
}
function json(res, status, obj) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
  res.end(JSON.stringify(obj));
}
const types = { '.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.svg':'image/svg+xml', '.ico':'image/x-icon' };
const server = http.createServer((req, res) => {
  let url;
  try { url = new URL(req.url, 'http://localhost'); } catch { return json(res, 400, { error: 'Bad URL' }); }
  if (url.pathname === '/api/state' && req.method === 'GET') return json(res, 200, state);
  if (url.pathname === '/events' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type':'text/event-stream; charset=utf-8', 'Cache-Control':'no-cache, no-transform', 'Connection':'keep-alive', 'X-Accel-Buffering':'no' });
    connections.add(res);
    send(res);
    req.on('close', () => connections.delete(res));
    return;
  }
  if (url.pathname === '/api/director' && req.method === 'POST') {
    if (!sameOrigin(req)) return json(res, 403, { error: 'Director requests must come from this site.' });
    if (!authorized(req)) return json(res, 403, { error: 'Director authentication required. Enter CONTROL_KEY.' });
    if (!/^application\/json(?:\s*;|$)/i.test(req.headers['content-type'] || '')) return json(res, 415, { error: 'Use application/json.' });
    let bytes = 0, tooLarge = false;
    const chunks = [];
    req.on('data', chunk => {
      bytes += chunk.length;
      if (bytes > 4096) { if (!tooLarge) json(res, 413, { error: 'Director request too large.' }); tooLarge = true; return; }
      if (!tooLarge) chunks.push(chunk);
    });
    req.on('end', () => {
      if (tooLarge) return;
      try {
        const data = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
        if (!data || typeof data !== 'object' || Array.isArray(data)) return json(res, 400, { error: 'Expected a JSON object.' });
        const action = String(data.action || '');
        if (action === 'open') { if (!openRound(data.duration)) return json(res, 409, { error: 'A round is already open.' }); }
        else if (action === 'collapse') { if (!closeRound()) return json(res, 409, { error: 'No voting round is open.' }); }
        else if (action === 'simulate' && state.mode === 'demo') simulate(data.count);
        else if (action === 'reset') resetWorld();
        else if (action === 'vote' && state.mode === 'demo') handleChat(safeText(data.name, 25), `!${data.branch === 'b' ? 'b' : 'a'}`);
        else if (action === 'spark' && state.mode === 'demo') spark(safeText(data.name, 25), safeText(data.word, 20), 'demo');
        else return json(res, 400, { error:'Unknown action or demo-only command' });
        return json(res, 200, { ok:true, state });
      } catch { return json(res, 400, { error:'Invalid JSON' }); }
    });
    return;
  }
  if (req.method !== 'GET') return json(res, 405, { error:'Method not allowed' });
  const routes = { '/':'index.html', '/overlay':'overlay.html', '/how':'how.html' };
  const file = routes[url.pathname] || url.pathname.replace(/^\//, '');
  const full = path.resolve(PUBLIC, file);
  if (!full.startsWith(PUBLIC + path.sep)) return json(res, 403, { error:'Forbidden' });
  fs.stat(full, (err, stat) => {
    if (err || !stat.isFile()) return json(res, 404, { error:'Not found' });
    const headers = { 'Content-Type': `${types[path.extname(full)] || 'application/octet-stream'}; charset=utf-8`, 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy':'no-referrer', 'Cache-Control': 'no-store' };
    res.writeHead(200, headers);
    fs.createReadStream(full).pipe(res);
  });
});

function processTwitchLine(line, socket, channel = CHANNEL, bot = BOT) {
  if (line.startsWith('PING ')) { socket.write(line.replace(/^PING/, 'PONG') + '\r\n'); return; }
  const untagged = line.replace(/^@[^ ]+ /, '');
  const ownJoin = /^:([^! ]+)![^ ]+ JOIN :?#([^ ]+)$/i.exec(untagged);
  const roomState = /^:[^ ]+ ROOMSTATE #([^ ]+)/i.exec(untagged);
  const namesEnd = /^:[^ ]+ 366 [^ ]+ #([^ ]+)/i.exec(untagged);
  const joined = (ownJoin && ownJoin[1].toLowerCase() === bot && ownJoin[2].toLowerCase() === channel)
    || (roomState && roomState[1].toLowerCase() === channel)
    || (namesEnd && namesEnd[1].toLowerCase() === channel);
  if (joined && !state.connected) {
    state.connected = true; reconnectAttempt = 0;
    addFeed('system', 'TWITCH CONNECTED', `#${channel} chat is live`); publish();
  }
  if (/NOTICE.*(authentication failed|Improperly formatted auth|Login unsuccessful)/i.test(line)) {
    state.connected = false; addFeed('system', 'TWITCH AUTH FAILED', 'Check your username and OAuth token'); publish();
  }
  if (/^:[^ ]+ RECONNECT(?:\s|$)/i.test(untagged)) { socket.end(); return; }
  const message = /^:([^! ]+)![^ ]+ PRIVMSG #([^ ]+) :(.+)$/.exec(untagged);
  if (message && state.connected && message[2].toLowerCase() === channel) handleChat(message[1], message[3]);
}
function connectTwitch() {
  if (!TWITCH_ENABLED) return;
  if (twitchSocket && !twitchSocket.destroyed) twitchSocket.destroy();
  let buffer = '';
  const socket = tls.connect({ host:'irc.chat.twitch.tv', port:6697, servername:'irc.chat.twitch.tv', rejectUnauthorized:true }, () => {
    socket.write(`PASS oauth:${TOKEN}\r\nNICK ${BOT}\r\nCAP REQ :twitch.tv/tags twitch.tv/commands\r\nJOIN #${CHANNEL}\r\n`);
  });
  twitchSocket = socket;
  socket.setEncoding('utf8');
  socket.on('data', chunk => {
    buffer += chunk;
    const lines = buffer.split('\r\n'); buffer = lines.pop() || '';
    for (const line of lines) {
      processTwitchLine(line, socket);
    }
  });
  socket.on('error', err => { addFeed('system', 'TWITCH CONNECTION ERROR', err.code || 'Network error'); publish(); });
  socket.on('close', () => {
    if (twitchSocket !== socket) return;
    state.connected = false; publish();
    const delay = Math.min(45000, 1500 * 2 ** reconnectAttempt++);
    clearTimeout(reconnectTimer);
    reconnectTimer = setTimeout(connectTwitch, delay);
  });
}

const countdownTicker = setInterval(() => {
  if (state.phase === 'voting' && Date.now() >= state.endsAt) closeRound();
  else if (state.phase === 'voting') publish();
}, 1000);
const heartbeatTicker = setInterval(() => { for (const res of connections) { try { res.write(': ping\n\n'); } catch { connections.delete(res); } } }, 20000);
countdownTicker.unref(); heartbeatTicker.unref();
addFeed('system', TWITCH_ENABLED ? 'CONNECTING TO TWITCH' : 'DEMO UNIVERSE READY', TWITCH_ENABLED ? `Channel: #${CHANNEL}` : 'No credentials required');
if (require.main === module) {
  server.listen(PORT, HOST, () => {
    console.log(`\n  PARALLAX // THE BUTTERFLY EFFECT OF TWITCH\n  Studio:  http://${HOST}:${PORT}\n  Overlay: http://${HOST}:${PORT}/overlay\n  Mode:    ${TWITCH_ENABLED ? 'TWITCH LIVE' : 'DEMO'}\n`);
    connectTwitch();
  });
}
module.exports = { server, state, handleChat, cleanUsername, safeText, openRound, vote, spark, closeRound, resetWorld, simulate, projectFuture, processTwitchLine };
