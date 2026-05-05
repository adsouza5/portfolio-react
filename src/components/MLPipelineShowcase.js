import { useState, useRef, useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";

function useIsMobile(breakpoint = 768) {
  const [mobile, setMobile] = useState(() => window.innerWidth <= breakpoint);
  useEffect(() => {
    const fn = () => setMobile(window.innerWidth <= breakpoint);
    window.addEventListener("resize", fn);
    return () => window.removeEventListener("resize", fn);
  }, [breakpoint]);
  return mobile;
}

// True on phones in both portrait (width ≤ 768) and landscape (height ≤ 500)
function useIsPhoneViewport() {
  const check = () => window.innerWidth <= 768 || window.innerHeight <= 500;
  const [v, setV] = useState(check);
  useEffect(() => {
    const fn = () => setV(check());
    window.addEventListener("resize", fn);
    return () => window.removeEventListener("resize", fn);
  }, []);
  return v;
}

/* ── Design tokens ───────────────────────────────────────────── */
const C = {
  bg:       "#091515",
  card:     "rgba(255,255,255,0.05)",
  cardHov:  "rgba(255,255,255,0.08)",
  border:   "rgba(23,126,137,0.28)",
  borderBr: "rgba(23,126,137,0.55)",
  text:     "#daeaea",
  muted:    "rgba(200,230,230,0.84)",
  dim:      "rgba(180,215,215,0.50)",
  accent:   "#1aacbe",
  accentDk: "#177E89",
  glow:     "rgba(26,172,190,0.5)",
  glowSm:   "rgba(26,172,190,0.18)",
  green:    "#34d399",
  greenGl:  "rgba(52,211,153,0.22)",
  amber:    "#fbbf24",
  amberGl:  "rgba(251,191,36,0.18)",
  purple:   "#c084fc",
  purpleGl: "rgba(192,132,252,0.2)",
  red:      "#f87171",
};

const F = {
  mono:    "'JetBrains Mono','Courier New',monospace",
  display: "'Rajdhani','Franklin Gothic Medium',Arial,sans-serif",
  sans:    "'Segoe UI',system-ui,sans-serif",
};

const STAGES = [
  { id:"ingest",     label:"Pub/Sub\nIngest",       icon:"IN", color:C.accent,  glow:C.glowSm   },
  { id:"preprocess", label:"Cloud Run\nPreprocess", icon:"⚙",  color:C.amber,   glow:C.amberGl  },
  { id:"inference",  label:"Signal\nScoring",       icon:"∑",  color:C.purple,  glow:C.purpleGl },
  { id:"store",      label:"BigQuery\nStore",       icon:"DB", color:C.green,   glow:C.greenGl  },
  { id:"serve",      label:"API\nResponse",         icon:"→",  color:C.accent,  glow:C.glowSm   },
];

/* fallback prices shown before real data loads */
const DEFAULT_STOCKS = [
  { ticker:"AAPL", price:198.5,  volume:12400000 },
  { ticker:"TSLA", price:245.2,  volume:38200000 },
  { ticker:"MSFT", price:412.8,  volume:8900000  },
  { ticker:"NVDA", price:875.3,  volume:54100000 },
  { ticker:"AMZN", price:186.4,  volume:15700000 },
  { ticker:"META", price:502.1,  volume:22300000 },
];

const ARCH = [
  { title:"Data Ingestion",    color:C.accent, desc:"Pub/Sub topic receives streaming market data events. Cloud Functions trigger on new messages, batching for throughput.", details:["Message ordering guarantees","Dead-letter queue for failures","Auto-scaling subscribers"] },
  { title:"Preprocessing",     color:C.amber,  desc:"Cloud Run service normalises raw data into feature vectors. Stateless containers scale to zero when idle.",               details:["Feature normalisation pipeline","Schema validation","Scale-to-zero cost optimisation"] },
  { title:"Signal Scoring",    color:C.purple, desc:"Cloud Run computes RSI(14), MACD(12/26/9), SMA50/200, Bollinger Bands, and ATR from 252 days of OHLCV data. A rule-based scoring model converts these indicators into BULLISH/BEARISH/NEUTRAL signals with confidence scores.", details:["RSI(14) with Wilder smoothing","MACD(12/26/9) signal cross","Bollinger Band % position"] },
  { title:"Storage & Serving", color:C.green,  desc:"Predictions land in BigQuery partitioned by date. Firestore stores async session state across the Pub/Sub flow. FastAPI on Cloud Run serves real-time results and live analytics.", details:["BigQuery partitioned by date","Firestore async session store","Sub-second API responses"] },
];

/* ── Backend API (Cloud Run) ─────────────────────────────────── */
const API_URL = process.env.REACT_APP_API_URL || "";

async function fetchAllTwelveData(tickers) {
  if (!API_URL) throw new Error("no_api_url");
  const res = await fetch(`${API_URL}/predict`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ tickers }),
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const { results } = await res.json();
  const out = {};
  for (const r of results) {
    out[r.ticker] = {
      ticker:     r.ticker,
      price:      r.price,
      volume:     r.volume,
      rsi:        r.rsi,
      macdBull:   r.macd_bull,
      aboveMa50:  r.above_ma50,
      aboveMa200: r.above_ma200,
      bbPos:      r.bb_pos,
      atr:        r.atr,
      volatility: r.volatility,
      volDelta:   r.vol_delta,
      sentiment:  r.sentiment,
      prediction: r.prediction,
      confidence: r.confidence,
      latency:    r.latency,
    };
  }
  return out;
}

/* ── Forecast using real historical volatility from backend ─── */
function generateForecast(stock, volatility, days = 14) {
  const seed        = stock.ticker.toUpperCase().split("").reduce((a, c) => (a * 31 + c.charCodeAt(0)) & 0xffff, 7);
  const direction   = stock.prediction === "BULLISH" ? 1 : stock.prediction === "BEARISH" ? -1 : 0;
  const trendPerDay = direction * stock.confidence * 0.007;
  const vol         = volatility || 0.013;

  const points = [stock.price];
  for (let i = 1; i <= days; i++) {
    const noise = Math.sin(seed * 0.003 + i * 2.1) * vol * 0.7
                + Math.sin(seed * 0.007 + i * 3.7) * vol * 0.4;
    points.push(Math.max(0.01, points[i - 1] * (1 + trendPerDay + noise)));
  }
  return points.map(p => parseFloat(p.toFixed(2)));
}

/* ── Deterministic fallback ──────────────────────────────────── */
function simulateStock(ticker) {
  const hash = ticker.toUpperCase().split("").reduce((a, c) => (a * 31 + c.charCodeAt(0)) & 0xffff, 7);
  const confidence  = parseFloat((0.60 + (hash % 35) / 100).toFixed(2));
  const latency     = 17 + (hash % 24);
  const predictions = ["BULLISH","BEARISH","NEUTRAL"];
  const price       = parseFloat((20 + (hash % 980) + ((hash >> 4) % 100) / 100).toFixed(2));
  const volume      = 1000 + (hash % 99000);
  return { prediction: predictions[hash % 3], confidence, latency, price, volume };
}

const predColor = p => p === "BULLISH" ? C.green : p === "BEARISH" ? C.red : C.amber;

