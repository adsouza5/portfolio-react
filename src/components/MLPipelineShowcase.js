import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";

// ── Portfolio design tokens ───────────────────────────────────
const C = {
  bg:      "#0c1818",
  surface: "rgba(255,255,255,0.022)",
  border:  "rgba(255,255,255,0.07)",
  text:    "#E8E8E8",
  muted:   "rgba(232,232,232,0.45)",
  dim:     "rgba(232,232,232,0.22)",
  accent:  "#177E89",
  glow:    "rgba(23,126,137,0.35)",
  glowSm:  "rgba(23,126,137,0.12)",
  green:   "#22c55e",
  greenGl: "rgba(34,197,94,0.18)",
  amber:   "#e8a838",
  amberGl: "rgba(232,168,56,0.15)",
  purple:  "#a855f7",
  purpleGl:"rgba(168,85,247,0.18)",
  red:     "#ef4444",
};

const GRID = `
  linear-gradient(rgba(23,126,137,0.04) 1px, transparent 1px),
  linear-gradient(90deg, rgba(23,126,137,0.04) 1px, transparent 1px)
`;

const F = {
  mono:    "'Courier New', Courier, monospace",
  display: "'Franklin Gothic Medium','Arial Narrow',Arial,sans-serif",
  sans:    "'Segoe UI',system-ui,sans-serif",
};

const STAGES = [
  { id:"ingest",     label:"Pub/Sub\nIngest",       icon:"⟐", color:C.accent, glow:C.glowSm },
  { id:"preprocess", label:"Cloud Run\nPreprocess", icon:"⚙",  color:C.amber,  glow:C.amberGl },
  { id:"inference",  label:"Vertex AI\nInference",  icon:"◈",  color:C.purple, glow:C.purpleGl },
  { id:"store",      label:"BigQuery\nStore",       icon:"⬡",  color:C.green,  glow:C.greenGl },
  { id:"serve",      label:"API\nResponse",         icon:"↗",  color:C.accent, glow:C.glowSm },
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
  { title:"Data Ingestion",   color:C.accent, desc:"Pub/Sub topic receives streaming market data events. Cloud Functions trigger on new messages, batching for throughput optimization.", details:["Message ordering guarantees","Dead-letter queue for failures","Auto-scaling subscribers"] },
  { title:"Preprocessing",    color:C.amber,  desc:"Cloud Run service normalizes raw data into feature vectors. Stateless containers scale to zero when idle.",                         details:["Feature normalization pipeline","Schema validation","Scale-to-zero cost optimization"] },
  { title:"Model Inference",  color:C.purple, desc:"Vertex AI endpoint hosts the sentiment classifier. Custom prediction routines handle pre/post processing at the model layer.",      details:["Custom container serving","A/B model deployment","Auto-scaling on GPU"] },
  { title:"Storage & Serving",color:C.green,  desc:"Predictions land in BigQuery partitioned by date. FastAPI serves real-time results via Cloud Run with Redis caching.",             details:["Partitioned tables by date","Sub-second API responses","Grafana monitoring dashboard"] },
];

// ── Sub-components ────────────────────────────────────────────

function PipelineNode({ stage, active, complete, progress }) {
  return (
    <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:10, position:"relative" }}>
      <div style={{
        width:64, height:64, borderRadius:8,
        display:"flex", alignItems:"center", justifyContent:"center",
        fontSize:24, position:"relative", overflow:"hidden",
        background: active || complete ? `rgba(23,126,137,0.08)` : C.surface,
        border:`1px solid ${active ? stage.color : complete ? stage.color+"70" : C.border}`,
        boxShadow: active ? `0 0 20px ${stage.glow}, 0 0 40px ${stage.glow}` : "none",
        transition:"all 0.35s ease",
      }}>
        {active && (
          <div style={{
            position:"absolute", bottom:0, left:0, right:0,
            height:`${(progress||0)*100}%`,
            background:`linear-gradient(to top, ${stage.color}28, transparent)`,
            transition:"height 0.25s ease",
          }} />
        )}
        <span style={{ position:"relative", zIndex:1, color: active ? stage.color : complete ? C.muted : C.dim, transition:"color 0.3s" }}>
          {stage.icon}
        </span>
      </div>
      <span style={{
        fontFamily:F.mono, fontSize:9.5, letterSpacing:"0.05em",
        color: active ? stage.color : complete ? C.muted : C.dim,
        textAlign:"center", whiteSpace:"pre", lineHeight:1.45, transition:"color 0.3s",
      }}>
        {stage.label}
      </span>
      {active && (
        <div style={{
          position:"absolute", top:-3, right:-3,
          width:8, height:8, borderRadius:"50%",
          background:stage.color, boxShadow:`0 0 8px ${stage.color}`,
          animation:"pulse 1.4s ease-in-out infinite",
        }} />
      )}
    </div>
  );
}

