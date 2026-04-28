import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";

/* ─────────────────────────────────────────────────────────────
   Design tokens — teal-glass, distinct from main portfolio
   ───────────────────────────────────────────────────────────── */
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
  mono:    "'Courier New', Courier, monospace",
  display: "'Franklin Gothic Medium','Arial Narrow',Arial,sans-serif",
  sans:    "'Segoe UI',system-ui,sans-serif",
};

const STAGES = [
  { id:"ingest",     label:"Pub/Sub\nIngest",       icon:"IN", color:C.accent,  glow:C.glowSm   },
  { id:"preprocess", label:"Cloud Run\nPreprocess", icon:"⚙",  color:C.amber,   glow:C.amberGl  },
  { id:"inference",  label:"Vertex AI\nInference",  icon:"AI", color:C.purple,  glow:C.purpleGl },
  { id:"store",      label:"BigQuery\nStore",       icon:"DB", color:C.green,   glow:C.greenGl  },
  { id:"serve",      label:"API\nResponse",         icon:"→",  color:C.accent,  glow:C.glowSm   },
];

const SAMPLES = [
  { input:'{"ticker":"AAPL","price":198.5,"volume":12400}',  prediction:"BULLISH", confidence:0.87, latency:23 },
  { input:'{"ticker":"TSLA","price":245.2,"volume":38200}',  prediction:"BEARISH", confidence:0.72, latency:31 },
  { input:'{"ticker":"MSFT","price":412.8,"volume":8900}',   prediction:"NEUTRAL", confidence:0.91, latency:18 },
  { input:'{"ticker":"NVDA","price":875.3,"volume":54100}',  prediction:"BULLISH", confidence:0.94, latency:27 },
  { input:'{"ticker":"AMZN","price":186.4,"volume":15700}',  prediction:"BEARISH", confidence:0.68, latency:35 },
  { input:'{"ticker":"META","price":502.1,"volume":22300}',  prediction:"BULLISH", confidence:0.82, latency:21 },
];

const ARCH = [
  { title:"Data Ingestion",   color:C.accent, desc:"Pub/Sub topic receives streaming market data events. Cloud Functions trigger on new messages, batching for throughput.", details:["Message ordering guarantees","Dead-letter queue for failures","Auto-scaling subscribers"] },
  { title:"Preprocessing",    color:C.amber,  desc:"Cloud Run service normalises raw data into feature vectors. Stateless containers scale to zero when idle.",               details:["Feature normalisation pipeline","Schema validation","Scale-to-zero cost optimisation"] },
  { title:"Model Inference",  color:C.purple, desc:"Vertex AI endpoint hosts the sentiment classifier. Custom prediction routines handle pre/post processing at model layer.", details:["Custom container serving","A/B model deployment","Auto-scaling on GPU"] },
  { title:"Storage & Serving",color:C.green,  desc:"Predictions land in BigQuery partitioned by date. FastAPI serves real-time results via Cloud Run with Redis caching.",    details:["Partitioned tables by date","Sub-second API responses","Grafana monitoring dashboard"] },
];

