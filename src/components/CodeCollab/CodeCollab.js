import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Editor } from '@monaco-editor/react';
import * as Y from 'yjs';
import { WebrtcProvider } from 'y-webrtc';
import './CodeCollab.css';

// ── Constants ─────────────────────────────────────────────────
const SIGNALING  = ['wss://signaling.yjs.dev'];
const LOBBY_ROOM = 'codecollab-lobby-v1';
const LANGUAGES  = ['javascript','typescript','python','go','rust','java','html','css','json','markdown'];
const USER_COLORS = [
  '#5b9cf6','#6bcb8b','#c084fc','#f9a96b','#5dd8d8',
  '#f87ba6','#fbbf24','#93c5fd','#86efac','#d8b4fe',
];

// ── Helpers ───────────────────────────────────────────────────
function colorFromId(id) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (Math.imul(31, h) + id.charCodeAt(i)) | 0;
  return USER_COLORS[Math.abs(h) % USER_COLORS.length];
}
function uid() { return Math.random().toString(36).slice(2, 10); }

async function hashPasscode(raw) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(raw.trim()));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2,'0')).join('');
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

  // cleanup on unmount
  useEffect(() => () => streamRef.current?.getTracks().forEach(t => t.stop()), []);

  return { on, toggle, videoRef, error };
}

// ── Camera Preview (floating) ─────────────────────────────────
function CameraPreview({ videoRef, userColor }) {
  return (
    <div className="cc-camera-wrap" style={{ borderColor: userColor }}>
      <video ref={videoRef} autoPlay muted playsInline className="cc-camera-video" />
    </div>
  );
}

// ── Camera Icon SVGs ──────────────────────────────────────────
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

