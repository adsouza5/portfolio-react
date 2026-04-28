import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Editor } from '@monaco-editor/react';
import * as Y from 'yjs';
import { WebrtcProvider } from 'y-webrtc';
import './CodeCollab.css';

const SIGNALING = ['wss://signaling.yjs.dev'];
const LANGUAGES  = ['javascript','typescript','python','go','rust','java','html','css','json','markdown'];
const USER_COLORS = [
  '#5b9cf6','#6bcb8b','#c084fc','#f9a96b',
  '#5dd8d8','#f87ba6','#fbbf24','#93c5fd',
  '#86efac','#d8b4fe',
];

function colorFromId(id) {
  let h = 0;
  for (let i = 0; i < id.length; i++) { h = Math.imul(31, h) + id.charCodeAt(i) | 0; }
  return USER_COLORS[Math.abs(h) % USER_COLORS.length];
}

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

// ── Join Screen ───────────────────────────────────────────────
function JoinScreen({ onJoin, onBack }) {
  const [room, setRoom] = useState('');
  const [name, setName] = useState('');

  const submit = () => {
    if (room.trim() && name.trim()) onJoin({ room: room.trim(), name: name.trim() });
  };

  return (
    <div className="cc-join-screen">
      <button className="cc-back-btn" onClick={onBack}>← Timeline</button>
      <div className="cc-join-card">
        <div className="cc-logo">◈ CodeCollab</div>
        <p className="cc-join-sub">Peer-to-peer collaborative coding — no server required</p>

        <label className="cc-join-label">Session name</label>
        <input
          className="cc-join-input"
          placeholder="Share this name with collaborators"
          value={room}
          onChange={(e) => setRoom(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && name.trim() && submit()}
        />

        <label className="cc-join-label">Your name</label>
        <input
          className="cc-join-input"
          placeholder="e.g. Adam"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
          autoFocus
        />

        <button className="cc-join-btn" onClick={submit}>
          Join Session →
        </button>

        <p className="cc-join-note">
          Peers connect directly via WebRTC. Anyone using the same session name joins the same room.
        </p>
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
        {user.name}
        {isYou && <span className="cc-user-you"> you</span>}
      </span>
    </div>
  );
}

// ── New Segment Form ──────────────────────────────────────────
function NewSegmentForm({ onConfirm, onCancel }) {
  const [name, setName]         = useState('');
  const [language, setLanguage] = useState('javascript');

  const submit = () => {
    if (name.trim()) onConfirm({ name: name.trim(), language });
  };

  return (
    <div className="cc-tab-new-form">
      <input
        className="cc-tab-new-input"
        placeholder="Segment name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') submit(); if (e.key === 'Escape') onCancel(); }}
        autoFocus
      />
      <select className="cc-tab-new-lang" value={language} onChange={(e) => setLanguage(e.target.value)}>
        {LANGUAGES.map((l) => <option key={l} value={l}>{l}</option>)}
      </select>
      <button className="cc-tab-new-confirm" onClick={submit}>Create</button>
      <button className="cc-tab-new-cancel" onClick={onCancel}>✕</button>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────
export default function CodeCollab() {
  const navigate = useNavigate();

  const [user, setUser]           = useState(null);
  const [users, setUsers]         = useState([]);
  const [segments, setSegments]   = useState([]);
  const [activeId, setActiveId]   = useState(null);
  const [showNewForm, setShowNewForm] = useState(false);

  const docRef       = useRef(null);
  const providerRef  = useRef(null);
  const ySegmentsRef = useRef(null);

  const goBack = useCallback(() => {
    navigate('/', { state: { scrollTo: 'projects' } });
  }, [navigate]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      providerRef.current?.destroy();
      docRef.current?.destroy();
    };
  }, []);

  const join = useCallback(({ room, name }) => {
    const id    = uid();
    const color = colorFromId(id);
    const me    = { id, name, color };

    const doc      = new Y.Doc();
    const provider = new WebrtcProvider(`codecollab-${room}`, doc, { signaling: SIGNALING });
    const ySegs    = doc.getMap('segments');

    docRef.current      = doc;
    providerRef.current = provider;
    ySegmentsRef.current = ySegs;

    // Broadcast own presence
    provider.awareness.setLocalState(me);

    // Sync user list from awareness
    const syncUsers = () => {
      const list = [];
      provider.awareness.getStates().forEach((s) => { if (s?.id) list.push(s); });
      setUsers(list);
    };
    provider.awareness.on('change', syncUsers);
    syncUsers();

    // Sync segments from Y.Map
    const syncSegments = () => {
      const list = [];
      ySegs.forEach((val, key) => list.push({ id: key, ...val }));
      setSegments(list);
    };
    ySegs.observe(syncSegments);
    syncSegments();

    setUser(me);
  }, []);

  const createSegment = ({ name, language }) => {
    if (!user) return;
    const id = `seg_${Date.now()}`;
    ySegmentsRef.current?.set(id, {
      name,
      language,
      ownerId:    user.id,
      ownerName:  user.name,
      ownerColor: user.color,
      content:    `// ${name}\n// ${user.name}'s workspace\n\n`,
    });
    setShowNewForm(false);
    setActiveId(id);
  };

  const deleteSegment = (segId, e) => {
    e.stopPropagation();
    const seg = ySegmentsRef.current?.get(segId);
    if (!seg || seg.ownerId !== user?.id) return;
    ySegmentsRef.current.delete(segId);
    if (activeId === segId) {
      const rest = segments.filter((s) => s.id !== segId);
      setActiveId(rest.length > 0 ? rest[0].id : null);
    }
  };

  const handleEditorChange = (content) => {
    if (!activeSegment || activeSegment.ownerId !== user?.id) return;
    const current = ySegmentsRef.current?.get(activeId);
    if (!current) return;
    ySegmentsRef.current.set(activeId, { ...current, content });
  };

  const activeSegment = segments.find((s) => s.id === activeId) ?? null;
  const isOwner       = activeSegment?.ownerId === user?.id;

  if (!user) return <JoinScreen onJoin={join} onBack={goBack} />;

  return (
    <div className="cc-app">
      {/* ── Header ──────────────────────────────────────── */}
      <header className="cc-header">
        <div className="cc-header-left">
          <button className="cc-back-btn cc-back-btn--inline" onClick={goBack}>
            ← Timeline
          </button>
          <span className="cc-logo">◈ CodeCollab</span>
        </div>
        <div className="cc-header-users">
          {users.map((u) => (
            <UserPill key={u.id} user={u} isYou={u.id === user.id} />
          ))}
        </div>
      </header>

      {/* ── Tab Bar ─────────────────────────────────────── */}
      <div className="cc-tab-bar">
        {segments.map((seg) => (
          <button
            key={seg.id}
            className={`cc-tab${activeId === seg.id ? ' cc-tab--active' : ''}`}
            style={{ '--tab-color': seg.ownerColor }}
            onClick={() => setActiveId(seg.id)}
          >
            <span className="cc-tab-dot" style={{ background: seg.ownerColor }} />
            <span className="cc-tab-name">{seg.name}</span>
            {seg.ownerId === user.id && (
              <span className="cc-tab-close" onClick={(e) => deleteSegment(seg.id, e)}>×</span>
            )}
          </button>
        ))}

        {showNewForm ? (
          <NewSegmentForm onConfirm={createSegment} onCancel={() => setShowNewForm(false)} />
        ) : (
          <button className="cc-tab-add" onClick={() => setShowNewForm(true)}>
            + New Segment
          </button>
        )}
      </div>

      {/* ── Editor ──────────────────────────────────────── */}
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
                automaticLayout:      true,
                readOnly:             !isOwner,
                fontSize:             14,
                lineHeight:           22,
                fontFamily:           "'JetBrains Mono', 'Fira Code', 'SF Mono', monospace",
                minimap:              { enabled: false },
                scrollBeyondLastLine: false,
                renderLineHighlight:  isOwner ? 'line' : 'none',
                cursorStyle:          isOwner ? 'line' : 'underline',
                padding:              { top: 20, bottom: 20 },
                lineNumbers:          'on',
                glyphMargin:          false,
                folding:              true,
                bracketPairColorization: { enabled: true },
                smoothScrolling:      true,
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
    </div>
  );
}
