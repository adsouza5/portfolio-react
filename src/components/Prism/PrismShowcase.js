import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import './PrismShowcase.css';

// ── Prism crystal background ──────────────────────────────────
function seeded(seed) {
  let s = seed;
  return () => { s = Math.imul(s, 1664525) + 1013904223 | 0; return (s >>> 0) / 0xffffffff; };
}

const GEM_PALETTE = [
  { fill: 'rgba(23,126,137,',  stroke: 'rgba(26,172,190,' },
  { fill: 'rgba(192,132,252,', stroke: 'rgba(210,160,255,' },
  { fill: 'rgba(26,172,190,',  stroke: 'rgba(26,172,190,' },
];

const _r = seeded(71);
// size tiers: 6 large, 7 medium, 8 small
const SIZE_TIERS = [
  ...Array(6).fill({ wRange: [2.8, 4.2], hRange: [7.5, 14.0], opBase: 0.06, opRange: 0.08 }),
  ...Array(7).fill({ wRange: [1.4, 2.6], hRange: [4.0,  7.5], opBase: 0.09, opRange: 0.12 }),
  ...Array(8).fill({ wRange: [0.5, 1.3], hRange: [1.4,  4.0], opBase: 0.12, opRange: 0.16 }),
];
const CRYSTALS = SIZE_TIERS.map((tier) => {
  const cx  = _r() * 100;
  const cy  = _r() * 100;
  const w   = tier.wRange[0] + _r() * (tier.wRange[1] - tier.wRange[0]);
  const h   = tier.hRange[0] + _r() * (tier.hRange[1] - tier.hRange[0]);
  const rot = _r() * 50 - 25;
  const op  = tier.opBase + _r() * tier.opRange;
  const ci  = Math.floor(_r() * GEM_PALETTE.length);
  const dur = 10 + _r() * 14;
  const del = _r() * 10;
  return { cx, cy, w, h, rot, op, pal: GEM_PALETTE[ci], dur, del };
});

function rotatePt(x, y, cx, cy, rad) {
  const dx = x - cx, dy = y - cy;
  return [cx + dx * Math.cos(rad) - dy * Math.sin(rad),
          cy + dx * Math.sin(rad) + dy * Math.cos(rad)];
}

// ── Ray-crystal intersection geometry ─────────────────────────
// Precompute the 4 edges of each crystal diamond
const CRYSTAL_EDGES = CRYSTALS.map(c => {
  const rad = (c.rot * Math.PI) / 180;
  const T = rotatePt(c.cx,       c.cy - c.h, c.cx, c.cy, rad);
  const R = rotatePt(c.cx + c.w, c.cy,       c.cx, c.cy, rad);
  const B = rotatePt(c.cx,       c.cy + c.h, c.cx, c.cy, rad);
  const L = rotatePt(c.cx - c.w, c.cy,       c.cx, c.cy, rad);
  return [[T, R], [R, B], [B, L], [L, T]];
});

function raySegHit(px, py, dx, dy, [ax, ay], [bx, by], minT = 0.3) {
  const ex = bx - ax, ey = by - ay;
  const denom = dx * ey - dy * ex;
  if (Math.abs(denom) < 1e-8) return null;
  const t = ((ax - px) * ey - (ay - py) * ex) / denom;
  const u = ((ax - px) * dy - (ay - py) * dx) / denom;
  if (t > minT && u >= 0 && u <= 1) return { t, x: px + t * dx, y: py + t * dy };
  return null;
}

