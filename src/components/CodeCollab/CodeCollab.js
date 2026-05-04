import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Editor } from '@monaco-editor/react';
import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';
import './CodeCollab.css';

// ── Constants ─────────────────────────────────────────────────
const RELAY_URL  = 'wss://portfolio-react-1e8x.onrender.com';
const LOBBY_ROOM = 'codecollab-lobby-v1';
const LANGUAGES  = ['javascript','typescript','python','go','rust','java','html','css','json','markdown'];
const USER_COLORS = [
  '#5b9cf6','#6bcb8b','#c084fc','#f9a96b','#5dd8d8',
  '#f87ba6','#fbbf24','#93c5fd','#86efac','#d8b4fe',
];
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const EXECUTABLE = new Set(['javascript','typescript','python','go','rust','java','c','cpp']);

// ── Helpers ───────────────────────────────────────────────────
function colorFromId(id) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (Math.imul(31, h) + id.charCodeAt(i)) | 0;
  return USER_COLORS[Math.abs(h) % USER_COLORS.length];
}
function uid() { return Math.random().toString(36).slice(2, 10); }

function genCode() {
  return Array.from({ length: 8 }, () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]).join('');
}
function formatCode(code) {
  return `${code.slice(0, 4)} ${code.slice(4)}`;
}

async function hashPasscode(raw) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(raw.trim()));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2,'0')).join('');
}

async function runOnPiston(language, content) {
  const res = await fetch('https://emkc.org/api/v2/piston/execute', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ language, version: '*', files: [{ content }] }),
  });
  const data = await res.json();
  return { stdout: data.run?.stdout ?? '', stderr: data.run?.stderr ?? '' };
}

// ── Camera hook ───────────────────────────────────────────────
function useCamera() {
  const [on, setOn]       = useState(false);
  const [error, setError] = useState(null);
  const streamRef         = useRef(null);
  const videoRef          = useRef(null);

  const toggle = useCallback(async () => {
    if (on) {
      streamRef.current?.getTracks().forEach(t => t.stop());
      streamRef.current = null;
      if (videoRef.current) videoRef.current.srcObject = null;
      setOn(false);
      setError(null);
    } else {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        streamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;
        setOn(true);
        setError(null);
      } catch {
        setError('Camera access denied.');
      }
    }
  }, [on]);

  useEffect(() => () => streamRef.current?.getTracks().forEach(t => t.stop()), []);

  return { on, toggle, videoRef, error };
}

// ── Camera Preview ────────────────────────────────────────────
function CameraPreview({ videoRef, userColor }) {
  return (
    <div className="cc-camera-wrap" style={{ borderColor: userColor }}>
      <video ref={videoRef} autoPlay muted playsInline className="cc-camera-video" />
    </div>
  );
}

// ── Camera Icons ──────────────────────────────────────────────
const IconCamera = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M23 7l-7 5 7 5V7z"/><rect x="1" y="5" width="15" height="14" rx="2"/>
  </svg>
);
const IconCameraOff = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="1" y1="1" x2="23" y2="23"/>
    <path d="M16 16v1a2 2 0 01-2 2H3a2 2 0 01-2-2V7a2 2 0 012-2h2m5.66 0H14a2 2 0 012 2v3.34l1 1L23 7v10"/>
  </svg>
);

// ── Lobby ─────────────────────────────────────────────────────
function SessionLobby({ sessions, onJoin, onCreate, onJoinByCode, onBack }) {
  return (
    <div className="cc-join-screen">
      <button className="cc-back-btn" onClick={onBack}>← Timeline</button>
      <div className="cc-lobby-card">
        <div className="cc-logo">◈ CodeCollab</div>
        <p className="cc-join-sub">Join a live session or start a new one</p>
        <div className="cc-session-list">
          {sessions.length === 0 ? (
            <p className="cc-session-empty">No sessions visible on this network.</p>
          ) : (
            sessions.map(s => (
              <button key={s.id} className="cc-session-item" onClick={() => onJoin(s)}>
                <span className="cc-session-dot" />
                <span className="cc-session-name">{s.displayName}</span>
                <span className="cc-session-meta">by {s.creatorName}</span>
                <span className="cc-session-arrow">→</span>
              </button>
            ))
          )}
        </div>
        <div className="cc-lobby-actions">
          <button className="cc-create-btn" onClick={onCreate}>+ New Session</button>
          <button className="cc-code-join-btn" onClick={onJoinByCode}>Enter code →</button>
        </div>
      </div>
    </div>
  );
}