function Connector({ active, complete, color }) {
  return (
    <div style={{
      flex:1, height:1, alignSelf:"center", marginBottom:24,
      minWidth:14, maxWidth:48,
      background: complete ? `${color}55` : C.border,
      position:"relative", overflow:"hidden",
    }}>
      {active && (
        <div style={{
          position:"absolute", top:0, left:0, height:"100%", width:"35%",
          background:`linear-gradient(90deg, transparent, ${color}, transparent)`,
          animation:"flowRight 0.9s linear infinite",
        }} />
      )}
    </div>
  );
}

function Card({ children, style }) {
  return (
    <div style={{
      background:C.surface,
      border:`1px solid ${C.border}`,
      borderRadius:5,
      ...style,
    }}>
      {children}
    </div>
  );
}

function SectionLabel({ children }) {
  return (
    <div style={{ fontFamily:F.mono, fontSize:10, letterSpacing:"2px", textTransform:"uppercase", color:C.dim, marginBottom:20 }}>
      {children}
    </div>
  );
}

function MetricCard({ label, value, unit, color, note }) {
  return (
    <div style={{
      flex:1, minWidth:110, background:C.surface,
      border:`1px solid ${C.border}`, borderRadius:5,
      borderTop:`2px solid ${color||C.accent}`,
      padding:"14px 16px",
    }}>
      <div style={{ fontFamily:F.mono, fontSize:9, letterSpacing:"1.5px", textTransform:"uppercase", color:C.dim, marginBottom:7 }}>{label}</div>
      <div style={{ display:"flex", alignItems:"baseline", gap:4 }}>
        <span style={{ fontFamily:F.mono, fontSize:24, fontWeight:700, color:color||C.text }}>{value}</span>
        {unit && <span style={{ fontFamily:F.mono, fontSize:11, color:C.dim }}>{unit}</span>}
      </div>
      {note && <div style={{ fontFamily:F.mono, fontSize:9, color:C.dim, marginTop:4, letterSpacing:"0.5px" }}>{note}</div>}
    </div>
  );
}