function buildLaserPath(startY, slope) {
  const pts = [[-2, startY]];
  let px = -2, py = startY, dx = 1, dy = slope;

  for (let pass = 0; pass < 3; pass++) {
    // 1. Find entry: nearest crystal edge hit along current ray
    let entry = null, entryCI = -1;
    for (let ci = 0; ci < CRYSTAL_EDGES.length; ci++) {
      for (const [A, B] of CRYSTAL_EDGES[ci]) {
        const hit = raySegHit(px, py, dx, dy, A, B);
        if (hit && hit.x > 0 && hit.x < 101 && hit.y > -5 && hit.y < 105) {
          if (!entry || hit.t < entry.t) { entry = hit; entryCI = ci; }
        }
      }
    }
    if (!entry || entryCI < 0) break;

    // 2. Find exit: continue same direction from just inside crystal
    let exit = null;
    for (const [A, B] of CRYSTAL_EDGES[entryCI]) {
      const hit = raySegHit(entry.x, entry.y, dx, dy, A, B, 0.01);
      if (hit && (!exit || hit.t < exit.t)) exit = hit;
    }
    const deflectAt = exit ?? entry;

    // 3. Bend at exit face — rotate direction to simulate refraction
    //    Direction depends on whether ray hit above or below crystal midpoint
    const c = CRYSTALS[entryCI];
    const bendDir   = entry.y < c.cy ? -1 : 1;
    const bendAngle = bendDir * (Math.PI / 5.5 + Math.abs(c.rot) * 0.008);
    const cos = Math.cos(bendAngle), sin = Math.sin(bendAngle);
    const newDx = dx * cos - dy * sin;
    const newDy = dx * sin + dy * cos;

    if (newDx < 0.15) break; // reject if ray would go backwards or near-vertical

    pts.push([deflectAt.x, deflectAt.y]);
    [px, py, dx, dy] = [deflectAt.x, deflectAt.y, newDx, newDy];
  }

  // Extend to right edge
  const exitT = (102 - px) / (Math.abs(dx) > 0.001 ? dx : 0.001);
  pts.push([102, py + exitT * dy]);
  return pts;
}

// 8 dots, 2s stagger → ~2 crossing simultaneously at any moment
const _lr = seeded(333);
const LASER_COLORS = [
  'rgba(26,172,190,',
  'rgba(192,132,252,',
  'rgba(23,126,137,',
  'rgba(26,172,190,',
  'rgba(210,160,255,',
  'rgba(26,172,190,',
  'rgba(192,132,252,',
  'rgba(23,126,137,',
];
const LASERS = Array.from({ length: 8 }, (_, i) => {
  // Stratified: divide left edge into 8 bands, pick randomly within each
  const band = 92 / 8;
  const startY = 4 + i * band + _lr() * band;
  const slope  = (_lr() - 0.4) * 0.5;
  const pts    = buildLaserPath(startY, slope);
  return { pts, color: LASER_COLORS[i], dur: 16, del: i * 2 };
});

function PrismBg() {
  return (
    <svg className="prism-bg" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <defs>
        <filter id="laser-glow" x="-120%" y="-120%" width="340%" height="340%">
          <feGaussianBlur stdDeviation="0.18" result="blur"/>
          <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
      </defs>
      {/* Dots with trails — rendered below crystals */}
      {LASERS.map((laser, i) => {
        const d = `M ${laser.pts.map(p => p.join(',')).join(' L ')}`;
        const anim = (name) => `${name} ${laser.dur}s linear ${laser.del}s infinite`;
        return (
          <g key={`l${i}`}>
            {/* Trail: 8-unit dash lagging 9 units behind the dot */}
            <path d={d} fill="none"
              stroke={`${laser.color}0.50)`} strokeWidth="0.13" strokeLinecap="round"
              filter="url(#laser-glow)"
              style={{ strokeDasharray: '8 292', animation: anim('laser-trail') }}
            />
            {/* Dot: 1-unit dash + round linecap = tiny glowing orb */}
            <path d={d} fill="none"
              stroke={`${laser.color}0.90)`} strokeWidth="0.22" strokeLinecap="round"
              filter="url(#laser-glow)"
              style={{ strokeDasharray: '1 299', animation: anim('laser-dot') }}
            />
          </g>
        );
      })}
      {CRYSTALS.map((c, i) => {
        const rad = (c.rot * Math.PI) / 180;
        // Diamond (rhombus): top, right, bottom, left
        const [tx, ty] = rotatePt(c.cx,       c.cy - c.h, c.cx, c.cy, rad);
        const [rx, ry] = rotatePt(c.cx + c.w, c.cy,       c.cx, c.cy, rad);
        const [bx, by] = rotatePt(c.cx,       c.cy + c.h, c.cx, c.cy, rad);
        const [lx, ly] = rotatePt(c.cx - c.w, c.cy,       c.cx, c.cy, rad);
        const pts = `${tx},${ty} ${rx},${ry} ${bx},${by} ${lx},${ly}`;
        const { fill, stroke } = c.pal;
        return (
          <g key={i} style={{ animation: `crystal-breathe ${c.dur}s ease-in-out ${c.del}s infinite, crystal-drift ${(c.dur * 1.7).toFixed(1)}s ease-in-out ${(c.del * 0.6).toFixed(1)}s infinite` }}>
            <polygon
              points={pts}
              fill={`${fill}${c.op * 0.35})`}
              stroke={`${stroke}${c.op * 1.6})`}
              strokeWidth="0.18"
            />
            {/* Horizontal girdle facet line */}
            <line
              x1={lx} y1={ly} x2={rx} y2={ry}
              stroke={`${stroke}${c.op * 0.9})`}
              strokeWidth="0.1"
            />
          </g>
        );
      })}
    </svg>
  );
}