// ── Create session form ───────────────────────────────────────
function CreateSessionForm({ onConfirm, onBack }) {
  const [displayName, setDisplayName] = useState('');
  const [yourName, setYourName]       = useState('');
  const [passcode, setPasscode]       = useState('');
  const [confirm, setConfirm]         = useState('');
  const [err, setErr]                 = useState('');
  const [loading, setLoading]         = useState(false);

  const submit = async () => {
    if (!displayName.trim() || !yourName.trim() || !passcode.trim()) return setErr('All fields are required.');
    if (passcode !== confirm) return setErr('Passcodes do not match.');
    setLoading(true);
    const passcodeHash = await hashPasscode(passcode);
    onConfirm({ displayName: displayName.trim(), yourName: yourName.trim(), passcodeHash });
  };

  return (
    <div className="cc-join-screen">
      <button className="cc-back-btn" onClick={onBack}>← Sessions</button>
      <div className="cc-join-card">
        <div className="cc-logo">◈ New Session</div>
        <label className="cc-join-label">Session name</label>
        <input className="cc-join-input" placeholder="e.g. Sprint 4 API work" value={displayName}
          onChange={e => setDisplayName(e.target.value)} autoFocus />
        <label className="cc-join-label">Your name</label>
        <input className="cc-join-input" placeholder="e.g. Adam" value={yourName}
          onChange={e => setYourName(e.target.value)} />
        <label className="cc-join-label">Passcode</label>
        <input className="cc-join-input" type="password" placeholder="Share this with collaborators"
          value={passcode} onChange={e => setPasscode(e.target.value)} />
        <label className="cc-join-label">Confirm passcode</label>
        <input className="cc-join-input" type="password" placeholder="Re-enter passcode"
          value={confirm} onChange={e => setConfirm(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && submit()} />
        {err && <p className="cc-join-error">{err}</p>}
        <button className="cc-join-btn" onClick={submit} disabled={loading}>
          {loading ? 'Creating…' : 'Create & Join →'}
        </button>
      </div>
    </div>
  );
}

// ── Enter passcode ────────────────────────────────────────────
function EnterPasscodeForm({ session, onConfirm, onBack }) {
  const [yourName, setYourName] = useState('');
  const [passcode, setPasscode] = useState('');
  const [err, setErr]           = useState('');
  const [loading, setLoading]   = useState(false);

  const submit = async () => {
    if (!yourName.trim() || !passcode.trim()) return setErr('All fields are required.');
    setLoading(true);
    const hash = await hashPasscode(passcode);
    if (hash !== session.passcodeHash) { setLoading(false); return setErr('Incorrect passcode.'); }
    onConfirm({ yourName: yourName.trim() });
  };

  return (
    <div className="cc-join-screen">
      <button className="cc-back-btn" onClick={onBack}>← Sessions</button>
      <div className="cc-join-card">
        <div className="cc-logo">◈ Join Session</div>
        <p className="cc-join-sub" style={{ fontWeight: 500 }}>{session.displayName}</p>
        <p className="cc-join-sub">Created by {session.creatorName}</p>
        <label className="cc-join-label">Your name</label>
        <input className="cc-join-input" placeholder="e.g. Adam" value={yourName}
          onChange={e => setYourName(e.target.value)} autoFocus />
        <label className="cc-join-label">Passcode</label>
        <input className="cc-join-input" type="password" placeholder="Enter session passcode"
          value={passcode} onChange={e => setPasscode(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && submit()} />
        {err && <p className="cc-join-error">{err}</p>}
        <button className="cc-join-btn" onClick={submit} disabled={loading}>
          {loading ? 'Joining…' : 'Join Session →'}
        </button>
      </div>
    </div>
  );
}

// ── Join by code form ─────────────────────────────────────────
function JoinByCodeForm({ onConfirm, onBack }) {
  const [code, setCode]         = useState('');
  const [yourName, setYourName] = useState('');
  const [err, setErr]           = useState('');

  const submit = () => {
    const clean = code.trim().replace(/\s/g, '').toUpperCase();
    if (clean.length !== 8) return setErr('Enter the full 8-character session code.');
    if (!yourName.trim()) return setErr('Enter your name.');
    onConfirm({ code: clean, yourName: yourName.trim() });
  };

  return (
    <div className="cc-join-screen">
      <button className="cc-back-btn" onClick={onBack}>← Sessions</button>
      <div className="cc-join-card">
        <div className="cc-logo">◈ Join by Code</div>
        <p className="cc-join-sub">Ask the session host for their 8-character code</p>
        <label className="cc-join-label">Session code</label>
        <input className="cc-join-input cc-join-code-input" placeholder="XXXX XXXX"
          value={code} onChange={e => setCode(e.target.value.toUpperCase())}
          maxLength={9} autoFocus spellCheck={false} />
        <label className="cc-join-label">Your name</label>
        <input className="cc-join-input" placeholder="e.g. Alex" value={yourName}
          onChange={e => setYourName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && submit()} />
        {err && <p className="cc-join-error">{err}</p>}
        <button className="cc-join-btn" onClick={submit}>Join →</button>
      </div>
    </div>
  );
}

// ── User Pill ─────────────────────────────────────────────────
function UserPill({ user, isYou }) {
  return (
    <div className="cc-user-pill" title={user.name}>
      <span className="cc-user-dot" style={{ background: user.color }} />
      <span className="cc-user-name">
        {user.name}{isYou && <span className="cc-user-you"> you</span>}
      </span>
    </div>
  );
}

// ── New Segment Form ──────────────────────────────────────────
function NewSegmentForm({ onConfirm, onCancel }) {
  const [name, setName]         = useState('');
  const [language, setLanguage] = useState('javascript');
  const submit = () => { if (name.trim()) onConfirm({ name: name.trim(), language }); };
  return (
    <div className="cc-tab-new-form">
      <input className="cc-tab-new-input" placeholder="Segment name" value={name}
        onChange={e => setName(e.target.value)} autoFocus
        onKeyDown={e => { if (e.key === 'Enter') submit(); if (e.key === 'Escape') onCancel(); }} />
      <select className="cc-tab-new-lang" value={language} onChange={e => setLanguage(e.target.value)}>
        {LANGUAGES.map(l => <option key={l} value={l}>{l}</option>)}
      </select>
      <button className="cc-tab-new-confirm" onClick={submit}>Create</button>
      <button className="cc-tab-new-cancel" onClick={onCancel}>✕</button>
    </div>
  );
}

// ── Session Code Badge ────────────────────────────────────────
function SessionCodeBadge({ code, onDismiss }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(formatCode(code)).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    });
  };
  return (
    <div className="cc-code-badge">
      <span className="cc-code-badge-label">code</span>
      <span className="cc-code-badge-value">{formatCode(code)}</span>
      <button className="cc-code-badge-copy" onClick={copy}>{copied ? '✓' : 'copy'}</button>
      <button className="cc-code-badge-dismiss" onClick={onDismiss} title="Dismiss">✕</button>
    </div>
  );
}

