import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import './LensShowcase.css';

const API = process.env.REACT_APP_LENS_API_URL || '';

// Seeded LCG — deterministic node positions so the graph is stable across renders
function seeded(seed) {
  let s = seed;
  return () => { s = Math.imul(s, 1664525) + 1013904223 | 0; return (s >>> 0) / 0xffffffff; };
}
const _r = seeded(137);
const GRAPH_NODES = Array.from({ length: 55 }, () => ({ x: _r() * 100, y: _r() * 100, r: 0.35 + _r() * 0.55 }));
const GRAPH_EDGES = GRAPH_NODES.flatMap((a, i) =>
  GRAPH_NODES.slice(i + 1).flatMap((b, j) => {
    const dx = a.x - b.x, dy = a.y - b.y;
    return dx * dx + dy * dy < 280 ? [[i, i + 1 + j]] : [];
  })
);

const MODELS = [
  {
    id: 'local',
    name: 'all-MiniLM-L6-v2',
    detail: 'Runs in the backend container — no setup needed',
    badge: 'free',
    badgeLabel: 'Free',
  },
  {
    id: 'openai',
    name: 'text-embedding-3-small',
    detail: 'OpenAI API — best retrieval quality, requires API key',
    badge: 'api',
    badgeLabel: 'API Key',
  },
  {
    id: 'ollama',
    name: 'nomic-embed-text',
    detail: 'Self-hosted Ollama — requires local backend deployment',
    badge: 'local',
    badgeLabel: 'Self-hosted',
  },
];

const DEMO_REPOS = [
  { label: 'This portfolio', url: 'https://github.com/adsouza5/portfolio-react' },
  { label: 'ML Pipeline API', url: 'https://github.com/adsouza5/sentinel-ml-pipeline' },
  { label: 'Lens API', url: 'https://github.com/adsouza5/lens-api' },
];

const REPO_STORAGE_KEY = 'lens_collection_repos';

function loadRepoMap() {
  try { return JSON.parse(localStorage.getItem(REPO_STORAGE_KEY) || '{}'); }
  catch { return {}; }
}
function saveRepoMap(map) {
  try { localStorage.setItem(REPO_STORAGE_KEY, JSON.stringify(map)); } catch {}
}

function githubFileUrl(repoUrl, filePath, startLine, endLine) {
  if (!repoUrl) return null;
  const base = repoUrl.replace(/\.git$/, '').replace(/\/$/, '');
  return `${base}/blob/main/${filePath}#L${startLine}-L${endLine}`;
}

function ModelSelector({ selected, onChange }) {
  return (
    <div className="lens-model-grid">
      {MODELS.map(m => (
        <button
          key={m.id}
          className={`lens-model-option${selected === m.id ? ' selected' : ''}`}
          onClick={() => onChange(m.id)}
        >
          <div className="lens-model-name">{m.name}</div>
          <div className="lens-model-detail">{m.detail}</div>
          <span className={`lens-model-badge ${m.badge}`}>{m.badgeLabel}</span>
        </button>
      ))}
    </div>
  );
}

function ProgressView({ events }) {
  const last = events[events.length - 1];
  if (!last) return null;

  const filesTotal  = last.files_total  ?? 0;
  const filesDone   = last.files_done   ?? 0;
  const chunksTotal = last.chunks_total ?? 0;
  const chunksDone  = last.chunks_done  ?? 0;

  const pct = chunksTotal > 0
    ? Math.round((chunksDone / chunksTotal) * 100)
    : filesTotal > 0
    ? Math.round((filesDone / filesTotal) * 100)
    : 0;

  if (last.type === 'done') {
    return (
      <div className="lens-done-banner">
        ✓ Indexed {last.chunks} chunks from {last.files} files · {last.provider}
      </div>
    );
  }

  if (last.type === 'error') {
    return <div className="lens-error-banner">✕ {last.message}</div>;
  }

  return (
    <div className="lens-progress-wrap">
      <div className="lens-progress-msg">
        <div className="lens-spinner" />
        {last.message}
      </div>
      {pct > 0 && (
        <>
          <div className="lens-progress-bar-track">
            <div className="lens-progress-bar-fill" style={{ width: `${pct}%` }} />
          </div>
          <div className="lens-progress-stats">
            {filesTotal > 0 && <span>{filesDone}/{filesTotal} files</span>}
            {chunksTotal > 0 && <span>{chunksDone}/{chunksTotal} chunks</span>}
            <span>{pct}%</span>
          </div>
        </>
      )}
    </div>
  );
}