// ── Lobby: session list ───────────────────────────────────────
function SessionLobby({ sessions, onJoin, onCreate, onBack }) {
  return (
    <div className="cc-join-screen">
      <button className="cc-back-btn" onClick={onBack}>← Timeline</button>
      <div className="cc-lobby-card">
        <div className="cc-logo">◈ CodeCollab</div>
        <p className="cc-join-sub">Join a live session or start a new one</p>

        <div className="cc-session-list">
          {sessions.length === 0 ? (
            <p className="cc-session-empty">No active sessions yet.</p>
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

        <button className="cc-create-btn" onClick={onCreate}>+ New Session</button>
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
          onChange={e => setDisplayName(e.target.value)} />

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

// ── Enter passcode form ───────────────────────────────────────
function EnterPasscodeForm({ session, onConfirm, onBack }) {
  const [yourName, setYourName] = useState('');
  const [passcode, setPasscode] = useState('');
  const [err, setErr]           = useState('');
  const [loading, setLoading]   = useState(false);

  const submit = async () => {
    if (!yourName.trim() || !passcode.trim()) return setErr('All fields are required.');
    setLoading(true);
    const hash = await hashPasscode(passcode);
    if (hash !== session.passcodeHash) {
      setLoading(false);
      return setErr('Incorrect passcode.');
    }
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

// ── Main ──────────────────────────────────────────────────────
export default function CodeCollab() {
  const navigate = useNavigate();

  // view: 'lobby' | 'create' | 'passcode' | 'session'
  const [view, setView]               = useState('lobby');
  const [sessions, setSessions]       = useState([]);
  const [selectedSession, setSelected] = useState(null);
  const [user, setUser]               = useState(null);
  const [users, setUsers]             = useState([]);
  const [segments, setSegments]       = useState([]);
  const [activeId, setActiveId]       = useState(null);
  const [showNewForm, setShowNewForm] = useState(false);

  const camera = useCamera();

  // Y.js refs
  const lobbyDocRef      = useRef(null);
  const lobbyProviderRef = useRef(null);
  const sessionDocRef    = useRef(null);
  const sessionProvRef   = useRef(null);
  const ySegmentsRef     = useRef(null);
  const createdSessionId = useRef(null);

  const goBack = useCallback(() => {
    navigate('/', { state: { scrollTo: 'projects' } });
  }, [navigate]);

  // ── Connect to lobby on mount ──────────────────────────────
  // Awareness is used (not Y.Map) — it's a lightweight real-time broadcast
  // protocol that propagates immediately without full CRDT sync overhead.
  useEffect(() => {
    const doc      = new Y.Doc();
    const provider = new WebrtcProvider(LOBBY_ROOM, doc, {
      signaling: SIGNALING,
      filterBcConns: false, // allow BroadcastChannel sync across same-browser tabs
    });

    lobbyDocRef.current      = doc;
    lobbyProviderRef.current = provider;

    const syncSessions = () => {
      const list = [];
      provider.awareness.getStates().forEach((state) => {
        if (state?.type === 'session') {
          list.push({ id: state.sessionId, ...state });
        }
      });
      setSessions(list.sort((a, b) => b.createdAt - a.createdAt));
    };

    provider.awareness.on('change', syncSessions);
    syncSessions();

    return () => {
      provider.destroy();
      doc.destroy();
    };
  }, []);

  // ── Cleanup session provider on unmount ────────────────────
  useEffect(() => {
    return () => {
      sessionProvRef.current?.destroy();
      sessionDocRef.current?.destroy();
    };
  }, []);

  // ── Enter a Y.js session room ──────────────────────────────
  const enterSession = useCallback((sessionId, me) => {
    const doc      = new Y.Doc();
    const provider = new WebrtcProvider(`codecollab-${sessionId}`, doc, { signaling: SIGNALING });
    const ySegs    = doc.getMap('segments');

    sessionDocRef.current = doc;
    sessionProvRef.current = provider;
    ySegmentsRef.current  = ySegs;

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

    setUser(me);
    setView('session');
  }, []);

  // ── Create new session ─────────────────────────────────────
  const handleCreate = useCallback(({ displayName, yourName, passcodeHash }) => {
    const sessionId = uid();
    const id        = uid();
    const color     = colorFromId(id);
    const me        = { id, name: yourName, color };

    // Advertise via awareness — visible to all lobby peers instantly
    lobbyProviderRef.current?.awareness.setLocalState({
      type: 'session',
      sessionId,
      displayName,
      passcodeHash,
      creatorName: yourName,
      creatorId:   id,
      createdAt:   Date.now(),
    });
    createdSessionId.current = sessionId;
    enterSession(sessionId, me);
  }, [enterSession]);

  // ── Join existing session ──────────────────────────────────
  const handleJoin = useCallback(({ yourName }) => {
    const id    = uid();
    const color = colorFromId(id);
    enterSession(selectedSession.id, { id, name: yourName, color });
  }, [selectedSession, enterSession]);

  // ── Leave session ──────────────────────────────────────────
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
    setUser(null);
    setUsers([]);
    setSegments([]);
    setActiveId(null);
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

  const activeSegment = segments.find(s => s.id === activeId) ?? null;
  const isOwner       = activeSegment?.ownerId === user?.id;

  // ── Render ────────────────────────────────────────────────
  if (view === 'lobby') return (
    <SessionLobby
      sessions={sessions}
      onJoin={s => { setSelected(s); setView('passcode'); }}
      onCreate={() => setView('create')}
      onBack={goBack}
    />
  );

  if (view === 'create') return (
    <CreateSessionForm onConfirm={handleCreate} onBack={() => setView('lobby')} />
  );

  if (view === 'passcode') return (
    <EnterPasscodeForm session={selectedSession} onConfirm={handleJoin} onBack={() => setView('lobby')} />
  );

  // ── Session view ──────────────────────────────────────────
  return (
    <div className="cc-app">
      {/* Header */}
      <header className="cc-header">
        <div className="cc-header-left">
          <button className="cc-back-btn cc-back-btn--inline" onClick={leaveSession}>← Sessions</button>
          <span className="cc-logo">◈ CodeCollab</span>
        </div>
        <div className="cc-header-users">
          {users.map(u => <UserPill key={u.id} user={u} isYou={u.id === user.id} />)}
        </div>
        <button
          className={`cc-camera-btn${camera.on ? ' cc-camera-btn--on' : ''}`}
          onClick={camera.toggle}
          title={camera.on ? 'Turn camera off' : 'Turn camera on'}
        >
          {camera.on ? <IconCameraOff /> : <IconCamera />}
        </button>
      </header>

      {/* Tab Bar */}
      <div className="cc-tab-bar">
        {segments.map(seg => (
          <button key={seg.id}
            className={`cc-tab${activeId === seg.id ? ' cc-tab--active' : ''}`}
            style={{ '--tab-color': seg.ownerColor }}
            onClick={() => setActiveId(seg.id)}
          >
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

      {/* Editor */}
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
              </div>
            </div>
            <Editor
              key={activeId}
              height="calc(100vh - 128px)"
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

      {/* Camera preview */}
      {camera.on && <CameraPreview videoRef={camera.videoRef} userColor={user?.color} />}
    </div>
  );
}