// ── Terminal Panel ────────────────────────────────────────────
function TerminalPanel({ outputs, running, isOwner, onClear, height }) {
  const bodyRef = useRef(null);

  useEffect(() => {
    if (bodyRef.current) bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
  }, [outputs, running]);

  return (
    <div className="cc-terminal" style={{ height }}>
      <div className="cc-terminal-header">
        <span className="cc-terminal-title">▸ Output</span>
        <div className="cc-terminal-actions">
          {isOwner && outputs.length > 0 && (
            <button className="cc-terminal-clear-btn" onClick={onClear}>Clear</button>
          )}
        </div>
      </div>
      <div className="cc-terminal-body" ref={bodyRef}>
        {outputs.length === 0 && !running && (
          <div className="cc-terminal-empty-msg">
            {isOwner
              ? 'Click ▶ Run to execute — all collaborators will see the output in real time.'
              : 'Waiting for the segment owner to run the code…'}
          </div>
        )}
        {outputs.map((entry, i) => (
          <div key={i} className="cc-terminal-entry">
            <div className="cc-terminal-entry-meta">
              <span className="cc-terminal-entry-dot" style={{ background: entry.runByColor }} />
              <span className="cc-terminal-entry-name" style={{ color: entry.runByColor }}>
                {entry.runBy}
              </span>
              <span className="cc-terminal-entry-time">
                {new Date(entry.timestamp).toLocaleTimeString([], {
                  hour: '2-digit', minute: '2-digit', second: '2-digit',
                })}
              </span>
            </div>
            {entry.stdout && <pre className="cc-terminal-stdout">{entry.stdout}</pre>}
            {entry.stderr && <pre className="cc-terminal-stderr">{entry.stderr}</pre>}
            {!entry.stdout && !entry.stderr && (
              <pre className="cc-terminal-stdout cc-terminal-no-output">(no output)</pre>
            )}
          </div>
        ))}
        {running && (
          <div className="cc-terminal-running">
            <span className="cc-terminal-spinner" />
            <span style={{ color: running.runByColor }}>{running.runBy}</span>
            <span className="cc-terminal-running-label"> is running…</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────
export default function CodeCollab() {
  const navigate = useNavigate();

  const [view, setView]                    = useState('lobby');
  const [sessions, setSessions]            = useState([]);
  const [selectedSession, setSelected]     = useState(null);
  const [user, setUser]                    = useState(null);
  const [users, setUsers]                  = useState([]);
  const [segments, setSegments]            = useState([]);
  const [activeId, setActiveId]            = useState(null);
  const [showNewForm, setShowNewForm]      = useState(false);
  const [creatorCode, setCreatorCode]      = useState(null);
  const [showCode, setShowCode]            = useState(true);
  const [outputs, setOutputs]              = useState({});
  const [running, setRunning]              = useState({});
  const [terminalHeight, setTerminalHeight] = useState(220);

  const camera = useCamera();

  const lobbyDocRef      = useRef(null);
  const lobbyProviderRef = useRef(null);
  const sessionDocRef    = useRef(null);
  const sessionProvRef   = useRef(null);
  const ySegmentsRef     = useRef(null);
  const yOutputsRef      = useRef(null);
  const yRunningRef      = useRef(null);
  const createdSessionId = useRef(null);

  const goBack = useCallback(() => {
    navigate('/', { state: { scrollTo: 'projects' } });
  }, [navigate]);

  // ── Lobby connection ──────────────────────────────────────
  useEffect(() => {
    const doc      = new Y.Doc();
    const provider = new WebsocketProvider(RELAY_URL, LOBBY_ROOM, doc);
    lobbyDocRef.current      = doc;
    lobbyProviderRef.current = provider;

    const syncSessions = () => {
      const list = [];
      provider.awareness.getStates().forEach((state) => {
        if (state?.type === 'session') list.push({ id: state.sessionId, ...state });
      });
      setSessions(list.sort((a, b) => b.createdAt - a.createdAt));
    };
    provider.awareness.on('change', syncSessions);
    syncSessions();
    return () => { provider.destroy(); doc.destroy(); };
  }, []);

  useEffect(() => {
    return () => {
      sessionProvRef.current?.destroy();
      sessionDocRef.current?.destroy();
    };
  }, []);

  // ── Enter a Y.js session room ─────────────────────────────
  const enterSession = useCallback((roomCode, me) => {
    const doc      = new Y.Doc();
    const provider = new WebsocketProvider(RELAY_URL, `codecollab-${roomCode}`, doc);
    const ySegs    = doc.getMap('segments');
    const yOuts    = doc.getMap('outputs');
    const yRun     = doc.getMap('running');

    sessionDocRef.current  = doc;
    sessionProvRef.current = provider;
    ySegmentsRef.current   = ySegs;
    yOutputsRef.current    = yOuts;
    yRunningRef.current    = yRun;

    provider.awareness.setLocalState(me);

    const syncUsers = () => {
      const list = [];
      provider.awareness.getStates().forEach(s => { if (s?.id) list.push(s); });
      setUsers(list);
    };
    provider.awareness.on('change', syncUsers);
    syncUsers();

    const syncSegs = () => {
      const list = [];
      ySegs.forEach((val, key) => list.push({ id: key, ...val }));
      setSegments(list);
    };
    ySegs.observe(syncSegs);
    syncSegs();

    const syncOutputs = () => {
      const map = {};
      yOuts.forEach((val, key) => { map[key] = val ?? []; });
      setOutputs(map);
    };
    yOuts.observe(syncOutputs);
    syncOutputs();

    const syncRunning = () => {
      const map = {};
      yRun.forEach((val, key) => { map[key] = val; });
      setRunning(map);
    };
    yRun.observe(syncRunning);
    syncRunning();

    setUser(me);
    setView('session');
  }, []);

  // ── Create / join ─────────────────────────────────────────
  const handleCreate = useCallback(({ displayName, yourName, passcodeHash }) => {
    const code  = genCode();
    const id    = uid();
    const color = colorFromId(id);
    const me    = { id, name: yourName, color };
    lobbyProviderRef.current?.awareness.setLocalState({
      type: 'session', sessionId: code, displayName, passcodeHash,
      creatorName: yourName, creatorId: id, createdAt: Date.now(),
    });
    createdSessionId.current = code;
    setCreatorCode(code);
    setShowCode(true);
    enterSession(code, me);
  }, [enterSession]);

  const handleJoin = useCallback(({ yourName }) => {
    const id = uid(); const color = colorFromId(id);
    enterSession(selectedSession.sessionId, { id, name: yourName, color });
  }, [selectedSession, enterSession]);

  const handleJoinByCode = useCallback(({ code, yourName }) => {
    const id = uid(); const color = colorFromId(id);
    enterSession(code, { id, name: yourName, color });
  }, [enterSession]);

  // ── Leave session ─────────────────────────────────────────
  const leaveSession = useCallback(() => {
    if (createdSessionId.current) {
      lobbyProviderRef.current?.awareness.setLocalState(null);
      createdSessionId.current = null;
    }
    sessionProvRef.current?.destroy();
    sessionDocRef.current?.destroy();
    sessionProvRef.current = null;
    sessionDocRef.current  = null;
    ySegmentsRef.current   = null;
    yOutputsRef.current    = null;
    yRunningRef.current    = null;
    setUser(null); setUsers([]); setSegments([]); setActiveId(null);
    setOutputs({}); setRunning({}); setCreatorCode(null);
    setView('lobby');
  }, []);

  // ── Segment operations ────────────────────────────────────
  const createSegment = ({ name, language }) => {
    if (!user) return;
    const id = `seg_${Date.now()}`;
    ySegmentsRef.current?.set(id, {
      name, language,
      ownerId: user.id, ownerName: user.name, ownerColor: user.color,
      content: `// ${name}\n// ${user.name}'s workspace\n\n`,
    });
    setShowNewForm(false);
    setActiveId(id);
  };

  const deleteSegment = (segId, e) => {
    e.stopPropagation();
    if (ySegmentsRef.current?.get(segId)?.ownerId !== user?.id) return;
    ySegmentsRef.current.delete(segId);
    yOutputsRef.current?.delete(segId);
    yRunningRef.current?.delete(segId);
    if (activeId === segId) {
      const rest = segments.filter(s => s.id !== segId);
      setActiveId(rest.length > 0 ? rest[0].id : null);
    }
  };

  const handleEditorChange = (content) => {
    if (!activeSegment || activeSegment.ownerId !== user?.id) return;
    const cur = ySegmentsRef.current?.get(activeId);
    if (!cur) return;
    ySegmentsRef.current.set(activeId, { ...cur, content });
  };

  // ── Run & clear ───────────────────────────────────────────
  const handleRun = async () => {
    if (!activeId || !user) return;
    const seg = ySegmentsRef.current?.get(activeId);
    if (!seg || seg.ownerId !== user.id) return;

    yRunningRef.current?.set(activeId, { runBy: user.name, runByColor: user.color });

    const entry = { runBy: user.name, runByColor: user.color, timestamp: Date.now(), stdout: '', stderr: '' };

    if (!EXECUTABLE.has(seg.language)) {
      entry.stderr = `"${seg.language}" is a markup/config language and cannot be executed.`;
    } else {
      try {
        const result = await runOnPiston(seg.language, seg.content);
        entry.stdout = result.stdout;
        entry.stderr = result.stderr;
      } catch (err) {
        entry.stderr = `Execution error: ${err.message}`;
      }
    }

    if (yOutputsRef.current) {
      const existing = yOutputsRef.current.get(activeId) ?? [];
      yOutputsRef.current.set(activeId, [...existing, entry]);
    }
    yRunningRef.current?.set(activeId, null);
  };

  const handleClear = () => {
    if (!activeId) return;
    yOutputsRef.current?.set(activeId, []);
  };

  // ── Resize handle ─────────────────────────────────────────
  const startResize = (e) => {
    e.preventDefault();
    const startY = e.clientY;
    const startH = terminalHeight;
    const onMove = (e) => {
      const delta = startY - e.clientY;
      setTerminalHeight(Math.max(80, Math.min(window.innerHeight * 0.7, startH + delta)));
    };
    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  };

  const activeSegment = segments.find(s => s.id === activeId) ?? null;
  const isOwner       = activeSegment?.ownerId === user?.id;
  const activeOutputs = outputs[activeId] ?? [];
  const activeRunning = running[activeId] ?? null;

  const handleEditorMount = useCallback((editor, monaco) => {
    if (!activeSegment) return;
    const { ownerColor, ownerId } = activeSegment;
    const styleId = `cc-owner-style-${ownerId}`;
    if (!document.getElementById(styleId)) {
      const style = document.createElement('style');
      style.id = styleId;
      style.textContent = `
        .cc-gutter-${ownerId} { background:${ownerColor}; margin-left:2px; width:3px !important; }
        .cc-bg-${ownerId} { background:${ownerColor}12 !important; }
      `;
      document.head.appendChild(style);
    }
    editor.deltaDecorations([], [{
      range: new monaco.Range(1, 1, 999999, 1),
      options: {
        isWholeLine: true,
        linesDecorationsClassName: `cc-gutter-${ownerId}`,
        className: `cc-bg-${ownerId}`,
      },
    }]);
  }, [activeSegment]);

  // ── Render ────────────────────────────────────────────────
  if (view === 'lobby') return (
    <SessionLobby sessions={sessions}
      onJoin={s => { setSelected(s); setView('passcode'); }}
      onCreate={() => setView('create')}
      onJoinByCode={() => setView('joinbycode')}
      onBack={goBack} />
  );
  if (view === 'create') return <CreateSessionForm onConfirm={handleCreate} onBack={() => setView('lobby')} />;
  if (view === 'passcode') return <EnterPasscodeForm session={selectedSession} onConfirm={handleJoin} onBack={() => setView('lobby')} />;
  if (view === 'joinbycode') return <JoinByCodeForm onConfirm={handleJoinByCode} onBack={() => setView('lobby')} />;

  return (
    <div className="cc-app">
      <header className="cc-header">
        <div className="cc-header-left">
          <button className="cc-back-btn cc-back-btn--inline" onClick={leaveSession}>← Sessions</button>
          <span className="cc-logo">◈ CodeCollab</span>
          {creatorCode && showCode && (
            <SessionCodeBadge code={creatorCode} onDismiss={() => setShowCode(false)} />
          )}
        </div>
        <div className="cc-header-users">
          {users.map(u => <UserPill key={u.id} user={u} isYou={u.id === user.id} />)}
        </div>
        <button className={`cc-camera-btn${camera.on ? ' cc-camera-btn--on' : ''}`}
          onClick={camera.toggle} title={camera.on ? 'Turn camera off' : 'Turn camera on'}>
          {camera.on ? <IconCameraOff /> : <IconCamera />}
        </button>
      </header>

      <div className="cc-tab-bar">
        {segments.map(seg => (
          <button key={seg.id}
            className={`cc-tab${activeId === seg.id ? ' cc-tab--active' : ''}`}
            style={{ '--tab-color': seg.ownerColor }}
            onClick={() => setActiveId(seg.id)}>
            <span className="cc-tab-dot" style={{ background: seg.ownerColor }} />
            <span className="cc-tab-name">{seg.name}</span>
            {seg.ownerId === user.id && (
              <span className="cc-tab-close" onClick={e => deleteSegment(seg.id, e)}>×</span>
            )}
          </button>
        ))}
        {showNewForm
          ? <NewSegmentForm onConfirm={createSegment} onCancel={() => setShowNewForm(false)} />
          : <button className="cc-tab-add" onClick={() => setShowNewForm(true)}>+ New Segment</button>
        }
      </div>

      <div className="cc-editor-wrap" style={{ '--owner-color': activeSegment?.ownerColor ?? 'transparent' }}>
        {activeSegment ? (
          <>
            <div className="cc-editor-header">
              <span className="cc-editor-owner" style={{ color: activeSegment.ownerColor }}>
                ● {activeSegment.ownerName}
              </span>
              <span className="cc-editor-seg-name">{activeSegment.name}</span>
              <div className="cc-editor-header-right">
                <span className="cc-editor-lang">{activeSegment.language}</span>
                {!isOwner && <span className="cc-editor-readonly-badge">read-only</span>}
                {isOwner && (
                  <button
                    className={`cc-run-btn${activeRunning ? ' cc-run-btn--running' : ''}`}
                    onClick={handleRun}
                    disabled={!!activeRunning}
                  >
                    {activeRunning ? '⏳ Running…' : '▶ Run'}
                  </button>
                )}
              </div>
            </div>

            <div className="cc-editor-main">
              <Editor
                key={activeId}
                onMount={handleEditorMount}
                height="100%"
                language={activeSegment.language}
                theme="vs-dark"
                value={activeSegment.content}
                onChange={handleEditorChange}
                options={{
                  automaticLayout: true, readOnly: !isOwner, fontSize: 14, lineHeight: 22,
                  fontFamily: "'JetBrains Mono','Fira Code','SF Mono',monospace",
                  minimap: { enabled: false }, scrollBeyondLastLine: false,
                  renderLineHighlight: isOwner ? 'line' : 'none',
                  cursorStyle: isOwner ? 'line' : 'underline',
                  padding: { top: 20, bottom: 20 }, lineNumbers: 'on',
                  glyphMargin: false, folding: true,
                  bracketPairColorization: { enabled: true }, smoothScrolling: true,
                }}
              />
            </div>

            <div className="cc-terminal-resize-handle" onMouseDown={startResize} />

            <TerminalPanel
              outputs={activeOutputs}
              running={activeRunning}
              isOwner={isOwner}
              onClear={handleClear}
              height={terminalHeight}
            />
          </>
        ) : (
          <div className="cc-editor-empty">
            <p>No segments yet — create one to start coding.</p>
            <button className="cc-editor-empty-btn" onClick={() => setShowNewForm(true)}>
              + Create your first segment
            </button>
          </div>
        )}
      </div>

      {camera.on && <CameraPreview videoRef={camera.videoRef} userColor={user?.color} />}
    </div>
  );
}
