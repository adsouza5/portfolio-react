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
  const [v, setV] = useState(() => window.innerWidth <= 768 || window.innerHeight <= 500);
  useEffect(() => {
    const fn = () => setV(window.innerWidth <= 768 || window.innerHeight <= 500);
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
  { ticker:"AAPL", price:211.0,  volume:14200000 },
  { ticker:"TSLA", price:278.0,  volume:41000000 },
  { ticker:"MSFT", price:432.0,  volume:9800000  },
  { ticker:"NVDA", price:112.0,  volume:48000000 },
  { ticker:"AMZN", price:205.0,  volume:17500000 },
  { ticker:"META", price:585.0,  volume:19800000 },
];

const ARCH = [
  { title:"Data Ingestion",    color:C.accent, desc:"Pub/Sub topic receives streaming market data events. Cloud Functions trigger on new messages, batching for throughput.", details:["Message ordering guarantees","Dead-letter queue for failures","Auto-scaling subscribers"] },
  { title:"Preprocessing",     color:C.amber,  desc:"Cloud Run service normalises raw data into feature vectors. Stateless containers scale to zero when idle.",               details:["Feature normalisation pipeline","Schema validation","Scale-to-zero cost optimisation"] },
  { title:"ML Inference",      color:C.purple, desc:"Cloud Run extracts RSI(14), MACD(12/26/9), SMA50/200, Bollinger Bands, and ATR from 252 days of OHLCV data. A trained ML classifier runs inference on these feature vectors to produce BULLISH/BEARISH/NEUTRAL signals with confidence scores.", details:["Trained ML classifier","Feature vector from 252-day OHLCV","Confidence-scored predictions"] },
  { title:"Storage & Serving", color:C.green,  desc:"Predictions land in BigQuery partitioned by date. Firestore stores async session state across the Pub/Sub flow. FastAPI on Cloud Run serves real-time results and live analytics.", details:["BigQuery partitioned by date","Firestore async session store","Sub-second API responses"] },
];

/* ── Backend API (Cloud Run) ─────────────────────────────────── */
const API_URL = process.env.REACT_APP_API_URL || 'https://ml-pipeline-api-cpktdw5swq-uc.a.run.app';

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

/* ── Box-Muller normal sample (seeded RNG) ───────────────────── */
function boxMuller(rng) {
  const u = Math.max(1e-10, rng()), v = rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

/* ── GBM forecast with ±1σ confidence band ───────────────────── */
function generateForecast(stock, volatility, days = 14) {
  let s = stock.ticker.toUpperCase().split("").reduce((a, c) => (a * 31 + c.charCodeAt(0)) & 0xffff, 7);
  const rng = () => { s = Math.imul(s, 1664525) + 1013904223 | 0; return (s >>> 0) / 0xffffffff; };
  const direction  = stock.prediction === "BULLISH" ? 1 : stock.prediction === "BEARISH" ? -1 : 0;
  const dailySigma = volatility || 0.018;
  const dailyMu    = direction * stock.confidence * 0.003;

  const central = [stock.price], upper = [stock.price], lower = [stock.price];
  for (let i = 1; i <= days; i++) {
    const z = boxMuller(rng);
    central.push(Math.max(0.01, central[i-1] * Math.exp(dailyMu + dailySigma * z)));
    upper.push(Math.max(0.01,   upper[i-1]   * Math.exp(dailyMu + dailySigma * 1.0)));
    lower.push(Math.max(0.01,   lower[i-1]   * Math.exp(dailyMu - dailySigma * 1.0)));
  }
  const fmt = p => parseFloat(p.toFixed(2));
  return { points: central.map(fmt), upper: upper.map(fmt), lower: lower.map(fmt) };
}

/* ── Deterministic fallback ──────────────────────────────────── */
function simulateStock(ticker) {
  const hash = ticker.toUpperCase().split("").reduce((a, c) => (a * 31 + c.charCodeAt(0)) & 0xffff, 7);
  const confidence  = parseFloat((0.60 + (hash % 35) / 100).toFixed(2));
  const latency     = 17 + (hash % 24);
  const predictions = ["BULLISH","BEARISH","NEUTRAL"];
  const price       = parseFloat((20 + (hash % 980) + ((hash >> 4) % 100) / 100).toFixed(2));
  const volume      = (5 + (hash % 65)) * 1_000_000;
  return { prediction: predictions[hash % 3], confidence, latency, price, volume };
}

const predColor = p => p === "BULLISH" ? C.green : p === "BEARISH" ? C.red : C.amber;

/* ── Data-aware catalyst line ────────────────────────────────── */
function buildCatalyst(stock, sig) {
  const { rsi, macdBull, aboveMa50, aboveMa200, bbPos, volDelta, atr } = sig;
  const isBull = stock.prediction === "BULLISH";
  const isBear = stock.prediction === "BEARISH";
  if (isBull) {
    if (rsi !== null && rsi < 32)           return `RSI at ${rsi.toFixed(1)} — deeply oversold. The sellers are exhausted and the bounce is overdue.`;
    if (macdBull && aboveMa200)             return `MACD bullish crossover confirmed above the 200-day MA. Trend and momentum are aligned.`;
    if (volDelta !== null && volDelta > 20) return `Volume running ${volDelta}% above the 20-day average. Real buyers are showing up — this isn't retail noise.`;
    if (bbPos !== null && bbPos > 72)       return `Pushing the upper Bollinger Band at ${bbPos}% — momentum is in full control and the band is expanding.`;
    if (!aboveMa200 && aboveMa50)           return `Reclaimed the 50-day MA — first structural step toward recovery. The 200-day is the next test.`;
    if (atr !== null && atr < 2)            return `ATR at $${atr} — low volatility setup. These quiet periods often precede the sharpest moves.`;
    return `Clean setup across the board. Momentum positive, trend intact, no major resistance overhead.`;
  }
  if (isBear) {
    if (rsi !== null && rsi > 68)           return `RSI at ${rsi.toFixed(1)} — overbought and starting to roll. The buyers are running out of fuel.`;
    if (!macdBull)                          return `MACD bearish crossover confirmed. Momentum has officially flipped to the downside.`;
    if (volDelta !== null && volDelta < -15) return `Volume running ${Math.abs(volDelta)}% below average. No buyers are stepping up — the bids have pulled.`;
    if (!aboveMa50)                         return `Lost the 50-day MA and failing to reclaim it. That level is now resistance, not support.`;
    if (bbPos !== null && bbPos < 22)       return `Pinned below the lower Bollinger Band at ${bbPos}%. That's sustained institutional selling, not a shakeout.`;
    return `Deteriorating across every signal. Price, momentum, and positioning all pointing the same direction.`;
  }
  if (bbPos !== null && bbPos > 45 && bbPos < 55) return `Dead center in the Bollinger Band at ${bbPos}%. Textbook compression — the expansion is coming, direction unknown.`;
  if (rsi !== null && rsi > 46 && rsi < 54)       return `RSI at ${rsi.toFixed(1)} — a coin flip by the numbers. Buyers and sellers in a genuine standoff.`;
  if (Math.abs(volDelta ?? 0) < 5)                 return `Volume essentially flat at ${volDelta ?? 0 > 0 ? '+' : ''}${volDelta ?? 0}%. Markets vote with size and right now nobody's voting.`;
  return `Mixed signals across the board — no edge, no position. Discipline over FOMO.`;
}

/* ── Data-aware trade thesis ─────────────────────────────────── */
function buildThesis(stock, sig) {
  const { rsi, macdBull, aboveMa50, aboveMa200, bbPos, volDelta, sentiment } = sig;
  const conf   = Math.round(stock.confidence * 100);
  const isBull = stock.prediction === "BULLISH";
  const isBear = stock.prediction === "BEARISH";

  if (isBull) {
    const rsiLine = rsi !== null && rsi < 35
      ? `RSI at ${rsi.toFixed(1)} puts ${stock.ticker} in oversold territory — historically that's exactly where reversals begin.`
      : `RSI at ${rsi !== null ? rsi.toFixed(1) : '—'} shows positive momentum with room to extend.`;
    const maLine = aboveMa200
      ? `Price is holding above both the 50 and 200-day moving averages — the trend structure is intact.`
      : aboveMa50
      ? `Above the 50-day and working back toward the 200-day. Partial confirmation, but the direction is right.`
      : `Still below key moving averages, but the signal is already pointing higher — this is the early stage.`;
    const macdLine = macdBull ? ` MACD is confirming bullish.` : "";
    const sentLine = sentiment !== null && sentiment > 20
      ? ` Sentiment is running at +${sentiment} — the mood around this name is shifting fast.`
      : sentiment !== null && sentiment < -10
      ? ` Sentiment is still negative at ${sentiment} but price is disconnecting upward — that divergence is worth watching.`
      : "";
    return `${rsiLine} ${maLine}${macdLine}${sentLine} At ${conf}% confidence, ${stock.ticker} is one of the stronger reads in this batch. We stay long until something structurally changes.`;
  }

  if (isBear) {
    const rsiLine = rsi !== null && rsi > 65
      ? `RSI at ${rsi.toFixed(1)} — overbought and beginning to crack. The buyers have run out of room.`
      : `RSI at ${rsi !== null ? rsi.toFixed(1) : '—'} and falling. The trend is clearly down.`;
    const maLine = !aboveMa50
      ? `${stock.ticker} is trading below the 50-day MA and failing every attempt to reclaim it. That level is now resistance.`
      : `Below the 200-day MA despite short-term bounces. The longer-term trend is broken.`;
    const volLine = volDelta !== null && volDelta < -10
      ? ` Volume ${Math.abs(volDelta)}% below average — the buyers have walked away.`
      : "";
    const sentLine = sentiment !== null && sentiment < -20
      ? ` Sentiment has collapsed to ${sentiment}. When the mood gets this negative it tends to feed on itself.`
      : "";
    return `${rsiLine} ${maLine}${volLine}${sentLine} ${conf}% confidence on the short side. We're not fighting this — we're riding it.`;
  }

  const rsiStr = rsi !== null ? rsi.toFixed(1) : '—';
  const bbStr  = bbPos !== null ? bbPos : '—';
  return `${stock.ticker} is in no-man's-land at ${conf}% confidence. RSI at ${rsiStr}, Bollinger position at ${bbStr}% — neither at an extreme that signals anything directional. The market hasn't decided yet, and we don't try to decide for it. Watchlist until something breaks.`;
}

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

  const sig = { rsi, volDelta, sentiment, macdBull, aboveMa50, aboveMa200, bbPos, atr };
  const catalyst = buildCatalyst(stock, sig);
  const thesis   = buildThesis(stock, sig);

  return { rsi, volDelta, sentiment, macdBull, aboveMa50, aboveMa200, bbPos, atr, catalyst, thesis };
}

/* ── Sub-components ──────────────────────────────────────────── */

function GlassCard({ children, style, accent, topColor }) {
  const tc = topColor || (accent ? C.accent : null);
  return (
    <div style={{
      background: C.card,
      border: `1px solid ${accent ? C.borderBr : C.border}`,
      borderRadius: 8,
      backdropFilter: "blur(10px)",
      boxShadow: `0 4px 24px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.06)`,
      position: "relative",
      overflow: "hidden",
      ...style,
    }}>
      {tc && (
        <div style={{
          position:"absolute", top:0, left:0, right:0, height:2, zIndex:1,
          background:`linear-gradient(90deg, ${tc}, transparent)`,
          boxShadow:`0 0 8px ${tc}60`,
        }} />
      )}
      {children}
    </div>
  );
}

function SectionHeader({ children, color }) {
  return (
    <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:22 }}>
      <div style={{ width:3, height:20, background:color||C.accent, borderRadius:2, boxShadow:`0 0 10px ${color||C.glow}`, flexShrink:0 }} />
      <span style={{ fontFamily:F.mono, fontSize:11, letterSpacing:"0.18em", textTransform:"uppercase", color:C.text, fontWeight:700 }}>
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
                  <td style={{ fontFamily:F.mono, fontSize:13, fontWeight:700, color:C.text, padding:"9px 10px" }}>
                    {r.ticker}
                    {!r.isReal && (
                      <span style={{ fontFamily:F.mono, fontSize:8, letterSpacing:"1px", color:C.amber, background:"rgba(251,191,36,0.12)", border:`1px solid rgba(251,191,36,0.3)`, borderRadius:2, padding:"1px 5px", marginLeft:6 }}>SIM</span>
                    )}
                  </td>
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
              <span style={{ fontFamily:F.mono, fontSize:14, fontWeight:700, color:C.text, width:46 }}>
                {r.ticker}
                {!r.isReal && (
                  <span style={{ fontFamily:F.mono, fontSize:8, letterSpacing:"1px", color:C.amber, background:"rgba(251,191,36,0.12)", border:`1px solid rgba(251,191,36,0.3)`, borderRadius:2, padding:"1px 5px", marginLeft:6 }}>SIM</span>
                )}
              </span>
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
  const W = 200, H = 62;
  return (
    <div>
      <div style={{ display:"flex", alignItems:"center", gap:16, marginBottom:16 }}>
        <div style={{ fontFamily:F.mono, fontSize:11, letterSpacing:"2px", textTransform:"uppercase", color:C.dim }}>14-Day GBM Forecast</div>
        <div style={{ display:"flex", alignItems:"center", gap:12, marginLeft:"auto" }}>
          <div style={{ display:"flex", alignItems:"center", gap:5 }}>
            <div style={{ width:20, height:2, background:"rgba(255,255,255,0.25)", borderRadius:1 }} />
            <span style={{ fontFamily:F.mono, fontSize:9, color:C.dim }}>±1σ band</span>
          </div>
          <div style={{ display:"flex", alignItems:"center", gap:5 }}>
            <div style={{ width:20, height:1.5, background:C.accent, borderRadius:1 }} />
            <span style={{ fontFamily:F.mono, fontSize:9, color:C.dim }}>central path</span>
          </div>
        </div>
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(195px, 1fr))", gap:12 }}>
        {results.map(r => {
          const volatility = stockData[r.ticker]?.volatility;
          const fc   = generateForecast(r, volatility);
          const col  = predColor(r.prediction);
          const end  = fc.points[fc.points.length - 1];
          const endU = fc.upper[fc.upper.length - 1];
          const endL = fc.lower[fc.lower.length - 1];
          const pct  = (end - r.price) / r.price * 100;
          const sign = pct >= 0 ? "+" : "";

          const allVals = [...fc.points, ...fc.upper, ...fc.lower];
          const lo  = Math.min(...allVals), hi = Math.max(...allVals);
          const pad = (hi - lo) * 0.10 || 1;
          const range = hi - lo + pad * 2;
          const toX = i => ((i / (fc.points.length - 1)) * W).toFixed(1);
          const toY = v => (H - ((v - lo + pad) / range) * H).toFixed(1);

          const n = fc.points.length;
          const centralLine = fc.points.map((p, i) => `${toX(i)},${toY(p)}`).join(" ");
          const bandPoly    = [
            ...fc.upper.map((p, i) => `${toX(i)},${toY(p)}`),
            ...[...fc.lower].reverse().map((p, i) => `${toX(n - 1 - i)},${toY(p)}`),
          ].join(" ");
          const areaFill = `0,${H} ${centralLine} ${W},${H}`;
          const baseY    = toY(r.price);
          const id       = `fcg-${r.ticker}`;

          return (
            <div key={r.ticker} style={{
              background:"rgba(0,0,0,0.28)",
              border:`1px solid ${col}30`,
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
                    <stop offset="0%" stopColor={col} stopOpacity="0.22" />
                    <stop offset="100%" stopColor={col} stopOpacity="0.01" />
                  </linearGradient>
                  <linearGradient id={`${id}b`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={col} stopOpacity="0.09" />
                    <stop offset="100%" stopColor={col} stopOpacity="0.03" />
                  </linearGradient>
                </defs>
                {/* entry price baseline */}
                <line x1="0" y1={baseY} x2={W} y2={baseY} stroke={C.border} strokeWidth="0.7" strokeDasharray="3,3" />
                {/* ±1σ confidence band */}
                <polygon points={bandPoly} fill={`url(#${id}b)`} />
                {/* band boundary lines */}
                <polyline points={fc.upper.map((p,i)=>`${toX(i)},${toY(p)}`).join(" ")} fill="none" stroke={`${col}35`} strokeWidth="0.8" strokeDasharray="2,3" />
                <polyline points={fc.lower.map((p,i)=>`${toX(i)},${toY(p)}`).join(" ")} fill="none" stroke={`${col}35`} strokeWidth="0.8" strokeDasharray="2,3" />
                {/* central path fill + line */}
                <polygon points={areaFill} fill={`url(#${id})`} />
                <polyline points={centralLine} fill="none" stroke={col} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                {/* terminal dot with glow */}
                <circle cx={toX(n-1)} cy={toY(end)} r="3.5" fill={col} opacity="0.25" />
                <circle cx={toX(n-1)} cy={toY(end)} r="2"   fill={col} />
              </svg>

              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginTop:5 }}>
                <span style={{ fontFamily:F.mono, fontSize:9, color:C.dim }}>Now</span>
                <span style={{ fontFamily:F.mono, fontSize:9, color:C.dim, opacity:0.55 }}>
                  ${endL.toLocaleString()} – ${endU.toLocaleString()}
                </span>
                <span style={{ fontFamily:F.mono, fontSize:9, color:C.dim }}>+14d</span>
              </div>
            </div>
          );
        })}
      </div>
      <div style={{ fontFamily:F.mono, fontSize:10, color:C.dim, marginTop:10, opacity:0.45 }}>
        GBM simulation using real volatility (σ) from Twelve Data. Central path + ±1σ confidence band. Not financial advice.
      </div>
    </div>
  );
}