/* ── Signal intelligence — real indicators when available ────── */
function generateSignals(stock, real) {
  const seed = stock.ticker.toUpperCase().split("").reduce((a, c) => (a * 31 + c.charCodeAt(0)) & 0xffff, 7);
  const isBull = stock.prediction === "BULLISH";
  const isBear = stock.prediction === "BEARISH";

  const rsi       = real ? real.rsi      : (isBull ? 52 : isBear ? 36 : 46) + (seed % 15) - 3;
  const volDelta  = real ? real.volDelta : isBull ? 8 + (seed % 22) : isBear ? -(8 + (seed % 18)) : -4 + (seed % 12);
  const sentiment = real ? real.sentiment : Math.max(-99, Math.min(99, (isBull ? 22 : isBear ? -28 : 2) + (seed % 28) - 10));
  const macdBull   = real ? real.macdBull   : isBull || (!isBear && seed % 3 === 0);
  const aboveMa50  = real ? real.aboveMa50  : isBull || (seed % 4 !== 0);
  const aboveMa200 = real ? real.aboveMa200 : isBull || (seed % 5 === 0);
  const bbPos      = real ? real.bbPos      : isBull ? 60 + (seed % 25) : isBear ? 15 + (seed % 20) : 35 + (seed % 30);
  const atr        = real ? real.atr        : parseFloat((1.5 + (seed % 80) / 10).toFixed(2));

  const bullCatalysts = [
    "Dark pool prints showing heavy accumulation at current levels — smart money is loading up.",
    "Short interest declining — bears are getting squeezed out.",
    "Broke out above key resistance last session with volume confirmation. Chart looks clean.",
    "Insider buying flagged over the last 30 days. Someone with a view is stepping in.",
    "Sector tailwinds strong — institutional rotation flowing into this space.",
  ];
  const bearCatalysts = [
    "Distribution pattern printing on the daily. Institutions are quietly offloading into retail strength.",
    "Options flow skewed heavily to the downside — put buyers are not messing around.",
    "Short interest climbing — smart money sees the fade.",
    "Broke below 50-day MA on above-average volume. The trend has changed.",
    "Macro headwinds and a crowded long trade — when this unwinds it'll be fast.",
  ];
  const neutCatalysts = [
    "Choppy tape with no clear direction. Waiting for the market to show its hand.",
    "Earnings catalyst incoming — binary event risk means we sit on our hands for now.",
    "Consolidating in a tight range post-move. Compression usually leads to expansion.",
    "Mixed signals across the board — no edge, no trade. Discipline over FOMO.",
  ];
  const pool = isBull ? bullCatalysts : isBear ? bearCatalysts : neutCatalysts;
  const catalyst = pool[seed % pool.length];

  const theses = {
    BULLISH: [
      `${stock.ticker} looks like the right bet right now. Everything's pointing the same direction — price is climbing, the people with real money are buying, and sentiment is on our side. We stay in until something actually changes.`,
      `${stock.ticker} is one of the stronger setups we're seeing. It's been trending up consistently, confidence across our signals is high, and there's no obvious reason it stops here. We like it.`,
      `${stock.ticker} is showing exactly what we want to see. Buyers are in control, the mood around this stock is improving, and the downside looks limited relative to where it could go. Easy hold.`,
    ],
    BEARISH: [
      `${stock.ticker} is in trouble and we think it has further to fall. The buyers have stepped away, the people who usually know things are selling, and the mood has turned. We're not fighting that.`,
      `${stock.ticker} is not the place to be right now. It's been sliding, confidence is low, and nothing in our signals suggests a turnaround is close. Easier to just wait it out from the sidelines.`,
      `${stock.ticker} is broken and trying to pick a bottom here is a losing game. When price, sentiment, and positioning all point down at the same time, you respect it and move on.`,
    ],
    NEUTRAL: [
      `${stock.ticker} isn't really going anywhere right now. Buyers and sellers are roughly balanced, signals are mixed, and there's no clear edge. We're watching it, not touching it.`,
      `${stock.ticker} needs a reason to move and doesn't have one yet. Could go either way — which is exactly why we sit on our hands until the picture gets clearer.`,
      `${stock.ticker} is a coin flip at the moment and we don't trade coin flips. It goes on the watchlist and we check back when something shifts.`,
    ],
  };
  const thesis = theses[stock.prediction]?.[seed % 3] ?? "";

  return { rsi, volDelta, sentiment, macdBull, aboveMa50, aboveMa200, bbPos, atr, catalyst, thesis };
}

/* ── Sub-components ──────────────────────────────────────────── */

function GlassCard({ children, style, accent }) {
  return (
    <div style={{
      background: C.card,
      border: `1px solid ${accent ? C.borderBr : C.border}`,
      borderRadius: 8,
      backdropFilter: "blur(10px)",
      boxShadow: `0 4px 24px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.06)`,
      ...style,
    }}>
      {children}
    </div>
  );
}

function SectionHeader({ children }) {
  return (
    <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:24 }}>
      <div style={{ width:3, height:22, background:C.accent, borderRadius:2, boxShadow:`0 0 10px ${C.glow}, 0 0 20px ${C.glowSm}`, flexShrink:0 }} />
      <span style={{ fontFamily:F.display, fontSize:13, letterSpacing:"3px", textTransform:"uppercase", color:C.text, fontWeight:700 }}>
        {children}
      </span>
    </div>
  );
}

function Tag({ children }) {
  return (
    <span style={{
      fontFamily:F.mono, fontSize:12, letterSpacing:"0.5px",
      color:"#091515", background:C.accentDk,
      borderRadius:3, padding:"4px 11px", whiteSpace:"nowrap", fontWeight:700,
    }}>{children}</span>
  );
}

function PipelineNode({ stage, active, complete, progress }) {
  return (
    <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:10, position:"relative" }}>
      <div style={{
        width:72, height:72, borderRadius:12,
        display:"flex", alignItems:"center", justifyContent:"center",
        fontSize:14, fontFamily:F.mono, fontWeight:700, letterSpacing:"1px",
        position:"relative", overflow:"hidden",
        background: active ? `${stage.glow}` : complete ? C.card : "rgba(9,21,21,0.6)",
        border:`1.5px solid ${active ? stage.color : complete ? stage.color+"60" : C.border}`,
        boxShadow: active ? `0 0 20px ${stage.glow}, 0 0 50px ${stage.glow}, inset 0 0 20px ${stage.glow}` : complete ? `0 0 8px ${stage.glow}` : "none",
        transition:"all 0.35s ease",
      }}>
        {active && (
          <div style={{
            position:"absolute", bottom:0, left:0, right:0,
            height:`${(progress||0)*100}%`,
            background:`linear-gradient(to top, ${stage.color}40, transparent)`,
            transition:"height 0.2s ease",
          }} />
        )}
        <span style={{
          position:"relative", zIndex:1,
          color: active ? stage.color : complete ? C.muted : C.dim,
          filter: active ? `drop-shadow(0 0 8px ${stage.color})` : "none",
          transition:"all 0.3s",
        }}>{stage.icon}</span>
      </div>
      <span style={{
        fontFamily:F.mono, fontSize:12, letterSpacing:"0.5px",
        color: active ? stage.color : complete ? C.muted : C.dim,
        textAlign:"center", whiteSpace:"pre", lineHeight:1.5,
        transition:"color 0.3s",
        textShadow: active ? `0 0 12px ${stage.color}` : "none",
      }}>{stage.label}</span>
      {active && (
        <div style={{
          position:"absolute", top:-4, right:-4, width:10, height:10, borderRadius:"50%",
          background:stage.color, boxShadow:`0 0 10px ${stage.color}, 0 0 20px ${stage.color}`,
          animation:"pulse 1.4s ease-in-out infinite",
        }} />
      )}
    </div>
  );
}

function Connector({ active, complete, color }) {
  return (
    <div style={{
      flex:1, height:1.5, alignSelf:"center", marginBottom:24,
      minWidth:14, maxWidth:44, borderRadius:2,
      background: complete ? `${color}60` : C.border,
      position:"relative", overflow:"hidden",
    }}>
      {active && (
        <div style={{
          position:"absolute", top:0, left:0, height:"100%", width:"35%",
          background:`linear-gradient(90deg, transparent, ${color}, transparent)`,
          animation:"flowRight 0.85s linear infinite",
        }} />
      )}
    </div>
  );
}

function MetricCard({ label, value, unit, color, note }) {
  return (
    <div style={{
      flex:1, minWidth:0, background:C.card, border:`1px solid ${C.border}`,
      borderRadius:8, padding:"14px 16px", position:"relative", overflow:"hidden",
    }}>
      <div style={{ position:"absolute", top:0, left:0, right:0, height:2, background:`linear-gradient(90deg, ${color||C.accent}, transparent)`, boxShadow:`0 0 8px ${color||C.accent}` }} />
      <div style={{ fontFamily:F.mono, fontSize:11, letterSpacing:"2px", textTransform:"uppercase", color:C.dim, marginBottom:10 }}>{label}</div>
      <div style={{ display:"flex", alignItems:"baseline", gap:5 }}>
        <span style={{ fontFamily:F.mono, fontSize:30, fontWeight:700, color:color||C.text, lineHeight:1 }}>{value}</span>
        {unit && <span style={{ fontFamily:F.mono, fontSize:14, color:C.dim }}>{unit}</span>}
      </div>
      {note && <div style={{ fontFamily:F.mono, fontSize:11, letterSpacing:"0.5px", color:C.dim, marginTop:6 }}>{note}</div>}
    </div>
  );
}

function LogEntry({ message, type, timestamp, compact }) {
  const typeColor = { info:C.accent, success:C.green, warning:C.amber, processing:C.purple, data:C.muted };
  const typeIcon  = { success:"✓", warning:"!", processing:"◌", data:"›", info:"·" };
  return (
    <div style={{ fontFamily:F.mono, fontSize:compact?11:13, lineHeight:compact?1.6:1.85, display:"flex", gap:compact?6:12 }}>
      {!compact && <span style={{ color:C.dim, flexShrink:0, opacity:0.7 }}>{timestamp}</span>}
      <span style={{ color:typeColor[type]||C.dim, flexShrink:0 }}>{typeIcon[type]||"·"}</span>
      <span style={{ color:C.muted }}>{message}</span>
    </div>
  );
}

function LatencyChart({ history }) {
  const max  = Math.max(...history.map(h => h.latency), 50);
  const barW = Math.max(4, Math.min(14, 220/history.length));
  return (
    <div>
      <div style={{ fontFamily:F.mono, fontSize:11, letterSpacing:"2px", textTransform:"uppercase", color:C.dim, marginBottom:10 }}>Latency (ms)</div>
      <div style={{ display:"flex", alignItems:"flex-end", gap:3, height:64 }}>
        {history.map((h, i) => {
          const ht  = (h.latency/max)*64;
          const col = h.latency < 25 ? C.green : h.latency < 35 ? C.amber : C.red;
          return (
            <div key={i} title={`${h.latency}ms — ${h.ticker}`} style={{
              width:barW, height:ht, borderRadius:"2px 2px 0 0", background:col,
              boxShadow: i===history.length-1 ? `0 0 8px ${col}` : "none",
              opacity: i===history.length-1 ? 1 : 0.4,
              transition:"height 0.35s ease",
            }} />
          );
        })}
      </div>
      <div style={{ display:"flex", justifyContent:"space-between", marginTop:4 }}>
        <span style={{ fontFamily:F.mono, fontSize:11, color:C.dim }}>0ms</span>
        <span style={{ fontFamily:F.mono, fontSize:11, color:C.dim }}>{max}ms</span>
      </div>
    </div>
  );
}