// ── API config ────────────────────────────────────────────────
const PRISM_API = 'https://prism-api-495407544511.us-central1.run.app';
const PRISM_WS  = 'wss://prism-api-495407544511.us-central1.run.app/admin/ws';

const CLIENTS = [
  { id: 'demo-web',     name: 'demo-web',     key: 'key_demo_web_123', displayKey: 'pk_live_wZ3x••••••9mQ2', limit: 60,  used: 0 },
  { id: 'mobile-app',   name: 'mobile-app',   key: 'key_mobile_456',   displayKey: 'pk_live_aR7k••••••4nJ1', limit: 30,  used: 0 },
  { id: 'data-service', name: 'data-service', key: 'key_data_789',     displayKey: 'pk_live_bT9p••••••6vK8', limit: 120, used: 0 },
];

// ── Custom select ─────────────────────────────────────────────
function PrismSelect({ options, value, onChange }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos]   = useState({ top: 0, left: 0, width: 0 });
  const btnRef = useRef(null);
  const wrapRef = useRef(null);

  useEffect(() => {
    const h = e => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  function toggle() {
    if (!open && btnRef.current) {
      const r = btnRef.current.getBoundingClientRect();
      const menuH = options.length * 34;
      const top = window.innerHeight - r.bottom >= menuH + 8 ? r.bottom + 4 : r.top - menuH - 4;
      setPos({ top, left: r.left, width: Math.max(r.width, 140) });
    }
    setOpen(o => !o);
  }

  const label = options.find(o => o.value === value)?.label ?? value;
  return (
    <div className="prism-select-wrap" ref={wrapRef}>
      <button ref={btnRef} className={`prism-select-btn${open ? ' open' : ''}`} onClick={toggle} type="button">
        <span>{label}</span>
        <span style={{ fontSize: 7, color: 'rgba(23,126,137,0.7)' }}>{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div className="prism-select-menu" style={{ position: 'fixed', top: pos.top, left: pos.left, minWidth: pos.width }}>
          {options.map(o => (
            <button key={o.value} className={`prism-select-item${value === o.value ? ' active' : ''}`}
              onClick={() => { onChange(o.value); setOpen(false); }}>{o.label}</button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────
export default function PrismShowcase() {
  const navigate = useNavigate();

  const [feed, setFeed]       = useState([]);
  const [stats, setStats]     = useState({ total: 0, authed: 0, limited: 0, avgLat: 0 });
  const [clients, setClients] = useState(CLIENTS);
  const [testClient, setTestClient] = useState('demo-web');
  const [testUsed, setTestUsed]     = useState(0);
  const [testResp, setTestResp]     = useState(null);
  const [firing, setFiring]         = useState(false);
  const [cooldown, setCooldown]     = useState(0);
  const [jwtVisible, setJwtVisible] = useState(false);
  const [jwtParts, setJwtParts]     = useState(null);
  const [jwtLoading, setJwtLoading] = useState(false);
  const cooldownRef = useRef(null);
  const tokenCache  = useRef({});

  // ── Real WebSocket — live metrics + traffic feed ──────────────
  useEffect(() => {
    let ws, reconnectTimer;
    function connect() {
      ws = new WebSocket(PRISM_WS);
      ws.onmessage = (e) => {
        try {
          const data = JSON.parse(e.data);
          if (data.metrics) {
            setStats({
              total:   data.metrics.total_requests  || 0,
              authed:  data.metrics.authed_requests || 0,
              limited: data.metrics.rate_limited    || 0,
              avgLat:  Math.round(data.metrics.avg_latency_ms || 0),
            });
          }
          if (data.event) {
            const ev = data.event;
            const cls = ev.status === 200 ? 'ok' : ev.status === 429 ? 'rate' : 'auth';
            setFeed(prev => [...prev.slice(-24), {
              ts: ev.timestamp, method: ev.method,
              path: ev.path || '/api/anything',
              client: ev.client_id,
              status: { code: String(ev.status), cls },
              lat: ev.latency_ms,
            }]);
            setClients(prev => prev.map(c =>
              c.id === ev.client_id ? { ...c, used: Math.min(c.used + 1, c.limit) } : c
            ));
          }
        } catch (_) {}
      };
      ws.onclose = () => { reconnectTimer = setTimeout(connect, 3000); };
    }
    connect();
    return () => { clearTimeout(reconnectTimer); ws && ws.close(); };
  }, []);

  const activeClient = CLIENTS.find(c => c.id === testClient);
  const testLimit    = activeClient?.limit ?? 60;

  // ── Real token fetch (cached per client) ─────────────────────
  const getToken = useCallback(async (clientId) => {
    if (tokenCache.current[clientId]) return tokenCache.current[clientId];
    const client = CLIENTS.find(c => c.id === clientId);
    const res = await fetch(`${PRISM_API}/auth/token`, { headers: { 'X-API-Key': client.key } });
    const { token } = await res.json();
    tokenCache.current[clientId] = token;
    return token;
  }, []);

  // ── Real rate limit tester ────────────────────────────────────
  const fireRequest = useCallback(async () => {
    if (firing || cooldown > 0) return;
    setFiring(true);
    try {
      const token = await getToken(testClient);
      const res   = await fetch(`${PRISM_API}/api/anything`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      setTestUsed(prev => {
        const next = prev + 1;
        if (res.status === 429) {
          setTestResp({ cls: 'rate', msg: `429 Too Many Requests — rate limit exceeded (${testLimit} req/min). Retry-After: 60s` });
          setCooldown(8);
          const tick = setInterval(() => {
            setCooldown(c => {
              if (c <= 1) { clearInterval(tick); setTestUsed(0); tokenCache.current = {}; return 0; }
              return c - 1;
            });
          }, 1000);
          cooldownRef.current = tick;
        } else {
          setTestResp({ cls: 'ok', msg: `200 OK — ${activeClient?.name} · ${testLimit - next} requests remaining` });
        }
        return next;
      });
    } catch (err) {
      console.error('Prism fireRequest error:', err);
      setTestResp({ cls: 'auth', msg: `Error: ${err.message || err}` });
    } finally {
      setFiring(false);
    }
  }, [firing, cooldown, testClient, testLimit, activeClient, getToken]);

  // ── Real JWT issue ────────────────────────────────────────────
  const issueToken = useCallback(async () => {
    setJwtLoading(true);
    try {
      const res   = await fetch(`${PRISM_API}/auth/token`, { headers: { 'X-API-Key': 'key_demo_web_123' } });
      const data  = await res.json();
      const [h, p, s] = data.token.split('.');
      const header  = JSON.parse(atob(h));
      const payload = JSON.parse(atob(p));
      setJwtParts({ h, p, s, header, payload });
      setJwtVisible(true);
    } catch (_) {} finally { setJwtLoading(false); }
  }, []);

  function resetTest() {
    clearInterval(cooldownRef.current);
    tokenCache.current = {};
    setTestUsed(0); setTestResp(null); setCooldown(0); setFiring(false);
  }

  const quotePct = Math.min(100, Math.round((testUsed / testLimit) * 100));
  const quoteColor = quotePct < 50 ? '#34d399' : quotePct < 80 ? '#fbbf24' : '#f87171';

  return (
    <div className="prism-root">
      <PrismBg />

      <button
        className="prism-back-btn"
        onClick={() => navigate('/', { state: { scrollTo: 'projects' } })}
        onMouseEnter={e => { e.currentTarget.style.color='#E8E8E8'; e.currentTarget.style.borderColor='#177E89'; e.currentTarget.style.boxShadow='0 0 20px rgba(23,126,137,0.35)'; }}
        onMouseLeave={e => { e.currentTarget.style.color=''; e.currentTarget.style.borderColor=''; e.currentTarget.style.boxShadow=''; }}
      >← Timeline</button>

      <div className="prism-inner">

        {/* ── Hero ── */}
        <header className="prism-header">
          <div className="prism-logo-row">
            <svg className="prism-logomark" viewBox="0 0 22 20" fill="none" aria-hidden="true">
              <polygon points="11,2 21,18 1,18" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round"/>
              <line x1="11" y1="7" x2="7.5" y2="18" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" opacity="0.5"/>
              <line x1="11" y1="7" x2="14.5" y2="18" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" opacity="0.5"/>
            </svg>
            <span className="prism-wordmark">PRISM</span>
          </div>
          <p className="prism-tagline">API Gateway</p>
          <div className="prism-header-pills">
            {['Go', 'JWT Auth', 'Rate Limiting', 'Reverse Proxy', 'WebSocket', 'Cloud Run'].map(t => (
              <span key={t} className="prism-header-pill">{t}</span>
            ))}
          </div>
        </header>
        <p className="prism-subtitle">
          Production API gateway written in Go — JWT authentication, per-client sliding-window
          rate limiting, and intelligent request routing, all observable through a live traffic dashboard.
        </p>

        {/* ── Live Stats ── */}
        <div className="prism-card">
          <div className="prism-card-title">Gateway Metrics</div>
          <p className="prism-card-desc">Every request to your API flows through Prism. These counters update live as the gateway processes traffic in real time.</p>
          <div className="prism-stats">
            <div className="prism-stat">
              <span className="prism-stat-label">Total Requests</span>
              <span className="prism-stat-value">{stats.total.toLocaleString()}</span>
              <span className="prism-stat-sub">this session</span>
            </div>
            <div className="prism-stat">
              <span className="prism-stat-label">Authenticated</span>
              <span className="prism-stat-value">{Math.round((stats.authed / stats.total) * 100)}%</span>
              <span className="prism-stat-sub">valid JWT</span>
            </div>
            <div className="prism-stat">
              <span className="prism-stat-label">Rate Limited</span>
              <span className="prism-stat-value warn">{stats.limited}</span>
              <span className="prism-stat-sub">429 responses</span>
            </div>
            <div className="prism-stat">
              <span className="prism-stat-label">Avg Latency</span>
              <span className="prism-stat-value">{stats.avgLat}<span style={{ fontSize: 13 }}>ms</span></span>
              <span className="prism-stat-sub">proxy overhead</span>
            </div>
          </div>
        </div>

        {/* ── Architecture ── */}
        <div className="prism-card">
          <div className="prism-card-title">Architecture</div>
          <p className="prism-card-desc">Prism sits between your clients and your services — every request is checked for a valid identity and a fair usage quota before it reaches your code.</p>
          <div className="prism-arch">
            <div className="prism-arch-node">
              <div className="prism-arch-box">Client</div>
              <div className="prism-arch-label">browser / curl</div>
            </div>
            <div className="prism-arch-arrow">→</div>
            <div className="prism-arch-node">
              <div className="prism-arch-box highlight">Prism Gateway</div>
              <div className="prism-arch-middleware">
                <span className="prism-arch-chip auth">JWT Auth</span>
                <span className="prism-arch-chip ratelimit">Rate Limit</span>
                <span className="prism-arch-chip router">Router</span>
              </div>
            </div>
            <div className="prism-arch-arrow">→</div>
            <div className="prism-arch-node">
              <div className="prism-arch-box">Upstream</div>
              <div className="prism-arch-label">any HTTP service</div>
            </div>
            <div style={{ width: '100%', height: 1, background: 'transparent', margin: '10px 0' }} />
            <div className="prism-arch-node" style={{ marginTop: 0 }}>
              <div className="prism-arch-box" style={{ borderColor: 'rgba(192,132,252,0.35)', color: '#c084fc' }}>Admin API</div>
              <div className="prism-arch-label">WebSocket metrics</div>
            </div>
            <div className="prism-arch-arrow" style={{ color: 'rgba(192,132,252,0.45)' }}>→</div>
            <div className="prism-arch-node">
              <div className="prism-arch-box" style={{ borderColor: 'rgba(192,132,252,0.35)', color: '#c084fc' }}>This Dashboard</div>
              <div className="prism-arch-label">React + WebSocket</div>
            </div>
          </div>
        </div>

        {/* ── Live Traffic Feed ── */}
        <div className="prism-card">
          <div className="prism-card-title">Live Traffic</div>
          <p className="prism-card-desc">A real-time log of every request hitting the gateway. <span style={{color:'#34d399'}}>200</span> = passed through, <span style={{color:'#fbbf24'}}>429</span> = rate limit hit, <span style={{color:'#f87171'}}>401</span> = bad or missing token.</p>
          <div className="prism-feed">
            {[...feed].reverse().map((row, i) => (
              <div key={i} className="prism-feed-row">
                <span className="prism-feed-ts">{row.ts}</span>
                <span className="prism-feed-method">{row.method}</span>
                <span className="prism-feed-path">{row.path}</span>
                <span className="prism-feed-client">{row.client}</span>
                <span className={`prism-status ${row.status.cls}`}>{row.status.code}</span>
                <span className="prism-feed-lat">{row.lat}ms</span>
              </div>
            ))}
          </div>
        </div>

        {/* ── Client Registry ── */}
        <div className="prism-card">
          <div className="prism-card-title">Client Registry</div>
          <p className="prism-card-desc">Each API consumer gets a unique key and a per-minute request quota. Prism tracks usage live — the bar turns red when a client is close to being cut off.</p>
          <div className="prism-clients">
            {clients.map(c => {
              const pct = Math.min(100, Math.round((c.used / c.limit) * 100));
              const barCls = pct < 50 ? 'low' : pct < 80 ? 'medium' : 'high';
              return (
                <div key={c.id} className="prism-client-row">
                  <span className="prism-client-name">{c.name}</span>
                  <span className="prism-client-key">{c.displayKey}</span>
                  <div className="prism-rate-bar-wrap">
                    <div className={`prism-rate-bar ${barCls}`} style={{ width: `${pct}%` }} />
                  </div>
                  <span className="prism-client-pct">{pct}%</span>
                  <span className="prism-client-limit" style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: 'rgba(232,232,232,0.35)', whiteSpace: 'nowrap' }}>
                    {c.used}/{c.limit} rpm
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Rate Limit Tester ── */}
        <div className="prism-card">
          <div className="prism-card-title">Rate Limit Tester</div>
          <p className="prism-card-desc">Try it yourself — pick a client and fire requests until the gateway blocks you. Once the limit is hit, Prism enforces a cooldown before that client can send again.</p>
          <div className="prism-tester">
            <div className="prism-tester-row">
              <PrismSelect
                value={testClient}
                onChange={id => { setTestClient(id); resetTest(); }}
                options={CLIENTS.map(c => ({ value: c.id, label: `${c.name} (${c.limit} rpm)` }))}
              />
              <button
                className="prism-btn prism-btn-primary"
                onClick={fireRequest}
                disabled={firing || cooldown > 0}
              >
                {cooldown > 0 ? `Reset in ${cooldown}s` : firing ? 'Sending…' : 'Send Request'}
              </button>
              {testUsed > 0 && (
                <button className="prism-btn prism-btn-danger" onClick={resetTest}>Reset</button>
              )}
            </div>
            <div className="prism-quota">
              <span className="prism-quota-label">Quota</span>
              <div className="prism-quota-track">
                <div className="prism-quota-fill" style={{ width: `${quotePct}%`, background: quoteColor }} />
              </div>
              <span className="prism-quota-count">{testUsed} / {testLimit} requests</span>
            </div>
            {testResp && (
              <div className={`prism-response ${testResp.cls}`}>{testResp.msg}</div>
            )}
          </div>
        </div>

        {/* ── JWT Demo ── */}
        <div className="prism-card">
          <div className="prism-card-title">JWT Auth Token</div>
          <p className="prism-card-desc">Every request must carry a signed token proving who it is. Click below to issue one and see it decoded — <span style={{color:'#f87171'}}>header</span> (algorithm), <span style={{color:'#fbbf24'}}>payload</span> (identity &amp; expiry), <span style={{color:'#34d399'}}>signature</span> (tamper-proof seal).</p>
          {!jwtVisible ? (
            <button className="prism-btn prism-btn-primary" onClick={issueToken} disabled={jwtLoading}>
              {jwtLoading ? 'Issuing…' : 'Issue Token'}
            </button>
          ) : jwtParts && (
            <>
              <div className="prism-jwt-parts">
                <span className="prism-jwt-header">{jwtParts.h}</span>
                <span className="prism-jwt-dot">.</span>
                <span className="prism-jwt-payload">{jwtParts.p}</span>
                <span className="prism-jwt-dot">.</span>
                <span className="prism-jwt-sig">{jwtParts.s}</span>
              </div>
              <div className="prism-jwt-decoded">
                <div className="prism-jwt-box">
                  <div className="prism-jwt-box-label" style={{ color: 'rgba(248,113,113,0.6)' }}>Header</div>
                  {JSON.stringify(jwtParts.header, null, 2)}
                </div>
                <div className="prism-jwt-box">
                  <div className="prism-jwt-box-label" style={{ color: 'rgba(251,191,36,0.6)' }}>Payload</div>
                  {JSON.stringify(jwtParts.payload, null, 2)}
                </div>
              </div>
              <div style={{ marginTop: 10, fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: 'rgba(52,211,153,0.7)' }}>
                ✓ Signature verified · expires in 24h · HMAC-SHA256
              </div>
            </>
          )}
        </div>

      </div>
    </div>
  );
}