function LogEntry({ message, type, timestamp }) {
  const typeColor = { info:C.accent, success:C.green, warning:C.amber, processing:C.purple, data:C.muted };
  const typeIcon  = { success:"✓", warning:"!", processing:"◌", data:"›", info:"·" };
  return (
    <div style={{ fontFamily:F.mono, fontSize:11, lineHeight:1.75, display:"flex", gap:10 }}>
      <span style={{ color:C.dim, flexShrink:0 }}>{timestamp}</span>
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
      <div style={{ fontFamily:F.mono, fontSize:9, letterSpacing:"1.5px", textTransform:"uppercase", color:C.dim, marginBottom:8 }}>Latency (ms)</div>
      <div style={{ display:"flex", alignItems:"flex-end", gap:3, height:64 }}>
        {history.map((h, i) => {
          const ht  = (h.latency/max)*64;
          const col = h.latency < 25 ? C.green : h.latency < 35 ? C.amber : C.red;
          return (
            <div key={i} title={`${h.latency}ms — ${h.ticker}`} style={{
              width:barW, height:ht, borderRadius:"2px 2px 0 0",
              background:col, opacity: i===history.length-1 ? 0.9 : 0.4,
              transition:"height 0.35s ease",
            }} />
          );
        })}
      </div>
      <div style={{ display:"flex", justifyContent:"space-between", marginTop:4 }}>
        <span style={{ fontFamily:F.mono, fontSize:9, color:C.dim }}>0ms</span>
        <span style={{ fontFamily:F.mono, fontSize:9, color:C.dim }}>{max}ms</span>
      </div>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────

export default function MLPipelineShowcase() {
  const navigate = useNavigate();
  const [view, setView]     = useState("architecture");
  const [running, setRunning] = useState(false);
  const [activeStage, setActive] = useState(-1);
  const [progress, setProgress]  = useState(0);
  const [logs, setLogs]          = useState([]);
  const [count, setCount]        = useState(0);
  const [latHist, setLatHist]    = useState([]);
  const [pred, setPred]          = useState(null);
  const [avgLat, setAvgLat]      = useState(0);
  const [avgConf, setAvgConf]    = useState(0);
  const logRef = useRef(null);
  const runRef = useRef(false);

  const addLog = useCallback((message, type="info") => {
    const d = new Date();
    const ts = [d.getHours(),d.getMinutes(),d.getSeconds()].map(v=>String(v).padStart(2,"0")).join(":")
      + "." + String(d.getMilliseconds()).padStart(3,"0");
    setLogs(p => [...p.slice(-50), { message, type, timestamp:ts }]);
  }, []);

  useEffect(() => { if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight; }, [logs]);

  const sleep = ms => new Promise(r => setTimeout(r, ms));

  const runPipeline = useCallback(async () => {
    if (runRef.current) return;
    runRef.current = true;
    setRunning(true); setLogs([]); setActive(-1); setCount(0);
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
      for (let x=0;x<=10;x++){setProgress(x/10);await sleep(55);} await sleep(180);
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
      for (let x=0;x<=10;x++){setProgress(x/10);await sleep(28);} await sleep(180);
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
    <div style={{
      background:C.bg,
      backgroundImage:GRID,
      backgroundSize:"50px 50px",
      minHeight:"100vh", color:C.text,
      fontFamily:F.sans, overflowX:"hidden",
    }}>
      <style>{`
        @keyframes pulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:0.5;transform:scale(1.4)}}
        @keyframes flowRight{0%{transform:translateX(-100%)}100%{transform:translateX(400%)}}
        @keyframes fadeUp{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:translateY(0)}}
        *{box-sizing:border-box;margin:0;padding:0}
        ::-webkit-scrollbar{width:4px;height:4px}
        ::-webkit-scrollbar-track{background:transparent}
        ::-webkit-scrollbar-thumb{background:rgba(23,126,137,0.3);border-radius:2px}
      `}</style>

      {/* Subtle teal ambient glow top-left */}
      <div style={{
        position:"fixed", inset:0, pointerEvents:"none", zIndex:0,
        background:`radial-gradient(ellipse 60% 40% at 10% 0%, rgba(23,126,137,0.08) 0%, transparent 60%)`,
      }} />

      {/* Back button */}
      <button
        onClick={() => navigate("/", { state:{ scrollTo:"projects" } })}
        style={{
          position:"fixed", top:20, left:20, zIndex:100,
          display:"inline-flex", alignItems:"center", gap:8,
          fontFamily:F.mono, fontSize:11, letterSpacing:"2px", textTransform:"uppercase",
          color:C.muted, background:"rgba(12,24,24,0.85)",
          border:`1px solid ${C.border}`, borderRadius:4,
          padding:"9px 16px", cursor:"pointer", backdropFilter:"blur(12px)",
          transition:"color 0.2s, border-color 0.2s, box-shadow 0.2s",
        }}
        onMouseEnter={e=>{e.currentTarget.style.color=C.text;e.currentTarget.style.borderColor=C.accent;e.currentTarget.style.boxShadow=`0 0 16px ${C.glowSm}`;}}
        onMouseLeave={e=>{e.currentTarget.style.color=C.muted;e.currentTarget.style.borderColor=C.border;e.currentTarget.style.boxShadow="none";}}
      >
        ← Timeline
      </button>

      <div style={{ maxWidth:1000, margin:"0 auto", padding:"68px 28px 56px", position:"relative", zIndex:1 }}>

        {/* ── Hero ── */}
        <div style={{ marginBottom:44, animation:"fadeUp 0.5s ease" }}>
          <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:16 }}>
            <span style={{
              fontFamily:F.mono, fontSize:10, letterSpacing:"2px", textTransform:"uppercase",
              color:C.accent, background:"rgba(23,126,137,0.1)",
              padding:"3px 10px", borderRadius:2,
              border:"1px solid rgba(23,126,137,0.28)",
            }}>Project</span>
            <span style={{ fontFamily:F.mono, fontSize:10, letterSpacing:"1.5px", color:C.dim }}>
              GCP · Vertex AI · Cloud Run · BigQuery
            </span>
          </div>

          <h1 style={{
            fontFamily:F.display, fontSize:"clamp(26px,4vw,40px)",
            fontWeight:700, letterSpacing:"1px",
            color:C.text, lineHeight:1.15, marginBottom:14,
            textShadow:`0 0 40px ${C.glowSm}`,
          }}>
            Real-Time ML Inference Pipeline
          </h1>

          <p style={{ fontFamily:F.sans, fontSize:14, color:C.muted, lineHeight:1.75, maxWidth:580, marginBottom:16 }}>
            Streaming market data through a serverless ML pipeline — ingestion via Pub/Sub,
            preprocessing on Cloud Run, inference on Vertex AI, storage in BigQuery.
          </p>

          <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
            {["Vertex AI","Cloud Run","Pub/Sub","BigQuery","Terraform","Python","FastAPI"].map(t => (
              <span key={t} style={{
                fontFamily:F.mono, fontSize:10, letterSpacing:"0.5px",
                color:C.dim, background:C.surface,
                border:`1px solid ${C.border}`, borderRadius:2, padding:"3px 9px",
              }}>{t}</span>
            ))}
          </div>
        </div>

        {/* ── Tabs ── */}
        <div style={{
          display:"flex", gap:0, marginBottom:32,
          borderBottom:`1px solid ${C.border}`,
          animation:"fadeUp 0.5s ease 0.1s both",
        }}>
          {[{id:"architecture",label:"Architecture"},{id:"simulation",label:"Live Simulation"}].map(tab => (
            <button key={tab.id} onClick={()=>setView(tab.id)} style={{
              fontFamily:F.mono, fontSize:11, letterSpacing:"1.5px", textTransform:"uppercase",
              padding:"10px 24px", border:"none", cursor:"pointer", background:"transparent",
              color: view===tab.id ? C.accent : C.dim,
              borderBottom: view===tab.id ? `2px solid ${C.accent}` : "2px solid transparent",
              marginBottom:-1, transition:"all 0.2s",
            }}>{tab.label}</button>
          ))}
        </div>

        {/* ── Architecture ── */}
        {view==="architecture" && (
          <div style={{ animation:"fadeUp 0.35s ease" }}>
            <Card style={{ padding:"28px 32px", marginBottom:20 }}>
              <SectionLabel>Pipeline Architecture</SectionLabel>
              <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"center", flexWrap:"wrap" }}>
                {STAGES.map((stage,i) => (
                  <div key={stage.id} style={{ display:"flex", alignItems:"flex-start" }}>
                    <PipelineNode stage={stage} active={false} complete={false} progress={0} />
                    {i<STAGES.length-1 && <Connector active={false} complete={false} color={C.border} />}
                  </div>
                ))}
              </div>
            </Card>

            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14, marginBottom:14 }}>
              {ARCH.map(s => (
                <div key={s.title} style={{
                  background:C.surface, border:`1px solid ${C.border}`,
                  borderLeft:`2px solid ${s.color}`, borderRadius:5, padding:20,
                  transition:"box-shadow 0.2s",
                }}>
                  <div style={{ fontFamily:F.display, fontSize:15, letterSpacing:"0.5px", color:C.text, marginBottom:8, display:"flex", alignItems:"center", gap:8 }}>
                    <span style={{ width:5, height:5, borderRadius:"50%", background:s.color, display:"inline-block", boxShadow:`0 0 6px ${s.color}` }} />
                    {s.title}
                  </div>
                  <div style={{ fontFamily:F.sans, fontSize:13, color:C.muted, lineHeight:1.7, marginBottom:12 }}>{s.desc}</div>
                  {s.details.map(d => (
                    <div key={d} style={{ fontFamily:F.mono, fontSize:10, letterSpacing:"0.5px", color:C.dim, display:"flex", gap:8, marginBottom:4 }}>
                      <span style={{ color:s.color }}>›</span>{d}
                    </div>
                  ))}
                </div>
              ))}
            </div>

            <Card style={{ padding:"14px 20px", display:"flex", alignItems:"center", gap:16 }}>
              <span style={{ fontSize:20, color:C.accent, opacity:0.7 }}>⎔</span>
              <div>
                <div style={{ fontFamily:F.mono, fontSize:11, letterSpacing:"1px", color:C.text, marginBottom:4 }}>Infrastructure as Code</div>
                <div style={{ fontFamily:F.sans, fontSize:13, color:C.muted, lineHeight:1.6 }}>
                  Entire pipeline provisioned via Terraform — Pub/Sub topics, Cloud Run services,
                  Vertex AI endpoints, BigQuery datasets, IAM bindings, and monitoring alerts.
                </div>
              </div>
            </Card>
          </div>
        )}

        {/* ── Simulation ── */}
        {view==="simulation" && (
          <div style={{ animation:"fadeUp 0.35s ease" }}>
            <Card style={{ padding:"24px 28px", marginBottom:16 }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:24 }}>
                <div>
                  <SectionLabel>Pipeline Status</SectionLabel>
                  <div style={{ fontFamily:F.mono, fontSize:11, letterSpacing:"1px", color: running ? C.green : logs.length>0 ? C.muted : C.dim }}>
                    {running ? "● RUNNING" : logs.length>0 ? "● COMPLETE" : "○ IDLE"}
                  </div>
                </div>
                <button
                  onClick={running ? stopPipeline : runPipeline}
                  style={{
                    fontFamily:F.mono, fontSize:11, letterSpacing:"2px", textTransform:"uppercase",
                    padding:"10px 24px", borderRadius:3, border:"none", cursor:"pointer", fontWeight:600,
                    background: running ? C.red : C.accent,
                    color:"#0c1818",
                    boxShadow: running ? `0 4px 16px rgba(239,68,68,0.35)` : `0 4px 20px ${C.glow}`,
                    transition:"all 0.2s",
                  }}
                >{running ? "■ Stop" : "▶ Run Pipeline"}</button>
              </div>
              <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"center", flexWrap:"wrap" }}>
                {STAGES.map((stage,i) => (
                  <div key={stage.id} style={{ display:"flex", alignItems:"flex-start" }}>
                    <PipelineNode stage={stage} active={activeStage===i} complete={activeStage>i} progress={activeStage===i?progress:0} />
                    {i<STAGES.length-1 && <Connector active={activeStage===i} complete={activeStage>i} color={stage.color} />}
                  </div>
                ))}
              </div>
            </Card>

            <div style={{ display:"flex", gap:12, marginBottom:16, flexWrap:"wrap" }}>
              <MetricCard label="Processed"      value={count}               unit={`/ ${SAMPLES.length}`} color={C.accent}                                note="messages" />
              <MetricCard label="Avg Latency"    value={avgLat||"—"}         unit={avgLat?"ms":""}        color={avgLat<25?C.green:avgLat?C.amber:C.dim}  note={avgLat?"inference time":""} />
              <MetricCard label="Avg Confidence" value={avgConf?`${avgConf}`:"—"} unit={avgConf?"%":""}  color={C.purple}                                note={avgConf?"model certainty":""} />
              <MetricCard label="Uptime"         value="99.9"                unit="%"                     color={C.green}                                 note="last 30 days" />
            </div>

            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16 }}>
              <Card style={{ padding:20 }}>
                <SectionLabel>Latest Prediction</SectionLabel>
                {pred ? (
                  <>
                    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
                      <span style={{ fontFamily:F.display, fontSize:28, fontWeight:700, color:C.text, letterSpacing:"1px" }}>{pred.ticker}</span>
                      <span style={{
                        fontFamily:F.mono, fontSize:11, fontWeight:700, letterSpacing:"2px",
                        color:predColor, background:`${predColor}18`,
                        padding:"5px 14px", borderRadius:2,
                        border:`1px solid ${predColor}40`,
                        boxShadow:`0 0 14px ${predColor}25`,
                      }}>{pred.prediction}</span>
                    </div>
                    <div style={{ display:"flex", gap:24, marginBottom:20 }}>
                      <div>
                        <div style={{ fontFamily:F.mono, fontSize:9, letterSpacing:"1.5px", textTransform:"uppercase", color:C.dim, marginBottom:4 }}>Confidence</div>
                        <div style={{ fontFamily:F.mono, fontSize:20, fontWeight:700, color:C.purple }}>{(pred.confidence*100).toFixed(1)}%</div>
                      </div>
                      <div>
                        <div style={{ fontFamily:F.mono, fontSize:9, letterSpacing:"1.5px", textTransform:"uppercase", color:C.dim, marginBottom:4 }}>Latency</div>
                        <div style={{ fontFamily:F.mono, fontSize:20, fontWeight:700, color:pred.latency<25?C.green:C.amber }}>{pred.latency}ms</div>
                      </div>
                    </div>
                    <LatencyChart history={latHist} />
                  </>
                ) : (
                  <div style={{ fontFamily:F.mono, fontSize:12, letterSpacing:"0.5px", color:C.dim, padding:"36px 0", textAlign:"center" }}>
                    Run pipeline to see live predictions
                  </div>
                )}
              </Card>

              <Card style={{ padding:20, display:"flex", flexDirection:"column" }}>
                <SectionLabel>Pipeline Logs</SectionLabel>
                <div ref={logRef} style={{
                  flex:1, minHeight:240, maxHeight:320, overflowY:"auto",
                  background:"rgba(0,0,0,0.3)", borderRadius:3, padding:14,
                  border:`1px solid ${C.border}`,
                }}>
                  {logs.length===0 ? (
                    <div style={{ fontFamily:F.mono, fontSize:11, color:C.dim, padding:"40px 0", textAlign:"center" }}>
                      Waiting for pipeline execution…
                    </div>
                  ) : logs.map((l,i) => <LogEntry key={i} {...l} />)}
                </div>
              </Card>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