/* ─── Sub-components ──────────────────────────────────────── */

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
      borderRadius:3, padding:"4px 11px", whiteSpace:"nowrap",
      fontWeight:700,
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
        boxShadow: active
          ? `0 0 20px ${stage.glow}, 0 0 50px ${stage.glow}, inset 0 0 20px ${stage.glow}`
          : complete ? `0 0 8px ${stage.glow}` : "none",
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
        }}>
          {stage.icon}
        </span>
      </div>
      <span style={{
        fontFamily:F.mono, fontSize:12, letterSpacing:"0.5px",
        color: active ? stage.color : complete ? C.muted : C.dim,
        textAlign:"center", whiteSpace:"pre", lineHeight:1.5,
        transition:"color 0.3s",
        textShadow: active ? `0 0 12px ${stage.color}` : "none",
      }}>
        {stage.label}
      </span>
      {active && (
        <div style={{
          position:"absolute", top:-4, right:-4,
          width:10, height:10, borderRadius:"50%",
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
      flex:1, minWidth:110,
      background: C.card,
      border:`1px solid ${C.border}`,
      borderRadius:8,
      padding:"16px 18px",
      position:"relative",
      overflow:"hidden",
    }}>
      <div style={{
        position:"absolute", top:0, left:0, right:0, height:2,
        background:`linear-gradient(90deg, ${color||C.accent}, transparent)`,
        boxShadow:`0 0 8px ${color||C.accent}`,
      }} />
      <div style={{ fontFamily:F.mono, fontSize:11, letterSpacing:"2px", textTransform:"uppercase", color:C.dim, marginBottom:10 }}>{label}</div>
      <div style={{ display:"flex", alignItems:"baseline", gap:5 }}>
        <span style={{ fontFamily:F.mono, fontSize:30, fontWeight:700, color:color||C.text, lineHeight:1 }}>{value}</span>
        {unit && <span style={{ fontFamily:F.mono, fontSize:14, color:C.dim }}>{unit}</span>}
      </div>
      {note && <div style={{ fontFamily:F.mono, fontSize:11, letterSpacing:"0.5px", color:C.dim, marginTop:6 }}>{note}</div>}
    </div>
  );
}

