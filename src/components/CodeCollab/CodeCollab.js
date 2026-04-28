import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Editor } from '@monaco-editor/react';
import io from 'socket.io-client';
import './CodeCollab.css';

const SOCKET_URL   = 'http://localhost:5000';
const MANAGER_URL  = 'http://localhost:5001';
const LANGUAGES = [
  'javascript', 'typescript', 'python', 'go', 'rust',
  'java', 'html', 'css', 'json', 'markdown',
];

// ── Join Screen ───────────────────────────────────────────────
function JoinScreen({ onJoin, onBack, starting, error }) {
  const [name, setName] = useState('');

  const submit = () => {
    if (name.trim() && !starting) onJoin(name.trim());
  };

  return (
    <div className="cc-join-screen">
      <button className="cc-back-btn" onClick={onBack}>← Timeline</button>
      <div className="cc-join-card">
        <div className="cc-logo">◈ CodeCollab</div>
        <p className="cc-join-sub">Segment-based collaborative coding</p>
        <input
          className="cc-join-input"
          placeholder="Your name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
          disabled={starting}
          autoFocus
        />
        <button className="cc-join-btn" onClick={submit} disabled={starting}>
          {starting ? 'Starting server…' : 'Join Session →'}
        </button>
        {error && <p className="cc-join-error">{error}</p>}
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
  const [name, setName] = useState('');
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
        onKeyDown={(e) => {
          if (e.key === 'Enter') submit();
          if (e.key === 'Escape') onCancel();
        }}
        autoFocus
      />
      <select
        className="cc-tab-new-lang"
        value={language}
        onChange={(e) => setLanguage(e.target.value)}
      >
        {LANGUAGES.map((l) => (
          <option key={l} value={l}>{l}</option>
        ))}
      </select>
      <button className="cc-tab-new-confirm" onClick={submit}>Create</button>
      <button className="cc-tab-new-cancel" onClick={onCancel}>✕</button>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────
export default function CodeCollab() {
  const navigate = useNavigate();
  const [user, setUser]         = useState(null);
  const [users, setUsers]       = useState([]);
  const [segments, setSegments] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [showNewForm, setShowNewForm] = useState(false);
  const [starting, setStarting] = useState(false);
  const [error, setError]       = useState(null);
  const socketRef = useRef(null);

  const goBack = useCallback(() => {
    navigate('/', { state: { scrollTo: 'projects' } });
  }, [navigate]);

  const join = useCallback(async (name) => {
    setError(null);
    setStarting(true);

    try {
      await fetch(`${MANAGER_URL}/start`, { method: 'POST' });
    } catch {
      // Manager unreachable — try connecting directly (server may already be up)
    }

    setStarting(false);

    const socket = io(SOCKET_URL, { timeout: 5000 });
    socketRef.current = socket;

    socket.on('connect_error', () => {
      setError('Could not reach the CodeCollab server. Run npm start in the portfolio to launch everything automatically.');
      socket.disconnect();
    });

    socket.on('joined', ({ user, users, segments }) => {
      setUser(user);
      setUsers(users);
      setSegments(segments);
      if (segments.length > 0) setActiveId(segments[0].id);
    });

    socket.on('users:update', setUsers);
    socket.on('segments:update', setSegments);
    socket.on('segment:content', ({ segmentId, content }) => {
      setSegments((prev) =>
        prev.map((s) => (s.id === segmentId ? { ...s, content } : s))
      );
    });

    socket.emit('join', { name });
  }, []);

  // Auto-focus newly created own segment
  useEffect(() => {
    if (!user) return;
    const mine = segments.find((s) => s.ownerId === user.id);
    if (mine && !activeId) setActiveId(mine.id);
  }, [segments, user, activeId]);

  // Disconnect on unmount
  useEffect(() => {
    return () => socketRef.current?.disconnect();
  }, []);

  const createSegment = ({ name, language }) => {
    socketRef.current?.emit('segment:create', { name, language });
    setShowNewForm(false);
  };

  const deleteSegment = (segmentId, e) => {
    e.stopPropagation();
    socketRef.current?.emit('segment:delete', { segmentId });
    if (activeId === segmentId) {
      const rest = segments.filter((s) => s.id !== segmentId);
      setActiveId(rest.length > 0 ? rest[0].id : null);
    }
  };

  const handleEditorChange = (content) => {
    if (!activeSegment || activeSegment.ownerId !== user?.id) return;
    socketRef.current?.emit('segment:update', { segmentId: activeId, content });
    setSegments((prev) =>
      prev.map((s) => (s.id === activeId ? { ...s, content } : s))
    );
  };

  const activeSegment = segments.find((s) => s.id === activeId) ?? null;
  const isOwner = activeSegment?.ownerId === user?.id;

  if (!user) {
    return <JoinScreen onJoin={join} onBack={goBack} starting={starting} error={error} />;
  }

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
              <span className="cc-tab-close" onClick={(e) => deleteSegment(seg.id, e)}>
                ×
              </span>
            )}
          </button>
        ))}

        {showNewForm ? (
          <NewSegmentForm
            onConfirm={createSegment}
            onCancel={() => setShowNewForm(false)}
          />
        ) : (
          <button className="cc-tab-add" onClick={() => setShowNewForm(true)}>
            + New Segment
          </button>
        )}
      </div>

      {/* ── Editor ──────────────────────────────────────── */}
      <div
        className="cc-editor-wrap"
        style={{ '--owner-color': activeSegment?.ownerColor ?? 'transparent' }}
      >
        {activeSegment ? (
          <>
            <div className="cc-editor-header">
              <span className="cc-editor-owner" style={{ color: activeSegment.ownerColor }}>
                ● {activeSegment.ownerName}
              </span>
              <span className="cc-editor-seg-name">{activeSegment.name}</span>
              <div className="cc-editor-header-right">
                <span className="cc-editor-lang">{activeSegment.language}</span>
                {!isOwner && (
                  <span className="cc-editor-readonly-badge">read-only</span>
                )}
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
                automaticLayout: true,
                readOnly: !isOwner,
                fontSize: 14,
                lineHeight: 22,
                fontFamily: "'JetBrains Mono', 'Fira Code', 'SF Mono', monospace",
                minimap: { enabled: false },
                scrollBeyondLastLine: false,
                renderLineHighlight: isOwner ? 'line' : 'none',
                cursorStyle: isOwner ? 'line' : 'underline',
                padding: { top: 20, bottom: 20 },
                lineNumbers: 'on',
                glyphMargin: false,
                folding: true,
                bracketPairColorization: { enabled: true },
                smoothScrolling: true,
              }}
            />
          </>
        ) : (
          <div className="cc-editor-empty">
            <p>No segments yet — create one to start coding.</p>
            <button
              className="cc-editor-empty-btn"
              onClick={() => setShowNewForm(true)}
            >
              + Create your first segment
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