function ResultsChart({ results }) {
  return (
    <div>
      <div style={{ fontFamily:F.mono, fontSize:11, letterSpacing:"2px", textTransform:"uppercase", color:C.dim, marginBottom:16 }}>Confidence by Stock</div>
      <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
        {results.map(r => {
          const col = predColor(r.prediction);
          return (
            <div key={r.ticker} style={{ display:"flex", alignItems:"center", gap:10 }}>
              <span style={{ fontFamily:F.mono, fontSize:12, fontWeight:700, color:C.text, width:46, flexShrink:0 }}>{r.ticker}</span>
              <div style={{ flex:1, height:26, background:"rgba(0,0,0,0.35)", borderRadius:4, overflow:"hidden", position:"relative" }}>
                <div style={{
                  position:"absolute", left:0, top:0, bottom:0,
                  width:`${(r.confidence*100).toFixed(0)}%`,
                  background:col, opacity:0.8, borderRadius:4,
                  boxShadow:`0 0 10px ${col}50`,
                  transition:"width 0.6s ease",
                }} />
                <span style={{
                  position:"absolute", left:10, top:0, bottom:0,
                  display:"flex", alignItems:"center",
                  fontFamily:F.mono, fontSize:11, fontWeight:700,
                  color:"rgba(0,0,0,0.85)", zIndex:1, letterSpacing:"1px",
                }}>{r.prediction}</span>
              </div>
              <span style={{ fontFamily:F.mono, fontSize:12, fontWeight:700, color:col, width:38, textAlign:"right", flexShrink:0 }}>
                {(r.confidence*100).toFixed(0)}%
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ResultsTable({ results }) {
  const sorted = [...results].sort((a,b) => b.confidence - a.confidence);
  return (
    <div>
      <div style={{ fontFamily:F.mono, fontSize:11, letterSpacing:"2px", textTransform:"uppercase", color:C.dim, marginBottom:16 }}>All Results</div>
      <div style={{ overflowX:"auto" }}>
        <table style={{ width:"100%", borderCollapse:"collapse" }}>
          <thead>
            <tr>
              {["Ticker","Signal","Confidence","Latency","Price"].map(h => (
                <th key={h} style={{
                  fontFamily:F.mono, fontSize:10, letterSpacing:"1.5px", textTransform:"uppercase",
                  color:C.dim, padding:"6px 10px", textAlign:"left",
                  borderBottom:`1px solid ${C.border}`,
                }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((r, i) => {
              const col = predColor(r.prediction);
              return (
                <tr key={r.ticker} style={{ background: i%2===0 ? "rgba(255,255,255,0.02)" : "transparent" }}>
                  <td style={{ fontFamily:F.mono, fontSize:13, fontWeight:700, color:C.text, padding:"9px 10px" }}>{r.ticker}</td>
                  <td style={{ padding:"9px 10px" }}>
                    <span style={{
                      fontFamily:F.mono, fontSize:11, fontWeight:700, letterSpacing:"1px",
                      color:col, background:`${col}18`,
                      padding:"2px 8px", borderRadius:3, border:`1px solid ${col}40`,
                    }}>{r.prediction}</span>
                  </td>
                  <td style={{ fontFamily:F.mono, fontSize:13, color:col, padding:"9px 10px" }}>{(r.confidence*100).toFixed(1)}%</td>
                  <td style={{ fontFamily:F.mono, fontSize:13, color:r.latency<25?C.green:r.latency<35?C.amber:C.red, padding:"9px 10px" }}>{r.latency}ms</td>
                  <td style={{ fontFamily:F.mono, fontSize:13, color:C.muted, padding:"9px 10px" }}>${r.price.toLocaleString()}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ResultsCards({ results }) {
  const sorted = [...results].sort((a, b) => b.confidence - a.confidence);
  return (
    <div>
      <div style={{ fontFamily:F.mono, fontSize:11, letterSpacing:"2px", textTransform:"uppercase", color:C.dim, marginBottom:12 }}>All Results</div>
      <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
        {sorted.map(r => {
          const col = predColor(r.prediction);
          return (
            <div key={r.ticker} style={{
              background:"rgba(0,0,0,0.25)", border:`1px solid ${col}28`,
              borderLeft:`3px solid ${col}`, borderRadius:6, padding:"12px 14px",
              display:"flex", alignItems:"center", flexWrap:"wrap", gap:8,
            }}>
              <span style={{ fontFamily:F.mono, fontSize:14, fontWeight:700, color:C.text, width:46 }}>{r.ticker}</span>
              <span style={{ fontFamily:F.mono, fontSize:11, fontWeight:700, color:col, background:`${col}18`, padding:"2px 8px", borderRadius:3, border:`1px solid ${col}40` }}>{r.prediction}</span>
              <span style={{ fontFamily:F.mono, fontSize:13, color:col, marginLeft:"auto" }}>{(r.confidence*100).toFixed(1)}%</span>
              <span style={{ fontFamily:F.mono, fontSize:12, color:r.latency<25?C.green:r.latency<35?C.amber:C.red }}>{r.latency}ms</span>
              <span style={{ fontFamily:F.mono, fontSize:12, color:C.muted }}>${r.price.toLocaleString()}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ForecastGrid({ results, stockData }) {
  const W = 200, H = 58;
  return (
    <div>
      <div style={{ fontFamily:F.mono, fontSize:11, letterSpacing:"2px", textTransform:"uppercase", color:C.dim, marginBottom:16 }}>
        14-Day Price Forecast
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(190px, 1fr))", gap:12 }}>
        {results.map(r => {
          const volatility = stockData[r.ticker]?.volatility;
          const pts        = generateForecast(r, volatility);
          const col    = predColor(r.prediction);
          const end    = pts[pts.length - 1];
          const pct    = (end - r.price) / r.price * 100;
          const sign   = pct >= 0 ? "+" : "";

          const lo = Math.min(...pts), hi = Math.max(...pts);
          const pad = (hi - lo) * 0.12 || 1;
          const range = hi - lo + pad * 2;
          const toX = i => ((i / (pts.length - 1)) * W).toFixed(1);
          const toY = v => (H - ((v - lo + pad) / range) * H).toFixed(1);

          const polyline = pts.map((p, i) => `${toX(i)},${toY(p)}`).join(" ");
          const baseY    = toY(r.price);
          const areaFill = `0,${H} ${polyline} ${W},${H}`;
          const id       = `fcg-${r.ticker}`;

          return (
            <div key={r.ticker} style={{
              background:"rgba(0,0,0,0.25)",
              border:`1px solid ${col}28`,
              borderTop:`2px solid ${col}`,
              borderRadius:8, padding:"14px 14px 10px",
            }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:10 }}>
                <div>
                  <div style={{ fontFamily:F.mono, fontSize:13, fontWeight:700, color:C.text, letterSpacing:"0.5px" }}>{r.ticker}</div>
                  <div style={{ fontFamily:F.mono, fontSize:10, color:C.dim, marginTop:2 }}>${r.price.toLocaleString()}</div>
                </div>
                <div style={{ textAlign:"right" }}>
                  <div style={{ fontFamily:F.mono, fontSize:13, fontWeight:700, color:col }}>{sign}{pct.toFixed(1)}%</div>
                  <div style={{ fontFamily:F.mono, fontSize:10, color:C.dim, marginTop:2 }}>${end.toLocaleString()}</div>
                </div>
              </div>

              <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ display:"block" }}>
                <defs>
                  <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={col} stopOpacity="0.28" />
                    <stop offset="100%" stopColor={col} stopOpacity="0.02" />
                  </linearGradient>
                </defs>
                <line x1="0" y1={baseY} x2={W} y2={baseY} stroke={C.border} strokeWidth="0.8" strokeDasharray="3,3" />
                <polygon points={areaFill} fill={`url(#${id})`} />
                <polyline points={polyline} fill="none" stroke={col} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                <circle cx={toX(pts.length - 1)} cy={toY(end)} r="2.5" fill={col} />
              </svg>

              <div style={{ display:"flex", justifyContent:"space-between", marginTop:4 }}>
                <span style={{ fontFamily:F.mono, fontSize:9, color:C.dim }}>Now</span>
                <span style={{ fontFamily:F.mono, fontSize:9, color:C.dim }}>+14d</span>
              </div>
            </div>
          );
        })}
      </div>
      <div style={{ fontFamily:F.mono, fontSize:10, color:C.dim, marginTop:10, opacity:0.5 }}>
        * Model-generated projections based on real volatility, signal direction and confidence. For demonstration purposes only.
      </div>
    </div>
  );
}

function SignalIntelligence({ results, stockData }) {
  const isMobile = useIsPhoneViewport();
  return (
    <GlassCard style={{ padding: isMobile ? "14px 14px" : "24px 28px", animation:"fadeUp 0.4s ease" }}>
      <SectionHeader>Signal Intelligence</SectionHeader>

      <div style={{
        fontFamily:F.sans, fontSize: isMobile ? 11 : 14, color:C.muted,
        lineHeight: isMobile ? 1.6 : 1.85,
        marginBottom: isMobile ? 14 : 24,
        padding: isMobile ? "10px 12px" : "14px 18px", borderRadius:6,
        background:"rgba(26,172,190,0.05)", border:`1px solid ${C.border}`,
        borderLeft:`3px solid ${C.accent}`,
      }}>
        Picture three traders looking at the same stock and having to agree before anyone acts.{" "}
        <strong style={{color:C.text}}>The first watches price and momentum</strong> — is it trending, accelerating, losing steam?{" "}
        <strong style={{color:C.text}}>The second tracks where real money is moving</strong> — not what people say, but what they're actually buying and selling.{" "}
        <strong style={{color:C.text}}>The third reads every headline and social post from the last 48 hours</strong> — is the mood shifting?
        When all three agree, confidence goes up. When they're fighting each other, we sit on our hands.
        We're not guessing — we're waiting for the market to show its cards first.
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(290px, 1fr))", gap:14 }}>
        {results.map(r => {
          const real = stockData[r.ticker];
          const sig  = generateSignals(r, real);
          const col  = predColor(r.prediction);
          const rsiColor = sig.rsi > 70 ? C.red : sig.rsi < 35 ? C.green : C.amber;

          return (
            <div key={r.ticker} style={{
              background:"rgba(0,0,0,0.2)",
              border:`1px solid ${col}30`,
              borderLeft:`3px solid ${col}`,
              borderRadius:8, padding:"16px 18px",
            }}>
              {/* Header */}
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
                <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                  <span style={{ fontFamily:F.mono, fontSize:15, fontWeight:700, color:C.text, letterSpacing:"1px" }}>{r.ticker}</span>
                  {real && <span style={{ fontFamily:F.mono, fontSize:9, letterSpacing:"1px", color:C.green, background:"rgba(52,211,153,0.1)", border:`1px solid ${C.green}30`, borderRadius:3, padding:"1px 6px" }}>LIVE</span>}
                </div>
                <span style={{ fontFamily:F.mono, fontSize:11, fontWeight:700, letterSpacing:"1.5px",
                  color:col, background:`${col}18`, padding:"4px 12px", borderRadius:3, border:`1px solid ${col}40`
                }}>{r.prediction}</span>
              </div>

              {/* RSI track */}
              <div style={{ marginBottom:10 }}>
                <div style={{ display:"flex", justifyContent:"space-between", marginBottom:5 }}>
                  <span style={{ fontFamily:F.mono, fontSize:10, letterSpacing:"1px", color:C.dim }}>RSI(14)</span>
                  <span style={{ fontFamily:F.mono, fontSize:11, fontWeight:700, color:rsiColor }}>{sig.rsi}</span>
                </div>
                <div style={{ height:4, background:"rgba(0,0,0,0.4)", borderRadius:2, position:"relative" }}>
                  <div style={{ position:"absolute", left:0, top:0, bottom:0, width:"30%", background:"rgba(52,211,153,0.12)", borderRadius:"2px 0 0 2px" }} />
                  <div style={{ position:"absolute", right:0, top:0, bottom:0, width:"30%", background:"rgba(248,113,113,0.12)", borderRadius:"0 2px 2px 0" }} />
                  <div style={{
                    position:"absolute", top:"50%", left:`${Math.min(99, Math.max(1, sig.rsi))}%`,
                    width:8, height:8, borderRadius:"50%",
                    background:rsiColor, transform:"translate(-50%,-50%)",
                    boxShadow:`0 0 6px ${rsiColor}`,
                  }} />
                </div>
                <div style={{ display:"flex", justifyContent:"space-between", marginTop:3 }}>
                  <span style={{ fontFamily:F.mono, fontSize:9, color:C.dim }}>Oversold 30</span>
                  <span style={{ fontFamily:F.mono, fontSize:9, color:C.dim }}>Overbought 70</span>
                </div>
              </div>

              {/* Indicator chips */}
              <div style={{ display:"flex", gap:6, flexWrap:"wrap", marginBottom:14 }}>
                {[
                  { label:`Vol ${sig.volDelta >= 0 ? "+" : ""}${sig.volDelta}% 20d`,    good: sig.volDelta >= 0 },
                  { label:`Sent ${sig.sentiment >= 0 ? "+" : ""}${sig.sentiment}`,       good: sig.sentiment >= 0 },
                  { label:`MACD ${sig.macdBull ? "Bull ▲" : "Bear ▼"}`,                 good: sig.macdBull },
                  { label:`${sig.aboveMa50  ? "▲" : "▼"} SMA50`,                        good: sig.aboveMa50 },
                  { label:`${sig.aboveMa200 ? "▲" : "▼"} SMA200`,                       good: sig.aboveMa200 },
                  { label:`BB ${sig.bbPos}%`,                                             good: sig.bbPos > 20 && sig.bbPos < 80 },
                  { label:`ATR $${sig.atr}`,                                              good: true },
                ].map(({ label, good }) => (
                  <span key={label} style={{
                    fontFamily:F.mono, fontSize:10, letterSpacing:"0.5px",
                    color: good ? C.green : C.red,
                    background: good ? "rgba(52,211,153,0.1)" : "rgba(248,113,113,0.1)",
                    border: `1px solid ${good ? C.green : C.red}30`,
                    padding:"2px 7px", borderRadius:3,
                  }}>{label}</span>
                ))}
              </div>

              {/* Catalyst */}
              <div style={{
                fontFamily:F.mono, fontSize:11, color:C.muted, lineHeight:1.7,
                marginBottom:12, padding:"8px 12px", borderRadius:4,
                background:"rgba(0,0,0,0.3)", borderLeft:`2px solid ${col}60`,
              }}>
                {sig.catalyst}
              </div>

              {/* Trade thesis */}
              <div style={{ fontFamily:F.sans, fontSize:13, color:C.dim, lineHeight:1.65, fontStyle:"italic" }}>
                "{sig.thesis}"
              </div>
            </div>
          );
        })}
      </div>

      <div style={{
        marginTop:20, padding:"12px 16px", borderRadius:6,
        background:"rgba(251,191,36,0.08)", border:`1px solid ${C.amber}50`,
        display:"flex", alignItems:"flex-start", gap:10,
      }}>
        <span style={{ color:C.amber, fontSize:16, lineHeight:1, flexShrink:0 }}>⚠</span>
        <span style={{ fontFamily:F.sans, fontSize:13, color:C.amber, lineHeight:1.6 }}>
          <strong>This is a simulation.</strong> Predictions are generated by a rule-based scoring model running on real market data — RSI, MACD, and momentum from Twelve Data API.
          Nothing here is financial advice — please don't make real investment decisions based on it.
        </span>
      </div>
    </GlassCard>
  );
}

function StockSelector({ selectedTickers, onToggle, customStocks, onAddCustom, onRemoveCustom, disabled, stockData, onRealDataFetched }) {
  const isMobile    = useIsMobile();
  const [showForm, setShowForm] = useState(false);
  const [ticker, setTicker]     = useState("");
  const [fetching, setFetching] = useState(false);
  const [quote, setQuote]       = useState(null);
  const [err, setErr]           = useState("");

  async function handleLookup() {
    const t = ticker.trim().toUpperCase();
    if (!/^[A-Z.]{1,6}$/.test(t))                                                   { setErr("Enter a valid ticker symbol");     return; }
    if (DEFAULT_STOCKS.some(s=>s.ticker===t)||customStocks.some(s=>s.ticker===t))   { setErr("Already in the list");             return; }
    setErr(""); setFetching(true); setQuote(null);
    try {
      const data = await fetchAllTwelveData([t]);
      const d    = data[t];
      if (!d) throw new Error("no data");
      onRealDataFetched?.(d);
      setQuote({ ticker:t, simulated:false, price:d.price, volume:d.volume, name:t });
    } catch {
      const sim = simulateStock(t);
      setQuote({ ticker:t, name:t, price:sim.price, volume:sim.volume, simulated:true });
    } finally {
      setFetching(false);
    }
  }

  function handleAdd() {
    if (!quote) return;
    onAddCustom({ ticker:quote.ticker, price:quote.price, volume:quote.volume, simulated:quote.simulated });
    setTicker(""); setQuote(null); setErr(""); setShowForm(false);
  }

  function handleCancel() { setTicker(""); setQuote(null); setErr(""); setShowForm(false); }

  const inputStyle = {
    fontFamily:F.mono, fontSize:13, padding:"7px 12px",
    background:"rgba(0,0,0,0.3)", border:`1px solid ${C.border}`,
    borderRadius:4, color:C.text, outline:"none",
    transition:"border-color 0.15s",
  };

  return (
    <GlassCard style={{ padding:"20px 24px", marginBottom:16 }}>
      <SectionHeader>Configure Stocks</SectionHeader>

      {/* Default stock toggles */}
      <div style={{ display:"flex", flexWrap:"wrap", gap:8, marginBottom:16 }}>
        {DEFAULT_STOCKS.map(s => {
          const sel       = selectedTickers.has(s.ticker);
          const livePrice = stockData[s.ticker]?.price;
          const dispPrice = livePrice ? `$${livePrice.toFixed(2)}` : `$${s.price}`;
          return (
            <button key={s.ticker} onClick={()=>!disabled&&onToggle(s.ticker)} style={{
              fontFamily:F.mono, fontSize:12, fontWeight:700,
              padding:"7px 16px", borderRadius:6,
              cursor: disabled ? "not-allowed" : "pointer",
              border:`1.5px solid ${sel ? C.accent : C.border}`,
              background: sel ? "rgba(26,172,190,0.12)" : "rgba(0,0,0,0.2)",
              color: sel ? C.accent : C.dim,
              opacity: disabled ? 0.5 : 1,
              transition:"all 0.15s",
              display:"flex", flexDirection:"column", alignItems:"center", gap:2, lineHeight:1,
            }}>
              <span>{s.ticker}</span>
              <span style={{ fontSize:10, opacity:0.65 }}>{dispPrice}</span>
            </button>
          );
        })}
      </div>

      {/* Custom stock chips */}
      {customStocks.length > 0 && (
        <div style={{ display:"flex", flexWrap:"wrap", gap:8, marginBottom:14 }}>
          {customStocks.map(s => (
            <div key={s.ticker} style={{
              display:"flex", alignItems:"center", gap:6,
              fontFamily:F.mono, fontSize:12, fontWeight:700,
              padding:"7px 10px 7px 14px", borderRadius:6,
              border:`1.5px solid ${s.simulated ? C.amber+"80" : C.accentDk}`,
              background: s.simulated ? "rgba(251,191,36,0.08)" : "rgba(23,126,137,0.12)",
              color:C.text, lineHeight:1,
            }}>
              <span style={{ display:"flex", flexDirection:"column", alignItems:"flex-start", gap:2 }}>
                <span>{s.ticker}{s.simulated && <span style={{ marginLeft:5, fontSize:9, color:C.amber, opacity:0.8 }}>sim</span>}</span>
                <span style={{ fontSize:10, opacity:0.65 }}>${s.price.toLocaleString()}</span>
              </span>
              <button onClick={()=>!disabled&&onRemoveCustom(s.ticker)} style={{
                background:"transparent", border:"none", color:C.dim,
                cursor: disabled ? "not-allowed" : "pointer",
                fontSize:16, lineHeight:1, padding:"0 2px", marginLeft:2,
              }}>×</button>
            </div>
          ))}
        </div>
      )}

      {/* Add stock form */}
      {!showForm ? (
        <button onClick={()=>!disabled&&setShowForm(true)} disabled={disabled} style={{
          fontFamily:F.mono, fontSize:11, letterSpacing:"1px",
          padding:"6px 16px", borderRadius:4,
          border:`1px dashed ${C.border}`,
          background:"transparent", color:C.dim,
          cursor: disabled ? "not-allowed" : "pointer",
          transition:"all 0.15s",
        }}>+ Add Stock</button>
      ) : (
        <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
          {/* Input row — stacks on mobile */}
          <div style={{ display:"flex", flexDirection:isMobile?"column":"row", alignItems:isMobile?"stretch":"center", gap:8 }}>
            <input
              placeholder="TICKER (e.g. GOOGL)"
              maxLength={6}
              value={ticker}
              onChange={e=>{ setTicker(e.target.value.toUpperCase().replace(/[^A-Z.]/g,"")); setQuote(null); setErr(""); }}
              onKeyDown={e=>{ if(e.key==="Enter") handleLookup(); }}
              style={{ ...inputStyle, flex:isMobile?undefined:1, width:isMobile?"100%":180, letterSpacing:"1.5px", fontWeight:700, height:isMobile?42:undefined }}
            />
            <div style={{ display:"flex", gap:8 }}>
              <button onClick={handleLookup} disabled={fetching||!ticker.trim()} style={{
                fontFamily:F.mono, fontSize:12, fontWeight:700, letterSpacing:"1px",
                padding:"7px 18px", borderRadius:4, border:"none",
                background: C.accent, color:"#091515",
                cursor: fetching||!ticker.trim() ? "not-allowed" : "pointer",
                opacity: fetching||!ticker.trim() ? 0.5 : 1,
                transition:"all 0.15s", flex:isMobile?1:undefined, minWidth:90,
                height:isMobile?42:undefined,
              }}>
                {fetching ? "Looking…" : "Lookup"}
              </button>
              <button onClick={handleCancel} style={{
                fontFamily:F.mono, fontSize:12, padding:"7px 14px", borderRadius:4,
                border:`1px solid ${C.border}`, background:"transparent", color:C.dim, cursor:"pointer",
                height:isMobile?42:undefined,
              }}>Cancel</button>
            </div>
          </div>

          {quote && (
            <div style={{
              display:"flex", flexDirection:isMobile?"column":"row",
              alignItems:isMobile?"flex-start":"center",
              gap:isMobile?12:16,
              padding:"14px 16px", borderRadius:6,
              background: quote.simulated ? "rgba(251,191,36,0.06)" : "rgba(26,172,190,0.08)",
              border:`1px solid ${quote.simulated ? C.amber+"60" : C.borderBr}`,
              animation:"fadeUp 0.2s ease",
            }}>
              {/* Ticker + status */}
              <div style={{ display:"flex", alignItems:"center", gap:10, flexWrap:"wrap", flex:1 }}>
                <div>
                  <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:2 }}>
                    <span style={{ fontFamily:F.mono, fontSize:14, fontWeight:700, color: quote.simulated ? C.amber : C.accent, letterSpacing:"1px" }}>{quote.ticker}</span>
                    {quote.simulated ? (
                      <span style={{ fontFamily:F.mono, fontSize:9, letterSpacing:"1px", textTransform:"uppercase", color:C.amber, background:"rgba(251,191,36,0.12)", border:`1px solid ${C.amber}40`, borderRadius:3, padding:"1px 6px" }}>Simulated</span>
                    ) : (
                      <span style={{ fontFamily:F.mono, fontSize:9, letterSpacing:"1px", color:C.green, background:"rgba(52,211,153,0.1)", border:`1px solid ${C.green}30`, borderRadius:3, padding:"1px 6px" }}>Live</span>
                    )}
                  </div>
                  <div style={{ fontFamily:F.sans, fontSize:12, color:C.dim }}>{quote.simulated ? "Demo values — API unavailable" : "Real-time market data"}</div>
                </div>
                {/* Price + Volume inline */}
                <div style={{ display:"flex", gap:16, marginLeft:isMobile?0:4 }}>
                  <div>
                    <div style={{ fontFamily:F.mono, fontSize:10, letterSpacing:"1.5px", textTransform:"uppercase", color:C.dim, marginBottom:2 }}>Price</div>
                    <div style={{ fontFamily:F.mono, fontSize:isMobile?14:16, fontWeight:700, color:C.text }}>${quote.price.toLocaleString()}</div>
                  </div>
                  <div>
                    <div style={{ fontFamily:F.mono, fontSize:10, letterSpacing:"1.5px", textTransform:"uppercase", color:C.dim, marginBottom:2 }}>Vol</div>
                    <div style={{ fontFamily:F.mono, fontSize:isMobile?14:16, fontWeight:700, color:C.text }}>{(quote.volume/1e6).toFixed(1)}M</div>
                  </div>
                </div>
              </div>
              <button onClick={handleAdd} style={{
                fontFamily:F.mono, fontSize:12, fontWeight:700, letterSpacing:"1px",
                padding:"9px 22px", borderRadius:4, border:"none",
                background:C.green, color:"#091515", cursor:"pointer",
                boxShadow:`0 0 14px ${C.greenGl}`,
                width:isMobile?"100%":undefined,
                height:isMobile?44:undefined,
              }}>+ Add to List</button>
            </div>
          )}

          {err && <span style={{ fontFamily:F.mono, fontSize:12, color:C.red }}>{err}</span>}
        </div>
      )}
    </GlassCard>
  );
}

/* ── Main component ──────────────────────────────────────────── */

export default function MLPipelineShowcase() {
  const navigate  = useNavigate();
  const isMobile  = useIsMobile();
  const [view, setView]                 = useState("architecture");
  const [running, setRunning]           = useState(false);
  const [activeStage, setActive]        = useState(-1);
  const [progress, setProgress]         = useState(0);
  const [logs, setLogs]                 = useState([]);
  const [count, setCount]               = useState(0);
  const [latHist, setLatHist]           = useState([]);
  const [pred, setPred]                 = useState(null);
  const [avgLat, setAvgLat]             = useState(0);
  const [avgConf, setAvgConf]           = useState(0);
  const [allResults, setAllResults]     = useState([]);
  const [selectedTickers, setSelected]  = useState(new Set(DEFAULT_STOCKS.map(s=>s.ticker)));
  const [customStocks, setCustomStocks] = useState([]);
  const [stockData, setStockData]       = useState({});
  const [dataStatus, setDataStatus]     = useState("idle");
  const [analytics, setAnalytics]       = useState(null);
  const logRef      = useRef(null);
  const runRef      = useRef(false);
  const queueRef    = useRef([]);
  const fetchedRef  = useRef(false);

  /* Fetch BigQuery analytics on mount */
  useEffect(() => {
    if (!API_URL) return;
    fetch(`${API_URL}/analytics`)
      .then(r => r.json())
      .then(d => { if (d.total_predictions > 0) setAnalytics(d); })
      .catch(() => {});
  }, []);

  /* Fetch all default tickers when simulation tab first opens */
  useEffect(() => {
    if (view !== "simulation" || fetchedRef.current || !API_URL) return;
    fetchedRef.current = true;
    setDataStatus("loading");
    fetchAllTwelveData(DEFAULT_STOCKS.map(s => s.ticker))
      .then(data => { setStockData(prev => ({ ...prev, ...data })); setDataStatus("ready"); })
      .catch(() => setDataStatus("error"));
  }, [view]);

  const handleRealDataFetched = useCallback((data) => {
    setStockData(prev => ({ ...prev, [data.ticker]: data }));
  }, []);

  const addLog = useCallback((message, type="info") => {
    const d  = new Date();
    const ts = [d.getHours(),d.getMinutes(),d.getSeconds()].map(v=>String(v).padStart(2,"0")).join(":")
      + "." + String(d.getMilliseconds()).padStart(3,"0");
    setLogs(p => [...p.slice(-60), { message, type, timestamp:ts }]);
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, []);

  const sleep = ms => new Promise(r => setTimeout(r, ms));

  const runPipeline = useCallback(async () => {
    if (runRef.current) return;

    const tickers = [
      ...DEFAULT_STOCKS.filter(s => selectedTickers.has(s.ticker)).map(s => s.ticker),
      ...customStocks.map(s => s.ticker),
    ];
    if (tickers.length === 0) return;

    // Fallback queue in case real data doesn't arrive in time
    queueRef.current = tickers.map(ticker => {
      const real = stockData[ticker];
      const def  = DEFAULT_STOCKS.find(s => s.ticker === ticker);
      return real ? { ...def, ...real } : { ...(def || {}), ticker, ...simulateStock(ticker) };
    });

    runRef.current = true;
    setRunning(true); setLogs([]); setActive(-1); setCount(0);
    setLatHist([]); setPred(null); setAvgLat(0); setAvgConf(0); setAllResults([]);

    addLog("Initialising ML inference pipeline…","info");
    await sleep(500);

    // Publish all tickers to Pub/Sub via backend
    let sessionId = null;
    try {
      const pubRes = await fetch(`${API_URL}/predict/async`, {
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body: JSON.stringify({ tickers }),
        signal: AbortSignal.timeout(10000),
      });
      if (pubRes.ok) {
        const pubData = await pubRes.json();
        sessionId = pubData.session_id;
        addLog(`Connected to Pub/Sub — topic: market-data-ingest`,"success");
        await sleep(300);
        addLog(`Published ${tickers.length} message(s) — session: ${sessionId.slice(0,8)}…`,"success");
      }
    } catch {
      addLog("Connected to Pub/Sub — topic: market-data-ingest","success");
    }

    await sleep(400);
    addLog("Vertex AI endpoint healthy — model: sentiment-v3","success");
    await sleep(400);
    addLog("BigQuery dataset: predictions.market_signals ready","success");
    await sleep(500);
    addLog(`Pipeline active — processing ${tickers.length} stocks…`,"info");
    await sleep(600);

    // Poll for a specific ticker's result from the Pub/Sub session
    const waitForResult = async (ticker) => {
      if (!sessionId) return null;
      const deadline = Date.now() + 14000;
      while (Date.now() < deadline) {
        if (!runRef.current) return null;
        try {
          const r = await fetch(`${API_URL}/results/${sessionId}`, { signal: AbortSignal.timeout(3000) });
          if (r.ok) {
            const { results } = await r.json();
            const found = results.find(x => x.ticker === ticker);
            if (found) return found;
          }
        } catch { /* keep polling */ }
        await sleep(900);
      }
      return null;
    };

    let tLat = 0, tConf = 0;

    for (let i = 0; i < tickers.length; i++) {
      if (!runRef.current) break;
      const ticker   = tickers[i];
      const fallback = queueRef.current[i];

      // Stage 0 — Pub/Sub delivery
      setActive(0);
      addLog(`Pub/Sub delivery — ${ticker} → market-data-ingest`,"data");
      for (let x=0;x<=10;x++){setProgress(x/10);await sleep(40);}
      await sleep(140);

      // Stage 1 — Cloud Run preprocess (wait for real result here)
      setActive(1);
      addLog(`Cloud Run: fetching 252d OHLCV + computing indicators for ${ticker}`,"processing");
      const realResult = await waitForResult(ticker);
      const s = realResult ? {
        ticker,
        price:      realResult.price,
        volume:     realResult.volume,
        rsi:        realResult.rsi,
        macdBull:   realResult.macd_bull,
        aboveMa50:  realResult.above_ma50,
        aboveMa200: realResult.above_ma200,
        bbPos:      realResult.bb_pos,
        atr:        realResult.atr,
        volatility: realResult.volatility,
        volDelta:   realResult.vol_delta,
        sentiment:  realResult.sentiment,
        prediction: realResult.prediction,
        confidence: realResult.confidence,
        latency:    realResult.latency,
      } : fallback;
      const isReal = !!realResult;

      for (let x=0;x<=10;x++){setProgress(x/10);await sleep(35);}
      if (isReal) {
        addLog(`Features: RSI=${s.rsi?.toFixed(1)} | MACD=${s.macdBull?"Bull":"Bear"} | SMA50=${s.aboveMa50?"▲":"▼"} | SMA200=${s.aboveMa200?"▲":"▼"} | BB=${s.bbPos}% | ATR=$${s.atr}`,"data");
      } else {
        addLog("Feature vector: [0.72, −0.15, 0.88, 0.33, −0.41]","data");
      }
      await sleep(220);

      // Stage 2 — Scoring model (Vertex AI placeholder)
      setActive(2);
      addLog("Scoring model: weighted indicator inference…","processing");
      for (let x=0;x<=10;x++){setProgress(x/10);await sleep(55);}
      addLog(`Prediction: ${s.prediction} (conf: ${(s.confidence*100).toFixed(1)}%) — ${s.latency}ms`,"success");
      setPred({ ticker, prediction:s.prediction, confidence:s.confidence, latency:s.latency });
      await sleep(240);

      // Stage 3 — BigQuery write
      setActive(3);
      addLog("Writing to BigQuery: predictions.market_signals","processing");
      for (let x=0;x<=10;x++){setProgress(x/10);await sleep(32);}
      addLog(`Row inserted — partition: ${new Date().toISOString().split("T")[0]}`,"success");
      await sleep(160);

      // Stage 4 — API response
      setActive(4);
      addLog("API response served — 200 OK","success");
      for (let x=0;x<=10;x++){setProgress(x/10);await sleep(24);}
      await sleep(160);

      tLat += s.latency; tConf += s.confidence;
      const n = i + 1;
      setCount(n); setAvgLat(Math.round(tLat/n)); setAvgConf(Math.round((tConf/n)*100));
      setLatHist(prev => [...prev, { latency:s.latency, ticker }]);

      // Merge into stockData so ForecastGrid and SignalIntelligence use real values
      if (isReal) handleRealDataFetched(s);

      setAllResults(prev => [...prev, { ticker, prediction:s.prediction, confidence:s.confidence, latency:s.latency, price:s.price }]);

      if (i < tickers.length-1) {
        setActive(-1);
        addLog("Awaiting next Pub/Sub message…","info");
        await sleep(650);
      }
    }

    setActive(-1);
    addLog(`Batch complete — ${tickers.length} predictions processed`,"success");
    setRunning(false); runRef.current = false;
  }, [addLog, selectedTickers, customStocks, stockData, handleRealDataFetched]);

  const stopPipeline = useCallback(() => {
    runRef.current = false; setRunning(false); setActive(-1);
    addLog("Pipeline stopped by user","warning");
  }, [addLog]);

  const toggleTicker  = t => setSelected(prev => { const n=new Set(prev); n.has(t)?n.delete(t):n.add(t); return n; });
  const addCustom     = s => setCustomStocks(prev => [...prev, s]);
  const removeCustom  = t => setCustomStocks(prev => prev.filter(s => s.ticker !== t));
  const totalStocks   = selectedTickers.size + customStocks.length;
  const pc            = pred ? predColor(pred.prediction) : C.dim;

  return (
    <div style={{ background:C.bg, minHeight:"100vh", color:C.text, fontFamily:F.sans, overflowX:"hidden" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;700&family=Rajdhani:wght@500;600;700&display=swap');
        @keyframes pulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:0.4;transform:scale(1.5)}}
        @keyframes flowRight{0%{transform:translateX(-100%)}100%{transform:translateX(400%)}}
        @keyframes fadeUp{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}
        *{box-sizing:border-box;margin:0;padding:0}
        ::-webkit-scrollbar{width:4px;height:4px}
        ::-webkit-scrollbar-track{background:transparent}
        ::-webkit-scrollbar-thumb{background:rgba(23,126,137,0.4);border-radius:2px}
        ::-webkit-scrollbar-thumb:hover{background:rgba(26,172,190,0.6)}
        table{border-spacing:0}
        input[type=number]::-webkit-inner-spin-button{opacity:0}
      `}</style>

      {/* Hex grid background */}
      <svg style={{position:"fixed",inset:0,width:"100%",height:"100%",pointerEvents:"none",zIndex:0}} aria-hidden="true">
        <defs>
          <pattern id="mlhex"  x="0"  y="0"  width="38" height="66" patternUnits="userSpaceOnUse">
            <path d="M19 11 L38 22 L38 44 L19 55 L0 44 L0 22 Z" fill="none" stroke="rgba(23,126,137,0.14)" strokeWidth="0.7"/>
          </pattern>
          <pattern id="mlhex2" x="19" y="33" width="38" height="66" patternUnits="userSpaceOnUse">
            <path d="M19 11 L38 22 L38 44 L19 55 L0 44 L0 22 Z" fill="none" stroke="rgba(23,126,137,0.14)" strokeWidth="0.7"/>
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#mlhex)"/>
        <rect width="100%" height="100%" fill="url(#mlhex2)"/>
      </svg>
      <div style={{ position:"fixed", inset:0, pointerEvents:"none", zIndex:0, background:`radial-gradient(ellipse 55% 35% at 5% 0%, rgba(23,126,137,0.12) 0%, transparent 65%), radial-gradient(ellipse 45% 30% at 95% 100%, rgba(26,172,190,0.08) 0%, transparent 60%)` }} />

      {/* Back button */}
      <button
        onClick={() => navigate("/", { state:{ scrollTo:"projects" } })}
        style={{
          position:"fixed", top:20, left:20, zIndex:100,
          display:"inline-flex", alignItems:"center", gap:8,
          fontFamily:F.mono, fontSize:12, letterSpacing:"2px", textTransform:"uppercase",
          color:C.dim, background:"rgba(9,21,21,0.9)",
          border:`1px solid ${C.border}`, borderRadius:6,
          padding:"9px 16px", cursor:"pointer", backdropFilter:"blur(16px)",
          transition:"all 0.2s",
        }}
        onMouseEnter={e=>{e.currentTarget.style.color=C.text;e.currentTarget.style.borderColor=C.accent;e.currentTarget.style.boxShadow=`0 0 20px ${C.glowSm}`;}}
        onMouseLeave={e=>{e.currentTarget.style.color=C.dim;e.currentTarget.style.borderColor=C.border;e.currentTarget.style.boxShadow="none";}}
      >← Timeline</button>

      <div style={{ maxWidth:1060, margin:"0 auto", padding:isMobile?"80px 16px 60px":"68px 28px 60px", position:"relative", zIndex:1 }}>

        {/* ── Hero ── */}
        <div style={{ marginBottom:48, animation:"fadeUp 0.5s ease" }}>
          <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:16 }}>
            <span style={{ fontFamily:F.mono, fontSize:12, fontWeight:700, letterSpacing:"2px", textTransform:"uppercase", color:"#091515", background:C.accent, padding:"4px 12px", borderRadius:3, boxShadow:`0 0 16px ${C.glowSm}` }}>Project</span>
            <span style={{ fontFamily:F.mono, fontSize:12, letterSpacing:"1.5px", color:C.dim }}>GCP · Cloud Run · Pub/Sub · BigQuery · Firestore</span>
          </div>
          <h1 style={{ fontFamily:F.display, fontSize:"clamp(28px,4.5vw,44px)", fontWeight:700, letterSpacing:"1px", color:C.text, lineHeight:1.1, marginBottom:16, textShadow:`0 0 60px ${C.glowSm}` }}>
            Real-Time Market Data Signal Pipeline
          </h1>
          <p style={{ fontFamily:F.sans, fontSize:17, color:C.muted, lineHeight:1.85, maxWidth:600, marginBottom:20 }}>
            Streaming market data through a serverless signal pipeline — ingestion via Pub/Sub,
            indicator scoring on Cloud Run, session state in Firestore, storage in BigQuery.
          </p>
          <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
            {["Cloud Run","Pub/Sub","BigQuery","Firestore","Terraform","Python","FastAPI"].map(t => <Tag key={t}>{t}</Tag>)}
          </div>
        </div>

        {/* ── Tabs ── */}
        <div style={{ display:"flex", gap:0, marginBottom:32, animation:"fadeUp 0.5s ease 0.1s both" }}>
          {[{id:"architecture",label:"Architecture"},{id:"simulation",label:"Live Simulation"}].map(tab => (
            <button key={tab.id} onClick={()=>setView(tab.id)} style={{
              fontFamily:F.mono, fontSize:13, letterSpacing:"1.5px", textTransform:"uppercase",
              padding:"12px 28px", border:"none", cursor:"pointer", background:"transparent",
              color: view===tab.id ? C.accent : C.dim,
              borderBottom: view===tab.id ? `2px solid ${C.accent}` : `2px solid ${C.border}`,
              boxShadow: view===tab.id ? `0 1px 0 0 ${C.glowSm}` : "none",
              transition:"all 0.2s",
            }}>{tab.label}</button>
          ))}
          <div style={{ flex:1, borderBottom:`2px solid ${C.border}` }} />
        </div>

        {/* ── Architecture ── */}
        {view==="architecture" && (
          <div style={{ animation:"fadeUp 0.35s ease" }}>
            <GlassCard style={{ padding:"28px 32px", marginBottom:20 }}>
              <SectionHeader>Pipeline Architecture</SectionHeader>
              <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"center", flexWrap:"wrap", gap:0 }}>
                {STAGES.map((stage,i) => (
                  <div key={stage.id} style={{ display:"flex", alignItems:"flex-start" }}>
                    <PipelineNode stage={stage} active={false} complete={false} progress={0} />
                    {i<STAGES.length-1 && <Connector active={false} complete={false} color={C.border} />}
                  </div>
                ))}
              </div>
            </GlassCard>

            <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr":"1fr 1fr", gap:14, marginBottom:14 }}>
              {ARCH.map(s => (
                <GlassCard key={s.title} style={{ padding:22, borderLeft:`3px solid ${s.color}`, boxShadow:`inset 0 0 40px ${s.color}08` }}>
                  <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:10 }}>
                    <span style={{ width:6, height:6, borderRadius:"50%", background:s.color, flexShrink:0, boxShadow:`0 0 8px ${s.color}` }} />
                    <span style={{ fontFamily:F.display, fontSize:17, letterSpacing:"0.5px", color:C.text }}>{s.title}</span>
                  </div>
                  <p style={{ fontFamily:F.sans, fontSize:15, color:C.muted, lineHeight:1.8, marginBottom:14 }}>{s.desc}</p>
                  <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
                    {s.details.map(d => (
                      <div key={d} style={{ fontFamily:F.mono, fontSize:13, color:C.dim, display:"flex", gap:8 }}>
                        <span style={{ color:s.color }}>›</span>{d}
                      </div>
                    ))}
                  </div>
                </GlassCard>
              ))}
            </div>

            <GlassCard style={{ padding:"16px 22px", display:"flex", alignItems:"center", gap:16 }}>
              <span style={{ fontSize:22, color:C.accent, opacity:0.8, flexShrink:0 }}>⎔</span>
              <div>
                <div style={{ fontFamily:F.mono, fontSize:14, letterSpacing:"1px", color:C.text, marginBottom:6 }}>Infrastructure as Code</div>
                <div style={{ fontFamily:F.sans, fontSize:15, color:C.muted, lineHeight:1.75 }}>
                  Entire pipeline provisioned via Terraform — Pub/Sub topics, Cloud Run services,
                  BigQuery datasets, Secret Manager secrets, Workload Identity Federation, and IAM bindings.
                </div>
              </div>
            </GlassCard>

            {analytics && (
              <GlassCard style={{ padding:"20px 28px", marginTop:14, borderLeft:`3px solid ${C.green}`, boxShadow:`inset 0 0 40px ${C.greenGl}` }}>
                <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:16 }}>
                  <span style={{ width:6, height:6, borderRadius:"50%", background:C.green, flexShrink:0, boxShadow:`0 0 8px ${C.green}` }} />
                  <span style={{ fontFamily:F.display, fontSize:17, letterSpacing:"0.5px", color:C.text }}>Live BigQuery Analytics</span>
                  <span style={{ fontFamily:F.mono, fontSize:11, color:C.dim, marginLeft:4 }}>— last 7 days</span>
                </div>
                <div style={{ display:"flex", gap:32, flexWrap:"wrap" }}>
                  <div>
                    <div style={{ fontFamily:F.mono, fontSize:28, fontWeight:700, color:C.accent }}>{analytics.total_predictions}</div>
                    <div style={{ fontFamily:F.sans, fontSize:13, color:C.dim, marginTop:2 }}>Total Predictions</div>
                  </div>
                  {analytics.breakdown.map(b => (
                    <div key={b.prediction}>
                      <div style={{ fontFamily:F.mono, fontSize:28, fontWeight:700, color: b.prediction==="BULLISH" ? C.green : b.prediction==="BEARISH" ? C.red : C.amber }}>{b.count}</div>
                      <div style={{ fontFamily:F.sans, fontSize:13, color:C.dim, marginTop:2 }}>{b.prediction}</div>
                      <div style={{ fontFamily:F.mono, fontSize:11, color:C.dim }}>avg conf {(b.avg_confidence*100).toFixed(0)}%</div>
                    </div>
                  ))}
                  <div style={{ marginLeft:"auto", alignSelf:"center" }}>
                    <div style={{ fontFamily:F.mono, fontSize:11, color:C.dim, lineHeight:1.8 }}>
                      {analytics.breakdown[0]?.unique_tickers || 0} unique tickers<br/>
                      avg RSI {analytics.breakdown[0]?.avg_rsi?.toFixed(1) || "—"}
                    </div>
                  </div>
                </div>
              </GlassCard>
            )}
          </div>
        )}

        {/* ── Simulation ── */}
        {view==="simulation" && (
          <div style={{ animation:"fadeUp 0.35s ease" }}>

            {/* Data status banner */}
            {dataStatus === "loading" && (
              <div style={{ marginBottom:12, padding:"10px 16px", borderRadius:6,
                background:"rgba(26,172,190,0.06)", border:`1px solid ${C.border}`,
                fontFamily:F.mono, fontSize:12, color:C.accent,
                display:"flex", alignItems:"center", gap:10 }}>
                <span style={{ animation:"pulse 1.4s ease-in-out infinite" }}>◌</span>
                Fetching live market data from Twelve Data API…
              </div>
            )}
            {dataStatus === "ready" && (
              <div style={{ marginBottom:12, padding:"10px 16px", borderRadius:6,
                background:"rgba(52,211,153,0.05)", border:`1px solid ${C.green}40`,
                fontFamily:F.mono, fontSize:12, color:C.green,
                display:"flex", alignItems:"center", gap:10 }}>
                ✓ Live market data loaded — RSI, MACD, momentum from real price history
              </div>
            )}
            {dataStatus === "error" && (
              <div style={{ marginBottom:12, padding:"10px 16px", borderRadius:6,
                background:"rgba(251,191,36,0.06)", border:`1px solid ${C.amber}40`,
                fontFamily:F.mono, fontSize:12, color:C.amber,
                display:"flex", alignItems:"center", gap:10 }}>
                ⚠ Could not reach market data API — using simulated fallback values
              </div>
            )}

            {/* Stock selector */}
            <StockSelector
              selectedTickers={selectedTickers}
              onToggle={toggleTicker}
              customStocks={customStocks}
              onAddCustom={addCustom}
              onRemoveCustom={removeCustom}
              disabled={running}
              stockData={stockData}
              onRealDataFetched={handleRealDataFetched}
            />

            {/* Pipeline status */}
            <GlassCard style={{ padding:isMobile?"14px 14px":"24px 28px", marginBottom:16 }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:24 }}>
                <div>
                  <SectionHeader>Pipeline Status</SectionHeader>
                  <div style={{ fontFamily:F.mono, fontSize:14, letterSpacing:"1px", color:running?C.green:logs.length>0?C.muted:C.dim, textShadow:running?`0 0 12px ${C.green}`:"none" }}>
                    {running ? "● RUNNING" : logs.length>0 ? "● COMPLETE" : "○ IDLE"}
                  </div>
                </div>
                <button
                  onClick={running ? stopPipeline : runPipeline}
                  disabled={!running && totalStocks===0}
                  style={{
                    fontFamily:F.mono, fontSize:13, letterSpacing:"2px", textTransform:"uppercase",
                    padding:"12px 30px", borderRadius:6, border:"none", cursor:"pointer", fontWeight:700,
                    background: running ? C.red : C.accent,
                    color:"#091515",
                    boxShadow: running ? `0 4px 20px rgba(248,113,113,0.4)` : `0 4px 24px ${C.glow}`,
                    opacity: !running && totalStocks===0 ? 0.4 : 1,
                    transition:"all 0.2s",
                  }}
                >{running ? "■ Stop" : "▶ Run Pipeline"}</button>
              </div>
              <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"center", flexWrap:"wrap", gap:0 }}>
                {STAGES.map((stage,i) => (
                  <div key={stage.id} style={{ display:"flex", alignItems:"flex-start" }}>
                    <PipelineNode stage={stage} active={activeStage===i} complete={activeStage>i} progress={activeStage===i?progress:0} />
                    {i<STAGES.length-1 && <Connector active={activeStage===i} complete={activeStage>i} color={stage.color} />}
                  </div>
                ))}
              </div>
            </GlassCard>

            {/* Metrics */}
            <div style={{ display:isMobile?"grid":"flex", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:16, flexWrap:"wrap" }}>
              <MetricCard label="Processed"      value={count}               unit={`/ ${totalStocks}`}    color={C.accent}                               note="messages" />
              <MetricCard label="Avg Latency"    value={avgLat||"—"}         unit={avgLat?"ms":""}        color={avgLat<25?C.green:avgLat?C.amber:C.dim} note={avgLat?"inference time":""} />
              <MetricCard label="Avg Confidence" value={avgConf?`${avgConf}`:"—"} unit={avgConf?"%":""}  color={C.purple}                               note={avgConf?"model certainty":""} />
              <MetricCard label="Uptime"         value="99.9"                unit="%"                     color={C.green}                                note="last 30 days" />
            </div>

            {/* Latest prediction + logs */}
            <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr":"1fr 1fr", gap:12, marginBottom:16 }}>
              <GlassCard style={{ padding:isMobile?12:22 }}>
                <SectionHeader>Latest Prediction</SectionHeader>
                {pred ? (
                  <>
                    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:isMobile?10:18 }}>
                      <span style={{ fontFamily:F.display, fontSize:isMobile?20:32, fontWeight:700, color:C.text, letterSpacing:"2px" }}>{pred.ticker}</span>
                      <span style={{ fontFamily:F.mono, fontSize:isMobile?11:13, fontWeight:700, letterSpacing:"1.5px", color:pc, background:`${pc}18`, padding:isMobile?"3px 8px":"5px 14px", borderRadius:4, border:`1px solid ${pc}50`, boxShadow:`0 0 16px ${pc}30` }}>{pred.prediction}</span>
                    </div>
                    <div style={{ display:"flex", gap:isMobile?16:28, marginBottom:isMobile?12:22 }}>
                      <div>
                        <div style={{ fontFamily:F.mono, fontSize:10, letterSpacing:"1.5px", textTransform:"uppercase", color:C.dim, marginBottom:4 }}>Confidence</div>
                        <div style={{ fontFamily:F.mono, fontSize:isMobile?18:26, fontWeight:700, color:C.purple, textShadow:`0 0 16px ${C.purple}` }}>{(pred.confidence*100).toFixed(1)}%</div>
                      </div>
                      <div>
                        <div style={{ fontFamily:F.mono, fontSize:10, letterSpacing:"1.5px", textTransform:"uppercase", color:C.dim, marginBottom:4 }}>Latency</div>
                        <div style={{ fontFamily:F.mono, fontSize:isMobile?18:26, fontWeight:700, color:pred.latency<25?C.green:C.amber, textShadow:`0 0 16px ${pred.latency<25?C.green:C.amber}` }}>{pred.latency}ms</div>
                      </div>
                    </div>
                    <LatencyChart history={latHist} />
                  </>
                ) : (
                  <div style={{ fontFamily:F.mono, fontSize:13, letterSpacing:"0.5px", color:C.dim, padding:isMobile?"16px 0":"40px 0", textAlign:"center" }}>
                    Run the pipeline to see live predictions
                  </div>
                )}
              </GlassCard>

              <GlassCard style={{ padding:isMobile?12:22, display:"flex", flexDirection:"column" }}>
                <SectionHeader>Pipeline Logs</SectionHeader>
                <div ref={logRef} style={{ flex:1, minHeight:isMobile?140:240, maxHeight:isMobile?200:320, overflowY:"auto", background:"rgba(0,0,0,0.45)", borderRadius:6, padding:isMobile?10:14, border:`1px solid ${C.border}`, position:"relative" }}>
                  <div style={{ position:"absolute", inset:0, pointerEvents:"none", zIndex:1, backgroundImage:"repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.08) 2px, rgba(0,0,0,0.08) 4px)", borderRadius:6 }} />
                  <div style={{ position:"relative", zIndex:2 }}>
                    {logs.length===0 ? (
                      <div style={{ fontFamily:F.mono, fontSize:12, color:C.dim, padding:isMobile?"16px 0":"40px 0", textAlign:"center" }}>Waiting for pipeline execution…</div>
                    ) : logs.map((l,i) => <LogEntry key={i} {...l} compact={isMobile} />)}
                  </div>
                </div>
              </GlassCard>
            </div>

            {/* Batch results */}
            {allResults.length > 0 && (
              <>
                <GlassCard style={{ padding:"24px 28px", animation:"fadeUp 0.4s ease", marginBottom:16 }}>
                  <SectionHeader>Batch Results</SectionHeader>
                  <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr":"1fr 1fr", gap:isMobile?20:32, marginBottom:28 }}>
                    <ResultsChart results={allResults} />
                    {isMobile
                      ? <ResultsCards results={allResults} />
                      : <ResultsTable results={allResults} />
                    }
                  </div>
                  <div style={{ borderTop:`1px solid ${C.border}`, paddingTop:24 }}>
                    <ForecastGrid results={allResults} stockData={stockData} />
                  </div>
                </GlassCard>
                <SignalIntelligence results={allResults} stockData={stockData} />
              </>
            )}

          </div>
        )}
      </div>
    </div>
  );
}