function SignalIntelligence({ results, stockData }) {
  const isMobile = useIsPhoneViewport();
  return (
    <GlassCard style={{ padding: isMobile ? "14px 14px" : "24px 28px", animation:"fadeUp 0.4s ease both" }} topColor={C.purple}>
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
          <strong>Live ML inference on real market data.</strong> Technical indicators (RSI, MACD, Bollinger Bands, ATR) are fetched from Twelve Data API and run through a trained classifier to produce BULLISH / BEARISH / NEUTRAL signals with confidence scores.
          Not financial advice — don't trade on this.
        </span>
      </div>
    </GlassCard>
  );
}

function StockSelector({ selectedTickers, onToggle, customStocks, onAddCustom, onRemoveCustom, disabled, stockData, onRealDataFetched, isMobile }) {
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
    <GlassCard style={{ padding:"20px 24px", marginBottom:16 }} topColor={C.amber}>
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
          <div style={{ display:"flex", flexDirection:isMobile?"column":"row", alignItems:isMobile?"stretch":"center", gap:8 }}>
            <input
              placeholder="TICKER (e.g. GOOGL)"
              maxLength={6}
              value={ticker}
              onChange={e=>{ setTicker(e.target.value.toUpperCase().replace(/[^A-Z.]/g,"")); setQuote(null); setErr(""); }}
              onKeyDown={e=>{ if(e.key==="Enter") handleLookup(); }}
              style={{ ...inputStyle, flex:isMobile?undefined:1, width:isMobile?"100%":180, letterSpacing:"1.5px", fontWeight:700, height:isMobile?44:undefined }}
            />
            <div style={{ display:"flex", gap:8 }}>
              <button onClick={handleLookup} disabled={fetching||!ticker.trim()} style={{
                fontFamily:F.mono, fontSize:12, fontWeight:700, letterSpacing:"1px",
                padding:"7px 18px", borderRadius:4, border:"none",
                background: C.accent, color:"#091515",
                cursor: fetching||!ticker.trim() ? "not-allowed" : "pointer",
                opacity: fetching||!ticker.trim() ? 0.5 : 1,
                transition:"all 0.15s", flex:isMobile?1:undefined, minWidth:90,
                height:isMobile?44:undefined,
              }}>
                {fetching ? "Looking…" : "Lookup"}
              </button>
              <button onClick={handleCancel} style={{
                fontFamily:F.mono, fontSize:12, padding:"7px 14px", borderRadius:4,
                border:`1px solid ${C.border}`, background:"transparent", color:C.dim, cursor:"pointer",
                height:isMobile?44:undefined,
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

/* ── Model Card ──────────────────────────────────────────────── */
function ModelCard({ analytics, modelInfo, isMobile }) {
  // Real 8 features used by the Logistic Regression model
  const FEATURES = [
    { name:"RSI(14)",         key:"rsi",          group:"momentum",  desc:"Relative Strength Index over 14 periods. Primary momentum oscillator — identifies overbought (>70) and oversold (<30) conditions in price action." },
    { name:"MACD Signal",     key:"macd_bull",     group:"momentum",  desc:"MACD(12,26) minus signal line(9) — binary crossover direction. Encodes momentum shift; the most widely-watched momentum indicator." },
    { name:"5-Day Return %",  key:"ret5",          group:"momentum",  desc:"Price return over the last 5 trading days. Captures recent momentum directly — one of the strongest short-term predictors in classical TA literature." },
    { name:"Volume Δ%",       key:"vol_delta",     group:"volume",    desc:"% deviation from 20-day average volume. Distinguishes institutional moves (high volume) from low-conviction noise (low volume)." },
    { name:"SMA200 Position", key:"above_ma200",   group:"trend",     desc:"Binary: price above or below 200-day simple moving average. Core long-term trend filter used by institutional managers as a regime indicator." },
    { name:"SMA50 Position",  key:"above_ma50",    group:"trend",     desc:"Binary: price above or below 50-day moving average. Shorter-term trend confirmation, often used alongside SMA200 for trend alignment." },
    { name:"BB Position%",    key:"bb_pos",        group:"volatility",desc:"Price location within Bollinger Bands (0 = lower band, 100 = upper). Captures mean-reversion setups at extremes and breakout conditions at the bands." },
    { name:"Volatility (σ)",  key:"volatility",    group:"volatility",desc:"Daily log-return standard deviation over the trailing window. Used to normalise regime — a 1% move means something different in a 0.5% vol vs 2% vol environment." },
  ];
  // Note: ATR and Sentiment are computed and stored in BigQuery but are NOT model features.
  // Sentiment = round(ret5 * 6) — it is derived from ret5, not from NLP.

  const GC = { momentum:C.accent, sentiment:C.purple, volume:C.amber, trend:C.green, volatility:C.red };

  // Use real coefficients from /model-info if available, otherwise use equal weights as placeholder
  const featureImportance = modelInfo?.feature_importance
    ? FEATURES.map(f => {
        const fi = modelInfo.feature_importance.find(x => x.name === f.key);
        return { ...f, importance: fi ? Math.abs(fi.coefficient) : 0.05, coefficient: fi?.coefficient ?? null };
      })
    : FEATURES.map((f, i) => ({ ...f, importance: 0.14 - i * 0.01, coefficient: null }));
  const maxImp = Math.max(...featureImportance.map(f => f.importance));
  const total     = analytics?.total_predictions || 0;
  const breakdown = analytics?.breakdown || [];

  const TRAIN_STEPS = [
    { n:"01", title:"Data Collection",      desc:"252 trading days (1 calendar year) of OHLCV data per ticker via Twelve Data API. Rolling window — stalest day drops as new day arrives." },
    { n:"02", title:"Feature Engineering",  desc:"8 features computed per row: RSI(14), MACD(12,26,9) signal crossover (binary), SMA50 position (binary), SMA200 position (binary), Bollinger Band position (20,2), daily log-return volatility, 5-day return %, volume delta vs 20d avg." },
    { n:"03", title:"Labelling Strategy",   desc:"Binary next-day label: close[t+1] > close[t] → 1 (up), else 0 (down). Three-class signal derived at inference time by thresholding P(up). Labels derived purely from future prices — features computed strictly from past data (no lookahead)." },
    { n:"04", title:"TimeSeriesSplit CV",    desc:"sklearn TimeSeriesSplit(n_splits=5) — training window expands forward, each test fold is strictly future relative to its training window. Prevents lookahead bias. Previous version used StratifiedKFold(shuffle=True) which introduced data leakage; this was corrected." },
    { n:"05", title:"Model: Logistic Regression", desc:"sklearn LogisticRegression(C=0.5) with StandardScaler preprocessing. Binary classifier (next-day up/down). Three-class signal (BULLISH/BEARISH/NEUTRAL) derived by thresholding P(up): ≥0.55 → BULLISH, ≤0.45 → BEARISH, else NEUTRAL." },
    { n:"06", title:"Inference Deployment", desc:"Model serialised to Cloud Storage, loaded at Cloud Run startup. Predictions served via FastAPI async flow: Pub/Sub → Cloud Run → Firestore session → BigQuery logging." },
  ];

  const LIMITS = [
    { sev:"low",    title:"Legacy CV methodology (retrain pending)", desc:"Current model.joblib was trained with StratifiedKFold(shuffle=True), which introduces lookahead bias for time-series data. train.py has been updated to TimeSeriesSplit(n_splits=5). Retrain required to reflect corrected CV accuracy. Live outcome accuracy is now the primary performance signal." },
    { sev:"high",   title:"EMH and classical TA",             desc:"Efficient Market Hypothesis suggests classical technical indicators should not consistently predict excess returns above transaction costs. This model treats TA as a structured baseline — not a claim of sustained alpha generation. Performance claims require rigorous walk-forward backtesting with realistic costs." },
    { sev:"medium", title:"Uncalibrated confidence scores",   desc:"Confidence outputs are raw logistic regression sigmoid probabilities, not Platt-scaled or isotonic-regression calibrated. A displayed confidence of 84% does not imply the signal is correct 84% of the time. Calibration analysis requires resolved outcome data — now being tracked." },
    { sev:"medium", title:"Sentiment is derived, not NLP",    desc:"Sentiment shown in Signal Intelligence is computed as round(ret5 × 6) — it is a rescaled 5-day return, not a real news or social sentiment score. It is stored in BigQuery for display but is NOT a model feature. A real NLP sentiment pipeline (e.g. FinBERT on earnings call transcripts) would be a meaningful upgrade." },
    { sev:"low",    title:"Single-timeframe features",        desc:"All features are computed on daily OHLCV bars. Higher-frequency signals (order flow imbalance, level-2 depth, options skew) are not used. Model is unsuitable for intraday execution." },
    { sev:"low",    title:"Static labelling threshold",       desc:"The ±1.5% 5-day forward return threshold was chosen heuristically. Optimal threshold is regime-dependent — it should be tighter in low-volatility environments and wider in high-volatility ones." },
  ];
  const SC = { high:C.red, medium:C.amber, low:C.dim };

  return (
    <div style={{ animation:"fadeUp 0.35s ease both", display:"flex", flexDirection:"column", gap:16 }}>

      {/* Feature Engineering */}
      <GlassCard style={{ padding:isMobile?"14px":"26px 30px" }} topColor={C.accent}>
        <SectionHeader>Feature Engineering Pipeline</SectionHeader>
        <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:22, flexWrap:"wrap", justifyContent:"center" }}>
          {[
            { label:"252d OHLCV",     sub:"Twelve Data API", col:C.dim    },
            { label:"8 Indicators",   sub:"Cloud Run",       col:C.accent },
            { label:"Feature Vector", sub:"[x₁ … x₈]",      col:C.purple },
            { label:"LogReg",         sub:"Classifier",      col:C.green  },
            { label:"Signal + Conf",  sub:"BULL/BEAR/NEUT",  col:C.amber  },
          ].map((n, i, arr) => (
            <div key={n.label} style={{ display:"flex", alignItems:"center", gap:6 }}>
              <div style={{ textAlign:"center", background:"rgba(0,0,0,0.32)", border:`1px solid ${n.col}45`, borderRadius:6, padding:"9px 14px", minWidth:88 }}>
                <div style={{ fontFamily:F.mono, fontSize:11, fontWeight:700, color:n.col, letterSpacing:"0.3px" }}>{n.label}</div>
                <div style={{ fontFamily:F.mono, fontSize:9,  color:C.dim, marginTop:3, opacity:0.7 }}>{n.sub}</div>
              </div>
              {i < arr.length-1 && <span style={{ color:C.dim, fontSize:12, opacity:0.4 }}>→</span>}
            </div>
          ))}
        </div>
        <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
          {FEATURES.map(f => (
            <div key={f.name} style={{ display:"flex", alignItems:"flex-start", gap:12, padding:"10px 14px", background:"rgba(0,0,0,0.22)", borderRadius:6, borderLeft:`3px solid ${GC[f.group]}` }}>
              <span style={{ fontFamily:F.mono, fontSize:11, fontWeight:700, color:GC[f.group], width:112, flexShrink:0, lineHeight:1.5 }}>{f.name}</span>
              <span style={{ fontFamily:F.sans, fontSize:13, color:C.muted, lineHeight:1.65, flex:1 }}>{f.desc}</span>
              <span style={{ fontFamily:F.mono, fontSize:9, color:GC[f.group], background:`${GC[f.group]}18`, border:`1px solid ${GC[f.group]}30`, borderRadius:3, padding:"2px 7px", flexShrink:0, alignSelf:"flex-start", marginTop:2, letterSpacing:"0.5px" }}>{f.group}</span>
            </div>
          ))}
        </div>
      </GlassCard>

      {/* Feature Importance + Model Spec */}
      <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr":"1fr 1fr", gap:16 }}>
        <GlassCard style={{ padding:isMobile?"14px":"24px 28px" }} topColor={C.purple}>
          <SectionHeader color={C.purple}>Feature Importance</SectionHeader>
          <div style={{ fontFamily:F.sans, fontSize:13, color:C.dim, marginBottom:16, lineHeight:1.6 }}>
            {modelInfo ? "Logistic regression coefficients from trained model — absolute value = signal strength, sign = direction." : "Loading model metadata…"}
          </div>
          <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
            {[...featureImportance].sort((a,b) => b.importance-a.importance).map(f => (
              <div key={f.name}>
                <div style={{ display:"flex", justifyContent:"space-between", marginBottom:4 }}>
                  <span style={{ fontFamily:F.mono, fontSize:11, color:C.text }}>{f.name}</span>
                  <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                    {f.coefficient !== null && (
                      <span style={{ fontFamily:F.mono, fontSize:10, color: f.coefficient > 0 ? C.green : C.red }}>
                        {f.coefficient > 0 ? "+" : ""}{f.coefficient.toFixed(3)}
                      </span>
                    )}
                    <span style={{ fontFamily:F.mono, fontSize:11, fontWeight:700, color:GC[f.group] }}>
                      {modelInfo ? `${(f.importance * 100 / featureImportance.reduce((s,x)=>s+x.importance,0) * 100).toFixed(0)}%` : "—"}
                    </span>
                  </div>
                </div>
                <div style={{ height:5, background:"rgba(0,0,0,0.4)", borderRadius:3 }}>
                  <div style={{ height:"100%", width:`${(f.importance/maxImp)*100}%`, background:GC[f.group], borderRadius:3, boxShadow:`0 0 8px ${GC[f.group]}60` }} />
                </div>
              </div>
            ))}
          </div>
          <div style={{ marginTop:14, padding:"10px 12px", background:"rgba(0,0,0,0.22)", borderRadius:4, border:`1px solid ${C.border}` }}>
            <div style={{ fontFamily:F.mono, fontSize:10, color:C.dim, lineHeight:1.75 }}>
              {modelInfo ? `Real coefficients from ${modelInfo.model_type} trained on ${modelInfo.n_samples ?? "—"} samples across ${modelInfo.training_tickers?.join(", ")}. Positive coefficient → feature increases P(BULLISH). Validated with ${modelInfo.validation_method}.` : "⚠ Model metadata unavailable — API offline or model not loaded."}
            </div>
          </div>
        </GlassCard>

        <GlassCard style={{ padding:isMobile?"14px":"24px 28px" }} topColor={C.green}>
          <SectionHeader color={C.green}>Model Specification</SectionHeader>
          <div style={{ display:"flex", flexDirection:"column", gap:0 }}>
            {[
              { label:"Model type",        val: modelInfo ? `${modelInfo.pipeline_steps?.join(" → ")}` : "LogisticRegression (loading…)" },
              { label:"Task",              val:"Binary classification (up/down next day)" },
              { label:"Signal mapping",    val:"P(up)≥0.55→BULLISH · ≤0.45→BEARISH · else NEUTRAL" },
              { label:"Input dimensions",  val: modelInfo ? `${modelInfo.n_features} features` : "8 features" },
              { label:"Training data",     val:"252-day rolling OHLCV window" },
              { label:"Label horizon",     val:"Next-day close vs current close" },
              { label:"Validation",        val: modelInfo ? (modelInfo.validation_method.includes("legacy") ? "StratifiedKFold (legacy — retrain pending)" : modelInfo.validation_method) : "TimeSeriesSplit(n_splits=5)" },
              { label:"CV Accuracy",       val: modelInfo ? `${(modelInfo.cv_accuracy*100).toFixed(1)}% ± ${(modelInfo.cv_std*100).toFixed(1)}%` : "— (loading)" },
              { label:"Baseline (up-days)",val: modelInfo?.baseline_accuracy ? `${(modelInfo.baseline_accuracy*100).toFixed(1)}%` : "~53%" },
              { label:"Confidence",        val:"Raw sigmoid probability (not Platt-calibrated)" },
            ].map(({ label, val }) => (
              <div key={label} style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", gap:12, borderBottom:`1px solid ${C.border}25`, padding:"9px 0" }}>
                <span style={{ fontFamily:F.mono, fontSize:10, color:C.dim, flexShrink:0, letterSpacing:"0.3px" }}>{label}</span>
                <span style={{ fontFamily:F.mono, fontSize:11, color:C.text, textAlign:"right", lineHeight:1.5 }}>{val}</span>
              </div>
            ))}
          </div>
        </GlassCard>
      </div>

      {/* Signal Statistics — real BigQuery data */}
      <GlassCard style={{ padding:isMobile?"14px":"24px 28px" }} topColor={C.accent}>
        <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:22 }}>
          <div style={{ width:3, height:20, background:C.accent, borderRadius:2, boxShadow:`0 0 10px ${C.glow}`, flexShrink:0 }} />
          <span style={{ fontFamily:F.mono, fontSize:11, letterSpacing:"0.18em", textTransform:"uppercase", color:C.text, fontWeight:700 }}>Signal Statistics</span>
          {total > 0 && <span style={{ fontFamily:F.mono, fontSize:9, letterSpacing:"1px", color:C.green, background:"rgba(52,211,153,0.1)", border:`1px solid ${C.green}30`, borderRadius:3, padding:"2px 8px", textTransform:"uppercase" }}>Live · BigQuery</span>}
        </div>
        {total === 0 ? (
          <div style={{ fontFamily:F.mono, fontSize:13, color:C.dim, padding:"24px 0", textAlign:"center" }}>
            No prediction history in BigQuery yet — run Live Inference to populate.
          </div>
        ) : (
          <div style={{ display:"flex", flexDirection:"column", gap:18 }}>
            <div style={{ display:"flex", gap:28, flexWrap:"wrap" }}>
              <div>
                <div style={{ fontFamily:F.mono, fontSize:36, fontWeight:700, color:C.accent, lineHeight:1 }}>{total}</div>
                <div style={{ fontFamily:F.sans, fontSize:13, color:C.dim, marginTop:4 }}>Total Predictions</div>
                <div style={{ fontFamily:F.mono, fontSize:11, color:C.dim, marginTop:2 }}>last 7 days</div>
              </div>
              {breakdown.map(b => {
                const col = b.prediction==="BULLISH"?C.green:b.prediction==="BEARISH"?C.red:C.amber;
                const pct = ((b.count/total)*100).toFixed(1);
                return (
                  <div key={b.prediction}>
                    <div style={{ fontFamily:F.mono, fontSize:36, fontWeight:700, color:col, lineHeight:1 }}>{b.count}</div>
                    <div style={{ fontFamily:F.sans, fontSize:13, color:C.dim, marginTop:4 }}>{b.prediction}</div>
                    <div style={{ fontFamily:F.mono, fontSize:11, color:col, marginTop:2 }}>{pct}% of signals</div>
                    <div style={{ fontFamily:F.mono, fontSize:11, color:C.dim }}>avg conf {(b.avg_confidence*100).toFixed(0)}%</div>
                    {b.avg_rsi && <div style={{ fontFamily:F.mono, fontSize:11, color:C.dim }}>avg RSI {b.avg_rsi.toFixed(1)}</div>}
                  </div>
                );
              })}
            </div>
            <div>
              <div style={{ fontFamily:F.mono, fontSize:10, letterSpacing:"2px", textTransform:"uppercase", color:C.dim, marginBottom:8 }}>Signal Distribution</div>
              <div style={{ display:"flex", height:8, borderRadius:4, overflow:"hidden", gap:2 }}>
                {breakdown.map(b => {
                  const col = b.prediction==="BULLISH"?C.green:b.prediction==="BEARISH"?C.red:C.amber;
                  return <div key={b.prediction} style={{ width:`${(b.count/total)*100}%`, background:col, transition:"width 0.7s ease" }} />;
                })}
              </div>
              <div style={{ display:"flex", gap:16, marginTop:8 }}>
                {breakdown.map(b => {
                  const col = b.prediction==="BULLISH"?C.green:b.prediction==="BEARISH"?C.red:C.amber;
                  return (
                    <div key={b.prediction} style={{ display:"flex", alignItems:"center", gap:5 }}>
                      <div style={{ width:8, height:8, borderRadius:2, background:col }} />
                      <span style={{ fontFamily:F.mono, fontSize:10, color:C.dim }}>{b.prediction} — {((b.count/total)*100).toFixed(0)}%</span>
                    </div>
                  );
                })}
              </div>
            </div>
            {analytics?.total_resolved > 0 && (
              <div style={{ borderTop:`1px solid ${C.border}`, paddingTop:16 }}>
                <div style={{ fontFamily:F.mono, fontSize:10, letterSpacing:"2px", textTransform:"uppercase", color:C.dim, marginBottom:12 }}>Live Prediction Accuracy · {analytics.total_resolved} outcomes resolved</div>
                <div style={{ display:"flex", gap:16, flexWrap:"wrap", marginBottom:12 }}>
                  {analytics.accuracy_stats?.map(a => {
                    const col = a.prediction==="BULLISH"?C.green:a.prediction==="BEARISH"?C.red:C.amber;
                    return (
                      <div key={a.prediction} style={{ background:"rgba(0,0,0,0.25)", border:`1px solid ${col}30`, borderLeft:`3px solid ${col}`, borderRadius:6, padding:"12px 16px", minWidth:130 }}>
                        <div style={{ fontFamily:F.mono, fontSize:11, color:col, marginBottom:6, fontWeight:700 }}>{a.prediction}</div>
                        <div style={{ fontFamily:F.mono, fontSize:26, fontWeight:700, color:col, lineHeight:1 }}>{(a.accuracy*100).toFixed(0)}%</div>
                        <div style={{ fontFamily:F.mono, fontSize:10, color:C.dim, marginTop:4 }}>accuracy</div>
                        <div style={{ fontFamily:F.mono, fontSize:10, color:C.dim, marginTop:2 }}>{a.correct}/{a.total} correct</div>
                        <div style={{ fontFamily:F.mono, fontSize:10, color: a.avg_return_pct > 0 ? C.green : C.red, marginTop:4 }}>
                          avg {a.avg_return_pct > 0 ? "+" : ""}{a.avg_return_pct?.toFixed(1)}% 5d return
                        </div>
                      </div>
                    );
                  })}
                  {analytics?.overall_accuracy && (
                    <div style={{ background:"rgba(0,0,0,0.25)", border:`1px solid ${C.accent}40`, borderLeft:`3px solid ${C.accent}`, borderRadius:6, padding:"12px 16px", minWidth:130 }}>
                      <div style={{ fontFamily:F.mono, fontSize:11, color:C.accent, marginBottom:6, fontWeight:700 }}>OVERALL</div>
                      <div style={{ fontFamily:F.mono, fontSize:26, fontWeight:700, color:C.accent, lineHeight:1 }}>{(analytics.overall_accuracy*100).toFixed(0)}%</div>
                      <div style={{ fontFamily:F.mono, fontSize:10, color:C.dim, marginTop:4 }}>all signals</div>
                      <div style={{ fontFamily:F.mono, fontSize:10, color:C.dim, marginTop:2 }}>{analytics.total_resolved} resolved</div>
                    </div>
                  )}
                </div>
              </div>
            )}
            <div style={{ fontFamily:F.mono, fontSize:10, color:C.dim, opacity:0.5 }}>
              Source: BigQuery <span style={{ color:C.accent }}>predictions.market_signals</span> + <span style={{ color:C.accent }}>prediction_outcomes</span> · Accuracy computed from 5-day forward returns on resolved predictions.
            </div>
          </div>
        )}
      </GlassCard>

      {/* Training Methodology */}
      <GlassCard style={{ padding:isMobile?"14px":"24px 28px" }} topColor={C.amber}>
        <SectionHeader color={C.amber}>Training Methodology</SectionHeader>
        <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr":"1fr 1fr", gap:10 }}>
          {TRAIN_STEPS.map(s => (
            <div key={s.n} style={{ display:"flex", gap:14, padding:"14px 16px", background:"rgba(0,0,0,0.22)", borderRadius:6 }}>
              <span style={{ fontFamily:F.mono, fontSize:18, fontWeight:700, color:C.amber, opacity:0.35, flexShrink:0, lineHeight:1.1 }}>{s.n}</span>
              <div>
                <div style={{ fontFamily:F.mono, fontSize:12, fontWeight:700, color:C.text, marginBottom:5 }}>{s.title}</div>
                <div style={{ fontFamily:F.sans, fontSize:13, color:C.muted, lineHeight:1.65 }}>{s.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </GlassCard>

      {/* Known Limitations */}
      <GlassCard style={{ padding:isMobile?"14px":"24px 28px" }} topColor={C.red}>
        <SectionHeader color={C.red}>Known Limitations</SectionHeader>
        <div style={{ fontFamily:F.sans, fontSize:14, color:C.muted, marginBottom:18, lineHeight:1.75, padding:"12px 16px", background:"rgba(248,113,113,0.05)", border:`1px solid ${C.red}25`, borderRadius:6 }}>
          Disclosed limitations are a sign of rigour, not weakness. These are the known gaps in the current implementation — not hidden, not papered over.
        </div>
        <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
          {LIMITS.map(l => (
            <div key={l.title} style={{ display:"flex", gap:14, padding:"14px 16px", background:"rgba(0,0,0,0.22)", borderRadius:6, borderLeft:`3px solid ${SC[l.sev]}` }}>
              <div style={{ flexShrink:0, marginTop:1 }}>
                <span style={{ fontFamily:F.mono, fontSize:8, letterSpacing:"1.5px", textTransform:"uppercase", color:SC[l.sev], background:`${SC[l.sev]}18`, border:`1px solid ${SC[l.sev]}30`, borderRadius:2, padding:"2px 6px" }}>{l.sev}</span>
              </div>
              <div>
                <div style={{ fontFamily:F.mono, fontSize:12, fontWeight:700, color:C.text, marginBottom:5 }}>{l.title}</div>
                <div style={{ fontFamily:F.sans, fontSize:13, color:C.muted, lineHeight:1.65 }}>{l.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </GlassCard>

      {/* Validation Roadmap */}
      <GlassCard style={{ padding:isMobile?"12px 14px":"18px 24px" }}>
        <div style={{ display:"flex", alignItems:"flex-start", gap:14 }}>
          <span style={{ fontSize:20, color:C.accent, opacity:0.65, flexShrink:0, marginTop:2 }}>⟳</span>
          <div>
            <div style={{ fontFamily:F.mono, fontSize:12, fontWeight:700, color:C.text, marginBottom:6 }}>Validation Roadmap</div>
            <div style={{ fontFamily:F.sans, fontSize:13, color:C.muted, lineHeight:1.8 }}>
              Proper live validation requires accumulating predictions with timestamps and comparing against realised 5-day returns.{" "}
              <strong style={{ color:C.text }}>This data does not yet exist.</strong>{" "}
              The next implementation phase: a scheduled Cloud Function queries BigQuery for predictions older than 5 trading days, fetches the realised price from Twelve Data, writes outcome rows back to the dataset, and exposes per-class accuracy and a reliability diagram via the <span style={{ color:C.accent, fontFamily:F.mono }}>/analytics</span> endpoint. That data will replace these static methodology notes with live performance numbers.
            </div>
          </div>
        </div>
      </GlassCard>

    </div>
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
  const [apiHealth, setApiHealth]       = useState("checking");
  const [modelInfo, setModelInfo]       = useState(null);
  const logRef      = useRef(null);
  const runRef      = useRef(false);
  const queueRef    = useRef([]);
  const fetchedRef  = useRef(false);

  useEffect(() => {
    if (!API_URL) { setApiHealth("offline"); return; }
    const ctrl = new AbortController();
    Promise.all([
      fetch(`${API_URL}/health`,     { signal: ctrl.signal }),
      fetch(`${API_URL}/model-info`, { signal: ctrl.signal }),
      fetch(`${API_URL}/analytics`,  { signal: ctrl.signal }),
    ]).then(async ([hRes, mRes, aRes]) => {
      setApiHealth(hRes.ok ? "healthy" : "degraded");
      if (mRes.ok) { const d = await mRes.json(); if (d.available) setModelInfo(d); }
      if (aRes.ok) { const d = await aRes.json(); if (d.total_predictions > 0) setAnalytics(d); }
    }).catch(() => setApiHealth("offline"));
    return () => ctrl.abort();
  }, []);

  /* Fetch real-time prices on mount so ticker chips are never stale */
  useEffect(() => {
    if (fetchedRef.current || !API_URL) return;
    fetchedRef.current = true;
    setDataStatus("loading");
    fetchAllTwelveData(DEFAULT_STOCKS.map(s => s.ticker))
      .then(data => { setStockData(prev => ({ ...prev, ...data })); setDataStatus("ready"); })
      .catch(() => setDataStatus("error"));
  }, []);

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

    addLog(`ML pipeline starting — ${tickers.length} ticker${tickers.length===1?"":"s"} queued`, "info");

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
        addLog(`Pub/Sub publish confirmed — ${tickers.length} message(s) → market-data-ingest`, "success");
        await sleep(200);
        addLog(`Session ${sessionId.slice(0,8)}… — Cloud Run workers assigned`, "success");
      }
    } catch {
      addLog("Pub/Sub endpoint unreachable — falling back to cached market data", "warning");
    }

    // Batch-poll all results — log real poll events and arrivals
    const sessionResults = {};
    if (sessionId) {
      const POLL_MS = 3000, MAX_POLLS = 8;
      let prevCount = 0;
      for (let p = 0; p < MAX_POLLS && runRef.current; p++) {
        await sleep(POLL_MS);
        try {
          const r = await fetch(`${API_URL}/results/${sessionId}`, { signal: AbortSignal.timeout(5000) });
          if (r.ok) {
            const { results } = await r.json();
            for (const x of results) { if (!sessionResults[x.ticker]) sessionResults[x.ticker] = x; }
            const newCount = Object.keys(sessionResults).length;
            if (newCount > prevCount) {
              const arrived = Object.keys(sessionResults).slice(prevCount);
              for (const t of arrived) addLog(`↳ ${t} — Cloud Run inference complete (${sessionResults[t].latency}ms)`, "data");
              prevCount = newCount;
            } else {
              addLog(`Waiting on Cloud Run — ${newCount}/${tickers.length} results ready (poll ${p+1})`, "processing");
            }
            if (newCount >= tickers.length) break;
          }
        } catch { /* keep polling */ }
      }
    }

    let tLat = 0, tConf = 0, simCount = 0;

    for (let i = 0; i < tickers.length; i++) {
      if (!runRef.current) break;
      const ticker   = tickers[i];
      const fallback = queueRef.current[i];

      // Stage 0 — Pub/Sub delivery
      setActive(0);
      addLog(sessionId ? `Pub/Sub → ${ticker}: message delivered to market-data-ingest` : `Cached data → ${ticker}: market snapshot loaded`, "data");
      for (let x=0;x<=10;x++){setProgress(x/10);await sleep(40);}
      await sleep(140);

      // Stage 1 — Cloud Run preprocess
      setActive(1);
      const realResult = sessionResults[ticker] || null;
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
      if (!isReal) simCount++;

      for (let x=0;x<=10;x++){setProgress(x/10);await sleep(35);}
      if (isReal) {
        addLog(`${ticker} features: RSI=${s.rsi?.toFixed(1)} | MACD=${s.macdBull?"Bull":"Bear"} | SMA50=${s.aboveMa50?"▲":"▼"} | SMA200=${s.aboveMa200?"▲":"▼"} | BB=${s.bbPos}% | ATR=$${s.atr}`, "data");
      } else {
        addLog(`${ticker}: no Cloud Run result — using cached price $${s.price?.toFixed(2)} (simulated signal)`, "warning");
      }
      await sleep(220);

      // Stage 2 — ML classifier
      setActive(2);
      addLog(`${ticker}: running ML classifier on feature vector…`, "processing");
      for (let x=0;x<=10;x++){setProgress(x/10);await sleep(55);}
      addLog(`${ticker}: ${s.prediction} — conf ${(s.confidence*100).toFixed(1)}% — ${s.latency}ms inference`, "success");
      setPred({ ticker, prediction:s.prediction, confidence:s.confidence, latency:s.latency });
      await sleep(240);

      // Stage 3 — BigQuery write (happened server-side; log it only for real results)
      setActive(3);
      if (isReal) {
        addLog(`BigQuery insert: predictions.market_signals — partition ${new Date().toISOString().split("T")[0]}`, "success");
      } else {
        addLog(`BigQuery insert skipped — no session result for ${ticker}`, "warning");
      }
      for (let x=0;x<=10;x++){setProgress(x/10);await sleep(32);}
      await sleep(160);

      // Stage 4 — API response
      setActive(4);
      addLog(`FastAPI response: 200 OK — ${s.latency}ms${isReal ? "" : " (simulated)"}`, isReal ? "success" : "warning");
      for (let x=0;x<=10;x++){setProgress(x/10);await sleep(24);}
      await sleep(160);

      tLat += s.latency; tConf += s.confidence;
      const n = i + 1;
      setCount(n); setAvgLat(Math.round(tLat/n)); setAvgConf(Math.round((tConf/n)*100));
      setLatHist(prev => [...prev, { latency:s.latency, ticker }]);

      // Merge into stockData so ForecastGrid and SignalIntelligence use real values
      if (isReal) handleRealDataFetched(s);

      setAllResults(prev => [...prev, { ticker, prediction:s.prediction, confidence:s.confidence, latency:s.latency, price:s.price, isReal }]);

      if (i < tickers.length-1) {
        setActive(-1);
        await sleep(500);
      }
    }

    setActive(-1);
    addLog(`Batch complete — ${tickers.length} predictions processed`,"success");
    if (simCount > 0) addLog(`${simCount} result(s) used simulated fallback — API results unavailable`, "warning");
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
        @keyframes mlFloat{0%,100%{transform:translateY(0) scale(1);opacity:0.12}50%{transform:translateY(-18px) scale(1.3);opacity:0.22}}
        @keyframes mlSpin{0%{transform:rotate(0deg)}100%{transform:rotate(360deg)}}
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

      {/* Animated data nodes */}
      <div style={{ position:"fixed", inset:0, pointerEvents:"none", zIndex:0, overflow:"hidden" }}>
        {[
          { top:"12%", left:"6%",  size:5, dur:9,  del:0   },
          { top:"38%", left:"3%",  size:4, dur:12, del:2.5 },
          { top:"68%", left:"8%",  size:6, dur:8,  del:5   },
          { top:"20%", right:"7%", size:4, dur:11, del:1   },
          { top:"55%", right:"5%", size:5, dur:10, del:3.5 },
          { top:"82%", right:"10%",size:4, dur:13, del:6   },
        ].map(({ top, left, right, size, dur, del }, i) => (
          <div key={i} style={{
            position:"absolute", top, left, right,
            width:size, height:size, borderRadius:"50%",
            background:C.accent, boxShadow:`0 0 ${size*2}px ${C.accent}`,
            animation:`mlFloat ${dur}s ease-in-out ${del}s infinite both`,
          }} />
        ))}
      </div>

      {/* Back button */}
      <button
        onClick={() => navigate("/", { state:{ scrollTo:"projects" } })}
        style={{
          position:"fixed", top:isMobile?12:20, left:isMobile?12:20, zIndex:100,
          display:"inline-flex", alignItems:"center", gap:8,
          fontFamily:F.mono, fontSize:isMobile?10:12, letterSpacing:isMobile?"1.5px":"2px", textTransform:"uppercase",
          color:C.dim, background:"rgba(9,21,21,0.9)",
          border:`1px solid ${C.border}`, borderRadius:6,
          padding:isMobile?"6px 11px":"9px 16px", cursor:"pointer", backdropFilter:"blur(16px)",
          transition:"all 0.2s",
        }}
        onMouseEnter={e=>{e.currentTarget.style.color=C.text;e.currentTarget.style.borderColor=C.accent;e.currentTarget.style.boxShadow=`0 0 20px ${C.glowSm}`;}}
        onMouseLeave={e=>{e.currentTarget.style.color=C.dim;e.currentTarget.style.borderColor=C.border;e.currentTarget.style.boxShadow="none";}}
      >← Timeline</button>

      <div style={{ maxWidth:1060, margin:"0 auto", padding:isMobile?"80px 16px 60px":"68px 28px 60px", position:"relative", zIndex:1 }}>

        {/* ── Hero ── */}
        <div style={{ marginBottom:40, animation:"fadeUp 0.5s ease both", display:"grid", gridTemplateColumns:isMobile?"1fr":"1fr auto", gap:isMobile?24:48, alignItems:"flex-start" }}>

          {/* Left: branding */}
          <div>
            <div style={{ display:"flex", alignItems:"center", gap:14, marginBottom:8 }}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" aria-hidden="true"
                style={{ color:C.accent, filter:`drop-shadow(0 0 8px ${C.glowSm})`, flexShrink:0 }}>
                <path d="M12 2l9 3.5V11c0 5-9 11-9 11S3 16 3 11V5.5L12 2z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round"/>
                <path d="M8.5 12l2.5 2.5 4.5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <span style={{ fontFamily:F.mono, fontSize:"clamp(22px,4vw,36px)", fontWeight:700, letterSpacing:"0.18em", color:C.text, textShadow:`0 0 50px ${C.glowSm}` }}>SENTINEL</span>
            </div>
            <p style={{ fontFamily:F.mono, fontSize:11, letterSpacing:"0.22em", textTransform:"uppercase", color:C.accent, margin:"0 0 16px 2px", opacity:0.85 }}>ML Signal Pipeline</p>
            <div style={{ display:"flex", gap:6, flexWrap:"wrap", marginBottom:20 }}>
              {["Cloud Run","Pub/Sub","BigQuery","Firestore","Terraform","Python","FastAPI"].map(t => (
                <span key={t} style={{ fontFamily:F.mono, fontSize:10, letterSpacing:"0.10em", padding:"3px 10px", borderRadius:3, border:`1px solid ${C.glowSm}`, background:"rgba(26,172,190,0.06)", color:C.dim }}>{t}</span>
              ))}
            </div>
            <p style={{ fontFamily:F.sans, fontSize:16, color:C.muted, lineHeight:1.85, maxWidth:600, marginBottom:20 }}>
              Streaming market data through a serverless ML inference pipeline — ingestion via Pub/Sub,
              feature extraction and ML classification on Cloud Run, session state in Firestore, storage in BigQuery.
            </p>

            {/* ── Plain-English strip ── */}
            <div style={{
              display:"flex", gap:0, flexWrap:"wrap",
              background:"rgba(26,172,190,0.04)",
              border:`1px solid ${C.border}`,
              borderRadius:8, overflow:"hidden", maxWidth:600,
            }}>
              {[
                { step:"01", emoji:"📈", plain:"Every minute, live stock prices are pulled from the market for 8 major companies.", tech:"Twelve Data API → Pub/Sub" },
                { step:"02", emoji:"🧠", plain:"A machine learning model reads price patterns and predicts: will this stock be higher tomorrow?", tech:"Logistic Regression · 8 features" },
                { step:"03", emoji:"✅", plain:"Each prediction is stored and later checked against what actually happened — so you can see if it was right.", tech:"BigQuery outcome tracking · 191 resolved" },
              ].map(({ step, emoji, plain, tech }, i) => (
                <div key={step} style={{
                  flex:"1 1 160px", padding:"14px 16px",
                  borderRight: (!isMobile && i < 2) ? `1px solid ${C.border}` : "none",
                  borderBottom: (isMobile && i < 2) ? `1px solid ${C.border}` : "none",
                  position:"relative",
                }}>
                  <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:6 }}>
                    <span style={{ fontSize:18, lineHeight:1 }}>{emoji}</span>
                    <span style={{ fontFamily:F.mono, fontSize:9, letterSpacing:"0.18em", color:C.accent, opacity:0.6 }}>STEP {step}</span>
                  </div>
                  <p style={{ fontFamily:F.sans, fontSize:12, color:C.muted, lineHeight:1.6, margin:"0 0 6px 0" }}>{plain}</p>
                  <span style={{ fontFamily:F.mono, fontSize:9, color:C.dim, letterSpacing:"0.08em", opacity:0.7 }}>{tech}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Right: system status — desktop only */}
          {!isMobile && (
            <div style={{
              background:C.card, border:`1px solid ${C.border}`, borderRadius:10,
              padding:"20px 24px", minWidth:230, position:"relative", overflow:"hidden",
              backdropFilter:"blur(10px)",
              boxShadow:`0 4px 24px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.06)`,
              flexShrink:0,
            }}>
              <div style={{ position:"absolute", top:0, left:0, right:0, height:2, background:`linear-gradient(90deg, ${C.accent}, transparent)`, boxShadow:`0 0 8px ${C.glowSm}` }} />
              <div style={{ fontFamily:F.mono, fontSize:10, letterSpacing:"0.18em", textTransform:"uppercase", color:C.accent, opacity:0.75, marginBottom:16 }}>System Status</div>
              {[
                { label:"Pub/Sub Ingestion", status: apiHealth==="healthy"?"operational":apiHealth==="checking"?"connecting":"offline",    col: apiHealth==="healthy"?C.green:apiHealth==="checking"?C.dim:C.red },
                { label:"Cloud Run ML",      status: apiHealth==="healthy"?"operational":apiHealth==="checking"?"connecting":"offline",    col: apiHealth==="healthy"?C.green:apiHealth==="checking"?C.dim:C.red },
                { label:"BigQuery Store",    status: analytics?"operational":apiHealth==="checking"?"connecting":"offline",                col: analytics?C.green:apiHealth==="checking"?C.dim:C.amber },
                { label:"FastAPI Endpoint",  status: apiHealth==="healthy"?"live":apiHealth==="degraded"?"degraded":apiHealth==="offline"?"offline":"checking", col: apiHealth==="healthy"?C.accent:apiHealth==="degraded"?C.amber:apiHealth==="offline"?C.red:C.dim },
                { label:"Market Data API",   status: dataStatus==="ready"?"live":dataStatus==="error"?"degraded":dataStatus==="loading"?"connecting":"idle",    col: dataStatus==="ready"?C.accent:dataStatus==="error"?C.amber:C.dim },
              ].map(({ label, status, col }) => (
                <div key={label} style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:12, marginBottom:11 }}>
                  <span style={{ fontFamily:F.mono, fontSize:11, color:C.dim, flex:1, letterSpacing:"0.3px" }}>{label}</span>
                  <div style={{ display:"flex", alignItems:"center", gap:5 }}>
                    <div style={{
                      width:6, height:6, borderRadius:"50%", background:col,
                      boxShadow:`0 0 6px ${col}`, flexShrink:0,
                      ...(status==="connecting"?{ animation:"pulse 1.4s ease-in-out infinite" }:{}),
                    }} />
                    <span style={{ fontFamily:F.mono, fontSize:9, letterSpacing:"0.12em", textTransform:"uppercase", color:col, opacity:0.85 }}>{status}</span>
                  </div>
                </div>
              ))}
              {analytics && (
                <div style={{ marginTop:14, paddingTop:14, borderTop:`1px solid ${C.border}` }}>
                  <div style={{ fontFamily:F.mono, fontSize:10, letterSpacing:"0.15em", textTransform:"uppercase", color:C.dim, opacity:0.55, marginBottom:6 }}>BigQuery · 7d</div>
                  <div style={{ display:"flex", gap:20 }}>
                    <div>
                      <div style={{ fontFamily:F.mono, fontSize:22, fontWeight:700, color:C.accent }}>{analytics.total_predictions}</div>
                      <div style={{ fontFamily:F.mono, fontSize:9, color:C.dim, marginTop:2, letterSpacing:"0.5px" }}>PREDICTIONS</div>
                    </div>
                    {analytics.breakdown?.slice(0,2).map(b => (
                      <div key={b.prediction}>
                        <div style={{ fontFamily:F.mono, fontSize:22, fontWeight:700, color:b.prediction==="BULLISH"?C.green:b.prediction==="BEARISH"?C.red:C.amber }}>{b.count}</div>
                        <div style={{ fontFamily:F.mono, fontSize:9, color:C.dim, marginTop:2, letterSpacing:"0.5px" }}>{b.prediction}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Tabs ── */}
        <div style={{ display:"flex", gap:4, marginBottom:36, background:"rgba(0,0,0,0.35)", padding:"5px", borderRadius:8, border:`1px solid ${C.border}`, width:isMobile?"100%":"fit-content", animation:"fadeUp 0.5s ease 0.12s both" }}>
          {[{id:"architecture",label:"Architecture"},{id:"simulation",label:"Live Inference"},{id:"model-card",label:"Model Card"}].map(tab => (
            <button key={tab.id} onClick={()=>setView(tab.id)} style={{
              fontFamily:F.mono, fontSize:isMobile?10:12, letterSpacing:"0.12em", textTransform:"uppercase",
              padding:isMobile?"10px 0":"10px 28px", border:"none", cursor:"pointer", borderRadius:6,
              flex:isMobile?1:undefined,
              background: view===tab.id ? C.accent : "transparent",
              color: view===tab.id ? "#091515" : C.dim,
              fontWeight: view===tab.id ? 700 : 400,
              boxShadow: view===tab.id ? `0 2px 14px ${C.glow}` : "none",
              transition:"all 0.18s",
              whiteSpace:"nowrap",
            }}>{tab.label}</button>
          ))}
        </div>

        {/* ── Architecture ── */}
        {view==="architecture" && (
          <div style={{ animation:"fadeUp 0.35s ease both" }}>
            <GlassCard style={{ padding:isMobile?"16px 14px":"28px 32px", marginBottom:20 }} topColor={C.accent}>
              <SectionHeader>Pipeline Architecture</SectionHeader>
              <div style={{ overflowX:isMobile?"auto":"visible", WebkitOverflowScrolling:"touch", marginLeft:-4, paddingLeft:4, paddingBottom:isMobile?8:0 }}>
                <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"center", flexWrap:"nowrap", gap:0, minWidth:isMobile?380:undefined }}>
                  {STAGES.map((stage,i) => (
                    <div key={stage.id} style={{ display:"flex", alignItems:"flex-start" }}>
                      <PipelineNode stage={stage} active={false} complete={false} progress={0} />
                      {i<STAGES.length-1 && <Connector active={false} complete={false} color={C.border} />}
                    </div>
                  ))}
                </div>
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
                  {(analytics.breakdown || []).map(b => (
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

        {/* ── Model Card ── */}
        {view==="model-card" && <ModelCard analytics={analytics} modelInfo={modelInfo} isMobile={isMobile} />}

        {/* ── Simulation ── */}
        {view==="simulation" && (
          <div style={{ animation:"fadeUp 0.35s ease both" }}>

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
                ✓ Live market data loaded — features extracted and ready for ML inference
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
              isMobile={isMobile}
            />

            {/* Pipeline status */}
            <GlassCard style={{ padding:isMobile?"14px 14px":"24px 28px", marginBottom:16 }} topColor={C.accent}>
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
              <div style={{ overflowX:isMobile?"auto":"visible", WebkitOverflowScrolling:"touch", marginLeft:-4, paddingLeft:4, paddingBottom:isMobile?8:0 }}>
                <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"center", flexWrap:"nowrap", gap:0, minWidth:isMobile?380:undefined }}>
                  {STAGES.map((stage,i) => (
                    <div key={stage.id} style={{ display:"flex", alignItems:"flex-start" }}>
                      <PipelineNode stage={stage} active={activeStage===i} complete={activeStage>i} progress={activeStage===i?progress:0} />
                      {i<STAGES.length-1 && <Connector active={activeStage===i} complete={activeStage>i} color={stage.color} />}
                    </div>
                  ))}
                </div>
              </div>
            </GlassCard>

            {/* Metrics */}
            <div style={{ display:isMobile?"grid":"flex", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:16, flexWrap:"wrap" }}>
              <MetricCard label="Processed"      value={count}               unit={`/ ${totalStocks}`}    color={C.accent}                               note="messages" />
              <MetricCard label="Avg Latency"    value={avgLat||"—"}         unit={avgLat?"ms":""}        color={avgLat<25?C.green:avgLat?C.amber:C.dim} note={avgLat?"inference time":""} />
              <MetricCard label="Avg Confidence" value={avgConf?`${avgConf}`:"—"} unit={avgConf?"%":""}  color={C.purple}                               note={avgConf?"model certainty":""} />
              <MetricCard label="Signals 7d"     value={analytics ? analytics.total_predictions : apiHealth==="checking" ? "…" : "—"} unit="" color={analytics ? C.green : C.dim} note={analytics ? "from BigQuery" : apiHealth==="offline" ? "API offline" : "loading…"} />
            </div>

            {/* Latest prediction + logs */}
            <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr":"1fr 1fr", gap:12, marginBottom:16 }}>
              <GlassCard style={{ padding:isMobile?12:22 }} topColor={C.purple}>
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

              <GlassCard style={{ padding:isMobile?12:22, display:"flex", flexDirection:"column" }} topColor={C.dim}>
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
                <GlassCard style={{ padding:"24px 28px", animation:"fadeUp 0.4s ease both", marginBottom:16 }} topColor={C.green}>
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