const LANGUAGES = ['python','javascript','typescript','go','rust','java'];

function LangSelect({ value, onChange }) {
  const [open, setOpen] = useState(false);
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0, width: 0 });
  const btnRef = useRef(null);
  const wrapRef = useRef(null);

  useEffect(() => {
    const handler = e => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const MENU_HEIGHT = (LANGUAGES.length + 1) * 38;

  function toggle() {
    if (!open && btnRef.current) {
      const r = btnRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - r.bottom;
      const top = spaceBelow >= MENU_HEIGHT + 8
        ? r.bottom + 5
        : r.top - MENU_HEIGHT - 5;
      setMenuPos({ top, left: r.left, width: r.width });
    }
    setOpen(o => !o);
  }

  const label = value || 'All languages';

  return (
    <div className="lens-lang-wrap" ref={wrapRef}>
      <button
        ref={btnRef}
        className={`lens-lang-btn${open ? ' open' : ''}`}
        onClick={toggle}
        type="button"
      >
        <span>{label}</span>
        <span className="lens-lang-chevron">{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div
          className="lens-lang-menu"
          style={{ position: 'fixed', top: menuPos.top, left: menuPos.left, minWidth: menuPos.width }}
        >
          <button
            className={`lens-lang-item${!value ? ' active' : ''}`}
            onClick={() => { onChange(''); setOpen(false); }}
          >All languages</button>
          {LANGUAGES.map(l => (
            <button
              key={l}
              className={`lens-lang-item${value === l ? ' active' : ''}`}
              onClick={() => { onChange(l); setOpen(false); }}
            >{l}</button>
          ))}
        </div>
      )}
    </div>
  );
}

function CopyButton({ text }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };
  return (
    <button className="lens-copy-btn" onClick={copy} title="Copy code">
      {copied ? '✓' : '⎘'}
    </button>
  );
}