function LogEntry({ message, type, timestamp }) {
  const typeColor = { info:C.accent, success:C.green, warning:C.amber, processing:C.purple, data:C.muted };
  const typeIcon  = { success:"✓", warning:"!", processing:"◌", data:"›", info:"·" };
  return (
    <div style={{ fontFamily:F.mono, fontSize:13, lineHeight:1.85, display:"flex", gap:12 }}>
      <span style={{ color:C.dim, flexShrink:0, opacity:0.7 }}>{timestamp}</span>
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
          const col = h.latency<25 ? C.green : h.latency<35 ? C.amber : C.red;
          return (
            <div key={i} title={`${h.latency}ms — ${h.ticker}`} style={{
              width:barW, height:ht, borderRadius:"2px 2px 0 0",
              background:col,
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

/* ─── Main component ──────────────────────────────────────── */

export default function MLPipelineShowcase() {
  const navigate = useNavigate();
  const [view, setView]         = useState("architecture");
  const [running, setRunning]   = useState(false);
  const [activeStage, setActive]= useState(-1);
  const [progress, setProgress] = useState(0);
  const [logs, setLogs]         = useState([]);
  const [count, setCount]       = useState(0);
  const [latHist, setLatHist]   = useState([]);
  const [pred, setPred]         = useState(null);
  const [avgLat, setAvgLat]     = useState(0);
  const [avgConf, setAvgConf]   = useState(0);
  const logRef = useRef(null);
  const runRef = useRef(false);

  const addLog = useCallback((message, type="info") => {
    const d  = new Date();
    const ts = [d.getHours(),d.getMinutes(),d.getSeconds()].map(v=>String(v).padStart(2,"0")).join(":")
      + "." + String(d.getMilliseconds()).padStart(3,"0");
    setLogs(p => [...p.slice(-50), { message, type, timestamp:ts }]);
  }, []);

  useEffect(() => { if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight; }, [logs]);

  const sleep = ms => new Promise(r => setTimeout(r, ms));

  const runPipeline = useCallback(async () => {
    if (runRef.current) return;
    runRef.current=true; setRunning(true); setLogs([]); setActive(-1); setCount(0);
    setLatHist([]); setPred(null); setAvgLat(0); setAvgConf(0);
    addLog("Initialising ML inference pipeline…","info");                         await sleep(600);
    addLog("Connected to Pub/Sub — topic: market-data-stream","success");         await sleep(400);
    addLog("Vertex AI endpoint healthy — model: sentiment-v3","success");         await sleep(400);
    addLog("BigQuery dataset: predictions.market_signals ready","success");       await sleep(500);
    addLog("Pipeline active — awaiting incoming data…","info");                   await sleep(700);
    let tLat=0, tConf=0;
    for (let i=0; i<SAMPLES.length; i++) {
      if (!runRef.current) break;
      const s=SAMPLES[i], p=JSON.parse(s.input);
      setActive(0); addLog(`Pub/Sub message — ${p.ticker} @ $${p.price}`,"data");
      for (let x=0;x<=10;x++){setProgress(x/10);await sleep(55);}  await sleep(180);
      setActive(1); addLog(`Preprocessing: normalising price/volume for ${p.ticker}`,"processing");
      for (let x=0;x<=10;x++){setProgress(x/10);await sleep(45);}
      addLog("Feature vector: [0.72, −0.15, 0.88, 0.33, −0.41]","data");        await sleep(260);
      setActive(2); addLog("Running inference on Vertex AI endpoint…","processing");
      for (let x=0;x<=10;x++){setProgress(x/10);await sleep(65);}
      addLog(`Prediction: ${s.prediction} (conf: ${(s.confidence*100).toFixed(1)}%) — ${s.latency}ms`,"success");
      setPred({ ticker:p.ticker, prediction:s.prediction, confidence:s.confidence, latency:s.latency });
      await sleep(280);
      setActive(3); addLog("Writing to BigQuery: predictions.market_signals","processing");
      for (let x=0;x<=10;x++){setProgress(x/10);await sleep(38);}
      addLog(`Row inserted — partition: ${new Date().toISOString().split("T")[0]}`,"success"); await sleep(180);
      setActive(4); addLog("API response served — 200 OK","success");
      for (let x=0;x<=10;x++){setProgress(x/10);await sleep(28);}  await sleep(180);
      tLat+=s.latency; tConf+=s.confidence;
      const n=i+1;
      setCount(n); setAvgLat(Math.round(tLat/n)); setAvgConf(Math.round((tConf/n)*100));
      setLatHist(prev=>[...prev,{latency:s.latency,ticker:p.ticker}]);
      if (i<SAMPLES.length-1){ setActive(-1); addLog("Awaiting next message…","info"); await sleep(750); }
    }
    setActive(-1);
    addLog(`Batch complete — ${SAMPLES.length} predictions processed`,"success");
    setRunning(false); runRef.current=false;
  }, [addLog]);

  const stopPipeline = useCallback(() => {
    runRef.current=false; setRunning(false); setActive(-1);
    addLog("Pipeline stopped by user","warning");
  }, [addLog]);

  const predColor = pred?.prediction==="BULLISH" ? C.green : pred?.prediction==="BEARISH" ? C.red : C.amber;

  return (
    <div style={{ background:C.bg, minHeight:"100vh", color:C.text, fontFamily:F.sans, overflowX:"hidden" }}>
      <style>{`
        @keyframes pulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:0.4;transform:scale(1.5)}}
        @keyframes flowRight{0%{transform:translateX(-100%)}100%{transform:translateX(400%)}}
        @keyframes fadeUp{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}
        @keyframes scanline{0%{transform:translateY(-100%)}100%{transform:translateY(100vh)}}
        *{box-sizing:border-box;margin:0;padding:0}
        ::-webkit-scrollbar{width:4px;height:4px}
        ::-webkit-scrollbar-track{background:transparent}
        ::-webkit-scrollbar-thumb{background:rgba(23,126,137,0.4);border-radius:2px}
        ::-webkit-scrollbar-thumb:hover{background:rgba(26,172,190,0.6)}
      `}</style>

      {/* Hex grid background */}
      <svg style={{position:"fixed",inset:0,width:"100%",height:"100%",pointerEvents:"none",zIndex:0}} aria-hidden="true">
        <defs>
          <pattern id="mlhex" x="0" y="0" width="38" height="66" patternUnits="userSpaceOnUse">
            <path d="M19 11 L38 22 L38 44 L19 55 L0 44 L0 22 Z" fill="none" stroke="rgba(23,126,137,0.14)" strokeWidth="0.7"/>
          </pattern>
          <pattern id="mlhex2" x="19" y="33" width="38" height="66" patternUnits="userSpaceOnUse">
            <path d="M19 11 L38 22 L38 44 L19 55 L0 44 L0 22 Z" fill="none" stroke="rgba(23,126,137,0.14)" strokeWidth="0.7"/>
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#mlhex)"/>
        <rect width="100%" height="100%" fill="url(#mlhex2)"/>
      </svg>
      {/* Ambient glow */}
      <div style={{
        position:"fixed", inset:0, pointerEvents:"none", zIndex:0,
        background:`
          radial-gradient(ellipse 55% 35% at 5% 0%, rgba(23,126,137,0.12) 0%, transparent 65%),
          radial-gradient(ellipse 45% 30% at 95% 100%, rgba(26,172,190,0.08) 0%, transparent 60%)
        `,
      }} />

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
      >
        ← Timeline
      </button>

      <div style={{ maxWidth:1020, margin:"0 auto", padding:"68px 28px 60px", position:"relative", zIndex:1 }}>

        {/* ── Hero ── */}
        <div style={{ marginBottom:48, animation:"fadeUp 0.5s ease" }}>
          <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:16 }}>
            <span style={{
              fontFamily:F.mono, fontSize:12, fontWeight:700, letterSpacing:"2px", textTransform:"uppercase",
              color:"#091515", background:C.accent,
              padding:"4px 12px", borderRadius:3,
              boxShadow:`0 0 16px ${C.glowSm}`,
            }}>Project</span>
            <span style={{ fontFamily:F.mono, fontSize:12, letterSpacing:"1.5px", color:C.dim }}>
              GCP · Vertex AI · Cloud Run · BigQuery
            </span>
          </div>

          <h1 style={{
            fontFamily:F.display, fontSize:"clamp(28px,4.5vw,44px)",
            fontWeight:700, letterSpacing:"1px",
            color:C.text, lineHeight:1.1, marginBottom:16,
            textShadow:`0 0 60px ${C.glowSm}`,
          }}>
            Real-Time ML Inference Pipeline
          </h1>

          <p style={{ fontFamily:F.sans, fontSize:17, color:C.muted, lineHeight:1.85, maxWidth:600, marginBottom:20 }}>
            Streaming market data through a serverless ML pipeline — ingestion via Pub/Sub,
            preprocessing on Cloud Run, inference on Vertex AI, storage in BigQuery.
          </p>

          <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
            {["Vertex AI","Cloud Run","Pub/Sub","BigQuery","Terraform","Python","FastAPI"].map(t => <Tag key={t}>{t}</Tag>)}
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

            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14, marginBottom:14 }}>
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
                  Vertex AI endpoints, BigQuery datasets, IAM bindings, and monitoring alerts.
                </div>
              </div>
            </GlassCard>
          </div>
        )}

        {/* ── Simulation ── */}
        {view==="simulation" && (
          <div style={{ animation:"fadeUp 0.35s ease" }}>
            <GlassCard style={{ padding:"24px 28px", marginBottom:16 }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:24 }}>
                <div>
                  <SectionHeader>Pipeline Status</SectionHeader>
                  <div style={{
                    fontFamily:F.mono, fontSize:14, letterSpacing:"1px",
                    color: running ? C.green : logs.length>0 ? C.muted : C.dim,
                    textShadow: running ? `0 0 12px ${C.green}` : "none",
                  }}>
                    {running ? "● RUNNING" : logs.length>0 ? "● COMPLETE" : "○ IDLE"}
                  </div>
                </div>
                <button
                  onClick={running ? stopPipeline : runPipeline}
                  style={{
                    fontFamily:F.mono, fontSize:13, letterSpacing:"2px", textTransform:"uppercase",
                    padding:"12px 30px", borderRadius:6, border:"none", cursor:"pointer", fontWeight:700,
                    background: running ? C.red : C.accent,
                    color:"#091515",
                    boxShadow: running ? `0 4px 20px rgba(248,113,113,0.4)` : `0 4px 24px ${C.glow}`,
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

            <div style={{ display:"flex", gap:12, marginBottom:16, flexWrap:"wrap" }}>
              <MetricCard label="Processed"      value={count}                     unit={`/ ${SAMPLES.length}`} color={C.accent}                                note="messages" />
              <MetricCard label="Avg Latency"    value={avgLat||"—"}               unit={avgLat?"ms":""}        color={avgLat<25?C.green:avgLat?C.amber:C.dim}  note={avgLat?"inference time":""} />
              <MetricCard label="Avg Confidence" value={avgConf?`${avgConf}`:"—"}  unit={avgConf?"%":""}        color={C.purple}                                note={avgConf?"model certainty":""} />
              <MetricCard label="Uptime"         value="99.9"                       unit="%"                     color={C.green}                                 note="last 30 days" />
            </div>

            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16 }}>
              <GlassCard style={{ padding:22 }}>
                <SectionHeader>Latest Prediction</SectionHeader>
                {pred ? (
                  <>
                    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:18 }}>
                      <span style={{ fontFamily:F.display, fontSize:32, fontWeight:700, color:C.text, letterSpacing:"2px" }}>{pred.ticker}</span>
                      <span style={{
                        fontFamily:F.mono, fontSize:13, fontWeight:700, letterSpacing:"2px",
                        color:predColor, background:`${predColor}18`,
                        padding:"5px 14px", borderRadius:4,
                        border:`1px solid ${predColor}50`,
                        boxShadow:`0 0 16px ${predColor}30`,
                      }}>{pred.prediction}</span>
                    </div>
                    <div style={{ display:"flex", gap:28, marginBottom:22 }}>
                      <div>
                        <div style={{ fontFamily:F.mono, fontSize:11, letterSpacing:"2px", textTransform:"uppercase", color:C.dim, marginBottom:6 }}>Confidence</div>
                        <div style={{ fontFamily:F.mono, fontSize:26, fontWeight:700, color:C.purple, textShadow:`0 0 16px ${C.purple}` }}>{(pred.confidence*100).toFixed(1)}%</div>
                      </div>
                      <div>
                        <div style={{ fontFamily:F.mono, fontSize:11, letterSpacing:"2px", textTransform:"uppercase", color:C.dim, marginBottom:6 }}>Latency</div>
                        <div style={{ fontFamily:F.mono, fontSize:26, fontWeight:700, color:pred.latency<25?C.green:C.amber, textShadow:`0 0 16px ${pred.latency<25?C.green:C.amber}` }}>{pred.latency}ms</div>
                      </div>
                    </div>
                    <LatencyChart history={latHist} />
                  </>
                ) : (
                  <div style={{ fontFamily:F.mono, fontSize:14, letterSpacing:"0.5px", color:C.dim, padding:"40px 0", textAlign:"center" }}>
                    Run the pipeline to see live predictions
                  </div>
                )}
              </GlassCard>

              <GlassCard style={{ padding:22, display:"flex", flexDirection:"column" }}>
                <SectionHeader>Pipeline Logs</SectionHeader>
                <div ref={logRef} style={{
                  flex:1, minHeight:240, maxHeight:320, overflowY:"auto",
                  background:"rgba(0,0,0,0.45)", borderRadius:6, padding:14,
                  border:`1px solid ${C.border}`,
                  position:"relative",
                }}>
                  {/* Scanline effect */}
                  <div style={{
                    position:"absolute", inset:0, pointerEvents:"none", zIndex:1,
                    backgroundImage:"repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.08) 2px, rgba(0,0,0,0.08) 4px)",
                    borderRadius:6,
                  }} />
                  <div style={{ position:"relative", zIndex:2 }}>
                    {logs.length===0 ? (
                      <div style={{ fontFamily:F.mono, fontSize:13, color:C.dim, padding:"40px 0", textAlign:"center" }}>
                        Waiting for pipeline execution…
                      </div>
                    ) : logs.map((l,i) => <LogEntry key={i} {...l} />)}
                  </div>
                </div>
              </GlassCard>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
