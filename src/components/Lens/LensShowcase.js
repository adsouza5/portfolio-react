import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import './LensShowcase.css';

const API = process.env.REACT_APP_LENS_API_URL || '';

const MODELS = [
  {
    id: 'local',
    name: 'jina-code-v2',
    detail: 'Runs in the backend container — no setup needed',
    badge: 'free',
    badgeLabel: 'Free',
    dims: 768,
  },
  {
    id: 'openai',
    name: 'text-embedding-3-small',
    detail: 'OpenAI API — best retrieval quality, requires API key',
    badge: 'api',
    badgeLabel: 'API Key',
    dims: 1536,
  },
  {
    id: 'ollama',
    name: 'nomic-embed-text',
    detail: 'Ollama running locally — fully private, no cloud',
    badge: 'local',
    badgeLabel: 'Local Only',
    dims: 768,
  },
];

const DEMO_REPOS = [
  { label: 'This portfolio', url: 'https://github.com/adsouza5/portfolio-react' },
  { label: 'ML Pipeline API', url: 'https://github.com/adsouza5/sentinel-ml-pipeline' },
];

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

function ResultCard({ result, index }) {
  return (
    <div className="lens-result-card" style={{ animationDelay: `${index * 0.05}s` }}>
      <div className="lens-result-meta">
        <span className="lens-result-filepath">{result.file_path}</span>
        {result.symbol && <span className="lens-result-symbol">{result.symbol}</span>}
        <span className="lens-result-lines">L{result.start_line}–{result.end_line}</span>
        <span className="lens-result-score">{(result.score * 100).toFixed(1)}%</span>
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

  const [query, setQuery]         = useState('');
  const [langFilter, setLangFilter] = useState('');
  const [searching, setSearching] = useState(false);
  const [results, setResults]     = useState([]);
  const [searchErr, setSearchErr] = useState('');

  const esRef = useRef(null);

  const loadCollections = useCallback(async () => {
    if (!API) return;
    try {
      const r = await fetch(`${API}/collections`);
      const d = await r.json();
      const cols = d.collections ?? [];
      setCollections(cols);
      setCollection(prev => prev || cols[0] || '');
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { loadCollections(); }, [loadCollections]);

  const lastEvent = indexEvents[indexEvents.length - 1];
  const indexDone = lastEvent?.type === 'done';
  const indexError = lastEvent?.type === 'error';

  function startIndex() {
    if (!repoUrl.trim() || indexing) return;
    setIndexing(true);
    setIndexEvents([]);
    setResults([]);

    const params = new URLSearchParams({
      repo_url: repoUrl.trim(),
      provider,
      ...(provider === 'openai' && apiKey ? { api_key: apiKey } : {}),
      ...(provider === 'ollama' ? { ollama_url: ollamaUrl } : {}),
    });

    const es = new EventSource(`${API}/index?${params}`);
    esRef.current = es;

    es.onmessage = (e) => {
      const data = JSON.parse(e.data);
      setIndexEvents(prev => [...prev, data]);
      if (data.type === 'done') {
        setCollection(data.collection);
        setIndexing(false);
        loadCollections();
        es.close();
      }
      if (data.type === 'error') {
        setIndexing(false);
        es.close();
      }
    };
    es.onerror = () => {
      setIndexEvents(prev => [...prev, { type: 'error', message: 'Connection lost' }]);
      setIndexing(false);
      es.close();
    };
  }

  // EventSource doesn't support POST — use fetch + ReadableStream for POST
  function startIndexPost() {
    if (!repoUrl.trim() || indexing) return;
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
              loadCollections();
            }
          } catch { /* malformed chunk */ }
        }
      }
    }).catch((err) => {
      setIndexEvents(prev => [...prev, { type: 'error', message: err.message }]);
    }).finally(() => setIndexing(false));
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

  return (
    <div className="lens-root">
      <div className="lens-inner">
        <button className="lens-back-btn" onClick={() => navigate('/', { state: { scrollTo: 'projects' } })}>
          ← Timeline
        </button>

        <div className="lens-eyebrow">◈ Project · 2026</div>
        <h1 className="lens-title">Lens</h1>
        <p className="lens-subtitle">
          Semantic code search — index any GitHub repository and query it in plain English.
          Powered by code embeddings and vector similarity search over Qdrant.
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
            <div className="lens-api-key-row">
              <input
                className="lens-input"
                placeholder="Ollama base URL (default: http://localhost:11434)"
                value={ollamaUrl}
                onChange={e => setOllamaUrl(e.target.value)}
              />
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
              onClick={startIndexPost}
              disabled={indexing || !repoUrl.trim()}
            >
              {indexing ? 'Indexing…' : 'Index'}
            </button>
          </div>

          <ProgressView events={indexEvents} />
        </div>

        {/* ── Previous collections ── */}
        {collections.length > 0 && (
          <div className="lens-card">
            <div className="lens-card-title">Indexed Repositories</div>
            <div className="lens-collections">
              {collections.map(c => (
                <button
                  key={c}
                  className={`lens-collection-chip${collection === c ? ' active' : ''}`}
                  onClick={() => setCollection(c)}
                >
                  {c.replace(/^lens-/, '')}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── Search ── */}
        <div className="lens-card">
          <div className="lens-card-title">Search</div>
          {!collection && !indexDone ? (
            <div style={{ fontFamily: 'Courier New, monospace', fontSize: 12, color: 'rgba(200,230,230,0.35)' }}>
              Index a repository above, or select one from Indexed Repositories to search.
            </div>
          ) : (
            <>
              <div className="lens-search-row">
                <input
                  className="lens-input"
                  placeholder="e.g. where is RSI calculated, find the auth middleware…"
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && runSearch()}
                  autoFocus
                />
                <select
                  className="lens-lang-select"
                  value={langFilter}
                  onChange={e => setLangFilter(e.target.value)}
                >
                  <option value="">All languages</option>
                  {['python','javascript','typescript','go','rust','java'].map(l => (
                    <option key={l} value={l}>{l}</option>
                  ))}
                </select>
                <button
                  className="lens-btn lens-btn-primary"
                  onClick={runSearch}
                  disabled={searching || !query.trim()}
                >
                  {searching ? 'Searching…' : 'Search'}
                </button>
              </div>

              {searchErr && <div className="lens-error-banner" style={{ marginTop: 12 }}>✕ {searchErr}</div>}

              {results.length > 0 && (
                <div className="lens-results">
                  {results.map((r, i) => <ResultCard key={i} result={r} index={i} />)}
                </div>
              )}

              {!searching && results.length === 0 && query && !searchErr && (
                <div style={{ fontFamily: 'Courier New, monospace', fontSize: 12, color: 'rgba(200,230,230,0.35)', marginTop: 20, textAlign: 'center' }}>
                  No results — try a different query or index the repository first.
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