function ResultModal({ result, repoUrl, onClose }) {
  const ghUrl = githubFileUrl(repoUrl, result.file_path, result.start_line, result.end_line);

  useEffect(() => {
    const onKey = e => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="lens-modal-backdrop" onClick={onClose}>
      <div className="lens-modal" onClick={e => e.stopPropagation()}>
        <div className="lens-modal-header">
          <div className="lens-modal-meta">
            {ghUrl ? (
              <a className="lens-result-filepath" href={ghUrl} target="_blank" rel="noopener noreferrer">
                {result.file_path}
              </a>
            ) : (
              <span className="lens-result-filepath">{result.file_path}</span>
            )}
            {result.symbol && <span className="lens-result-symbol">{result.symbol}</span>}
            <span className="lens-result-lines">L{result.start_line}–{result.end_line}</span>
            <span className="lens-result-score">{(result.score * 100).toFixed(1)}%</span>
          </div>
          <div className="lens-modal-actions">
            <CopyButton text={result.content} />
            <button className="lens-modal-close" onClick={onClose} title="Close">✕</button>
          </div>
        </div>
        <pre className="lens-modal-code">{result.content}</pre>
      </div>
    </div>
  );
}

function ResultCard({ result, index, repoUrl, onExpand }) {
  const ghUrl = githubFileUrl(repoUrl, result.file_path, result.start_line, result.end_line);
  return (
    <div className="lens-result-card" style={{ animationDelay: `${index * 0.05}s` }}>
      <div className="lens-result-meta">
        {ghUrl ? (
          <a className="lens-result-filepath" href={ghUrl} target="_blank" rel="noopener noreferrer">
            {result.file_path}
          </a>
        ) : (
          <span className="lens-result-filepath">{result.file_path}</span>
        )}
        {result.symbol && <span className="lens-result-symbol">{result.symbol}</span>}
        <span className="lens-result-lines">L{result.start_line}–{result.end_line}</span>
        <span className="lens-result-score">{(result.score * 100).toFixed(1)}%</span>
        <CopyButton text={result.content} />
        <button className="lens-expand-btn" onClick={() => onExpand(result)} title="Expand">⤢</button>
      </div>
      <pre className="lens-result-code">{result.content}</pre>
    </div>
  );
}

export default function LensShowcase() {
  const navigate = useNavigate();

  const [provider, setProvider]       = useState('local');
  const [apiKey, setApiKey]           = useState('');
  const [ollamaUrl, setOllamaUrl]     = useState('http://localhost:11434');
  const [repoUrl, setRepoUrl]         = useState('');
  const [indexEvents, setIndexEvents] = useState([]);
  const [indexing, setIndexing]       = useState(false);
  const [collection, setCollection]   = useState('');
  const [collections, setCollections] = useState([]);
  const [repoMap, setRepoMap]         = useState(loadRepoMap);

  const [query, setQuery]           = useState('');
  const [langFilter, setLangFilter] = useState('');
  const [searching, setSearching]   = useState(false);
  const [results, setResults]       = useState([]);
  const [searchErr, setSearchErr]   = useState('');
  const [expanded, setExpanded]     = useState(null);
  const [placeholder, setPlaceholder] = useState('');

  const PLACEHOLDERS = [
    'where is authentication handled…',
    'find the database connection logic…',
    'how is rate limiting implemented…',
    'where are API routes defined…',
    'find error handling middleware…',
    'where is caching configured…',
  ];
  const placeholderRef = useRef(0);
  useEffect(() => {
    let charIdx = 0;
    let phIdx = 0;
    let erasing = false;
    let timer;
    function tick() {
      const target = PLACEHOLDERS[phIdx];
      if (!erasing) {
        charIdx++;
        setPlaceholder(target.slice(0, charIdx));
        if (charIdx === target.length) { erasing = true; timer = setTimeout(tick, 1800); return; }
      } else {
        charIdx--;
        setPlaceholder(target.slice(0, charIdx));
        if (charIdx === 0) { erasing = false; phIdx = (phIdx + 1) % PLACEHOLDERS.length; timer = setTimeout(tick, 300); return; }
      }
      timer = setTimeout(tick, erasing ? 28 : 52);
    }
    timer = setTimeout(tick, 1000);
    return () => clearTimeout(timer);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const loadCollections = useCallback(async () => {
    if (!API) return;
    try {
      const r = await fetch(`${API}/collections`);
      const d = await r.json();
      const cols = d.collections ?? [];
      setCollections(cols);
      setCollection(prev => prev || cols[0] || '');
    } catch { }
  }, []);

  useEffect(() => { loadCollections(); }, [loadCollections]);

  const lastEvent = indexEvents[indexEvents.length - 1];
  const indexDone = lastEvent?.type === 'done';

  function startIndexPost(forceReindex = false) {
    if (!repoUrl.trim() || indexing) return;
    if (!API) {
      setIndexEvents([{ type: 'error', message: 'Lens API URL is not configured.' }]);
      return;
    }
    setIndexing(true);
    setIndexEvents([]);
    setResults([]);

    const body = {
      repo_url: repoUrl.trim(),
      provider,
      ...(provider === 'openai' && apiKey ? { api_key: apiKey } : {}),
      ...(provider === 'ollama' ? { ollama_url: ollamaUrl } : {}),
    };

    fetch(`${API}/index`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }).then(async (resp) => {
      if (!resp.ok) {
        const text = await resp.text();
        setIndexEvents([{ type: 'error', message: `Server error ${resp.status}: ${text.slice(0, 200)}` }]);
        return;
      }
      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buf = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split('\n');
        buf = lines.pop() ?? '';
        for (const line of lines) {
          if (!line.startsWith('data:')) continue;
          try {
            const data = JSON.parse(line.slice(5).trim());
            setIndexEvents(prev => [...prev, data]);
            if (data.type === 'done') {
              setCollection(data.collection);
              const updated = { ...loadRepoMap(), [data.collection]: repoUrl.trim() };
              saveRepoMap(updated);
              setRepoMap(updated);
              loadCollections();
            }
          } catch { }
        }
      }
    }).catch((err) => {
      setIndexEvents(prev => [...prev, { type: 'error', message: err.message }]);
    }).finally(() => setIndexing(false));
  }

  async function deleteCollection(name) {
    try {
      await fetch(`${API}/collections/${name}`, { method: 'DELETE' });
      const updated = { ...repoMap };
      delete updated[name];
      saveRepoMap(updated);
      setRepoMap(updated);
      setCollection('');
      setResults([]);
      loadCollections();
    } catch { }
  }

  async function runSearch() {
    if (!query.trim() || !collection) return;
    setSearching(true);
    setSearchErr('');
    setResults([]);

    try {
      const r = await fetch(`${API}/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: query.trim(),
          collection,
          provider,
          ...(provider === 'openai' && apiKey ? { api_key: apiKey } : {}),
          ...(provider === 'ollama' ? { ollama_url: ollamaUrl } : {}),
          top_k: 8,
          ...(langFilter ? { language: langFilter } : {}),
        }),
      });
      const d = await r.json();
      if (!r.ok) { setSearchErr(d.detail ?? 'Search failed'); return; }
      setResults(d.results ?? []);
    } catch (e) {
      setSearchErr(e.message);
    } finally {
      setSearching(false);
    }
  }

  const activeRepoUrl = repoMap[collection] || '';

  return (
    <div className="lens-root">
      {expanded && (
        <ResultModal result={expanded} repoUrl={activeRepoUrl} onClose={() => setExpanded(null)} />
      )}
      {/* Embedding-space graph — scattered nodes + similarity edges, unique to Lens */}
      <svg className="lens-graph-bg" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
        <g opacity="0.55">
          {GRAPH_EDGES.map(([a, b], i) => (
            <line
              key={i}
              x1={GRAPH_NODES[a].x} y1={GRAPH_NODES[a].y}
              x2={GRAPH_NODES[b].x} y2={GRAPH_NODES[b].y}
              stroke="rgba(23,126,137,0.18)" strokeWidth="0.18"
            />
          ))}
          {GRAPH_NODES.map((n, i) => (
            <circle key={i} cx={n.x} cy={n.y} r={n.r} fill="rgba(23,126,137,0.45)" />
          ))}
        </g>
      </svg>

      <button
        className="lens-back-btn"
        onClick={() => navigate('/', { state: { scrollTo: 'projects' } })}
        onMouseEnter={e => { e.currentTarget.style.color='#E8E8E8'; e.currentTarget.style.borderColor='#177E89'; e.currentTarget.style.boxShadow='0 0 20px rgba(23,126,137,0.35)'; }}
        onMouseLeave={e => { e.currentTarget.style.color=''; e.currentTarget.style.borderColor=''; e.currentTarget.style.boxShadow=''; }}
      >
        ← Timeline
      </button>

      <div className="lens-inner">
        <h1 className="lens-title">Lens</h1>
        <p className="lens-subtitle">
          Semantic code search — index any GitHub repository and query it in plain English.
          Powered by code-aware embeddings and vector similarity search over Qdrant.
        </p>

        {/* ── Model ── */}
        <div className="lens-card">
          <div className="lens-card-title">Embedding Model</div>
          <ModelSelector selected={provider} onChange={setProvider} />

          {provider === 'openai' && (
            <div className="lens-api-key-row">
              <input
                className="lens-input"
                type="password"
                placeholder="sk-…  OpenAI API key"
                value={apiKey}
                onChange={e => setApiKey(e.target.value)}
              />
            </div>
          )}
          {provider === 'ollama' && (
            <div className="lens-info-banner" style={{ marginTop: 14 }}>
              ⚠ Ollama connects from the backend container, not your browser.
              It only works when running the backend locally alongside Ollama.
              For this hosted demo, use <strong>jina-code-v2</strong> or <strong>OpenAI</strong>.
            </div>
          )}
        </div>

        {/* ── Index ── */}
        <div className="lens-card">
          <div className="lens-card-title">Index a Repository</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
            {DEMO_REPOS.map(d => (
              <button
                key={d.url}
                className={`lens-collection-chip${repoUrl === d.url ? ' active' : ''}`}
                onClick={() => setRepoUrl(d.url)}
              >
                {d.label}
              </button>
            ))}
          </div>
          <div className="lens-repo-row">
            <input
              className="lens-input"
              placeholder="https://github.com/owner/repo"
              value={repoUrl}
              onChange={e => setRepoUrl(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && startIndexPost()}
            />
            <button
              className="lens-btn lens-btn-primary"
              onClick={() => startIndexPost()}
              disabled={indexing || !repoUrl.trim()}
            >
              {indexing ? 'Indexing…' : 'Index'}
            </button>
          </div>

          <ProgressView events={indexEvents} />
        </div>

        {/* ── Indexed repos ── */}
        {collections.length > 0 && (
          <div className="lens-card">
            <div className="lens-card-title">Indexed Repositories</div>
            <div className="lens-collections">
              {collections.map(c => (
                <div key={c} className={`lens-chip-row${collection === c ? ' active' : ''}`}>
                  <button
                    className={`lens-collection-chip${collection === c ? ' active' : ''}`}
                    onClick={() => { setCollection(c); setResults([]); }}
                  >
                    {repoMap[c]
                      ? repoMap[c].replace('https://github.com/', '')
                      : c.replace(/^lens-/, '')}
                  </button>
                  <button
                    className="lens-delete-btn"
                    title="Delete collection"
                    onClick={() => deleteCollection(c)}
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Search ── */}
        <div className="lens-card lens-card-search">
          <div className="lens-card-title">
            Search
            {collection && (
              <span className="lens-card-context">
                {repoMap[collection]
                  ? repoMap[collection].replace('https://github.com/', '')
                  : collection.replace(/^lens-/, '')}
              </span>
            )}
          </div>
          {!collection && !indexDone ? (
            <div className="lens-muted">
              Index a repository above, or select one from Indexed Repositories to search.
            </div>
          ) : (
            <>
              <div className="lens-search-row">
                <input
                  className="lens-input"
                  placeholder={query ? '' : placeholder || 'search the codebase…'}
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && runSearch()}
                  autoFocus
                />
                <LangSelect value={langFilter} onChange={setLangFilter} />
                <button
                  className="lens-btn lens-btn-primary"
                  onClick={runSearch}
                  disabled={searching || !query.trim()}
                >
                  {searching ? 'Searching…' : 'Search'}
                </button>
              </div>

              {searchErr && (
                <div className="lens-error-banner" style={{ marginTop: 12 }}>✕ {searchErr}</div>
              )}

              {results.length > 0 && (
                <div className="lens-results">
                  <div className="lens-results-header">
                    {results.length} results · {activeRepoUrl ? (
                      <a href={activeRepoUrl} target="_blank" rel="noopener noreferrer" className="lens-repo-link">
                        {activeRepoUrl.replace('https://github.com/', '')}
                      </a>
                    ) : collection.replace(/^lens-/, '')}
                  </div>
                  {results.map((r, i) => (
                    <ResultCard key={i} result={r} index={i} repoUrl={activeRepoUrl} onExpand={setExpanded} />
                  ))}
                </div>
              )}

              {!searching && results.length === 0 && query && !searchErr && (
                <div className="lens-muted" style={{ marginTop: 20, textAlign: 'center' }}>
                  No results — try rephrasing the query or index the repository first.
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
