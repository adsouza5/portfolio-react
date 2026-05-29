import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { markAsInternal } from '../../analytics';
import './AnalyticsDashboard.css';

const SESSION_KEY = 'an_auth';
const CORRECT     = btoa('IdahoFalls@never012');

const GA_PROPERTY = 'G-4D30QRHEXB';
const GA_BASE     = 'https://analytics.google.com/analytics/web/#/p';

// Known property numeric ID is resolved via the GA4 UI URL — links below
// use the stream-agnostic report URLs (work once GA4 has data)
const GA_LINKS = [
  {
    icon: '📊',
    title: 'Realtime Overview',
    sub: 'Who is on the site right now',
    href: `https://analytics.google.com/analytics/web/#/realtime/overview`,
  },
  {
    icon: '📈',
    title: 'Audience & Sessions',
    sub: 'Sessions, users, bounce rate',
    href: `https://analytics.google.com/analytics/web/`,
  },
  {
    icon: '📄',
    title: 'Pages & Screens',
    sub: 'Which pages get the most views',
    href: `https://analytics.google.com/analytics/web/`,
  },
  {
    icon: '🎯',
    title: 'Events',
    sub: 'Project clicks, voice usage, searches',
    href: `https://analytics.google.com/analytics/web/`,
  },
  {
    icon: '🌍',
    title: 'Geography',
    sub: 'Where visitors are coming from',
    href: `https://analytics.google.com/analytics/web/`,
  },
  {
    icon: '📱',
    title: 'Tech & Devices',
    sub: 'Browser, OS, screen size',
    href: `https://analytics.google.com/analytics/web/`,
  },
];

const TRACKED_EVENTS = [
  { key: 'project_click',       label: 'Project Card Clicks' },
  { key: 'showcase_view',       label: 'Showcase Views' },
  { key: 'beyond_code_open',    label: 'Beyond the Code Opens' },
  { key: 'voice_used',          label: 'Voice Recognitions' },
  { key: 'currency_converted',  label: 'Currency Conversions' },
  { key: 'lens_search',         label: 'Lens Searches' },
  { key: 'lens_index',          label: 'Lens Indexes' },
  { key: 'prism_request',       label: 'Prism API Requests' },
  { key: 'sentinel_predict',    label: 'Sentinel Predictions' },
];

function useGitHub() {
  const [data, setData] = useState(null);
  const [repos, setRepos] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const headers = { Accept: 'application/vnd.github.v3+json' };
    Promise.all([
      fetch('https://api.github.com/users/adsouza5', { headers }).then(r => r.json()),
      fetch('https://api.github.com/users/adsouza5/repos?sort=updated&per_page=20', { headers }).then(r => r.json()),
    ]).then(([user, repoList]) => {
      setData(user);
      setRepos(Array.isArray(repoList) ? repoList.filter(r => !r.private) : []);
    }).finally(() => setLoading(false));
  }, []);

  return { data, repos, loading };
}

// ── Gate ────────────────────────────────────────────────────────
function Gate({ onAuth }) {
  const [pw, setPw] = useState('');
  const [error, setError] = useState('');

  const submit = (e) => {
    e.preventDefault();
    if (btoa(pw) === CORRECT) {
      sessionStorage.setItem(SESSION_KEY, '1');
      markAsInternal();
      onAuth();
    } else {
      setError('Incorrect passcode.');
      setPw('');
    }
  };

  return (
    <div className="an-root">
      <div className="an-gate">
        <div className="an-gate-box">
          <div className="an-gate-title">Analytics</div>
          <div className="an-gate-sub">Private — enter passcode to continue</div>
          <form onSubmit={submit} style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 12 }}>
            <input
              className="an-gate-input"
              type="password"
              placeholder="Passcode"
              value={pw}
              onChange={e => { setPw(e.target.value); setError(''); }}
              autoFocus
            />
            {error && <div className="an-gate-error">{error}</div>}
            <button className="an-gate-btn" type="submit">Enter</button>
          </form>
        </div>
      </div>
    </div>
  );
}

// ── Dashboard ────────────────────────────────────────────────────
function Dashboard() {
  const navigate = useNavigate();
  const { data: gh, repos, loading } = useGitHub();

  const totalStars  = repos.reduce((s, r) => s + r.stargazers_count, 0);
  const totalForks  = repos.reduce((s, r) => s + r.forks_count, 0);
  const portfolioRepos = repos.filter(r =>
    ['prism-api','lens-api','sentinel-ml-pipeline','codecollab','portfolio-react','currency-convert-chatbot'].includes(r.name)
  );

  return (
    <div className="an-root">
      <nav className="an-nav">
        <button className="an-back" onClick={() => navigate('/', { state: { scrollTo: 'projects' } })}>
          ← Timeline
        </button>
        <span className="an-nav-title">Analytics</span>
        <span className="an-nav-badge">Private · {GA_PROPERTY}</span>
      </nav>

      <div className="an-body">

        {/* ── GitHub Profile ── */}
        <div className="an-section-title">GitHub Profile</div>
        {loading ? (
          <div className="an-loading">Fetching GitHub data…</div>
        ) : (
          <div className="an-grid">
            <div className="an-stat">
              <div className="an-stat-label">Followers</div>
              <div className="an-stat-value">{gh?.followers ?? '—'}</div>
              <div className="an-stat-sub">Public profile</div>
            </div>
            <div className="an-stat">
              <div className="an-stat-label">Public Repos</div>
              <div className="an-stat-value">{gh?.public_repos ?? '—'}</div>
              <div className="an-stat-sub">All repos</div>
            </div>
            <div className="an-stat">
              <div className="an-stat-label">Total Stars</div>
              <div className="an-stat-value">{totalStars}</div>
              <div className="an-stat-sub">Across all repos</div>
            </div>
            <div className="an-stat">
              <div className="an-stat-label">Total Forks</div>
              <div className="an-stat-value">{totalForks}</div>
              <div className="an-stat-sub">Across all repos</div>
            </div>
          </div>
        )}

        {/* ── Per-repo breakdown ── */}
        <div className="an-section-title">Project Repos</div>
        {loading ? (
          <div className="an-loading">Loading repos…</div>
        ) : (
          <table className="an-repo-table">
            <thead>
              <tr>
                <th>Repo</th>
                <th>Language</th>
                <th>Stars</th>
                <th>Forks</th>
                <th>Updated</th>
              </tr>
            </thead>
            <tbody>
              {portfolioRepos.map(r => (
                <tr key={r.name}>
                  <td>
                    <a
                      className="an-repo-name"
                      href={r.html_url}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {r.name}
                    </a>
                  </td>
                  <td>
                    {r.language
                      ? <span className="an-repo-lang">{r.language}</span>
                      : <span style={{ color: '#334155' }}>—</span>
                    }
                  </td>
                  <td className="an-mono">{r.stargazers_count}</td>
                  <td className="an-mono">{r.forks_count}</td>
                  <td style={{ color: '#475569', fontSize: 12 }}>
                    {new Date(r.updated_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {/* ── GA4 Reports ── */}
        <div className="an-section-title">Google Analytics 4 Reports</div>
        <p style={{ fontSize: 13, color: '#475569', margin: '0 0 16px' }}>
          Live traffic data lives in GA4. All links below open your dashboard (must be signed into <span className="an-mono">adamdsouza0078@gmail.com</span>).
        </p>
        <div className="an-ga-grid">
          {GA_LINKS.map(link => (
            <a key={link.title} className="an-ga-card" href={link.href} target="_blank" rel="noopener noreferrer">
              <span className="an-ga-icon">{link.icon}</span>
              <div>
                <div className="an-ga-card-title">{link.title}</div>
                <div className="an-ga-card-sub">{link.sub}</div>
              </div>
            </a>
          ))}
        </div>

        {/* ── Tracked Events ── */}
        <div className="an-section-title">Custom Events Being Tracked</div>
        <p style={{ fontSize: 13, color: '#475569', margin: '0 0 16px' }}>
          These events fire automatically as visitors interact with the portfolio. View them under Events in GA4.
        </p>
        <div className="an-grid">
          {TRACKED_EVENTS.map(ev => (
            <div className="an-stat" key={ev.key}>
              <div className="an-stat-label">{ev.label}</div>
              <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12, color: '#475569', marginTop: 4 }}>
                {ev.key}
              </div>
            </div>
          ))}
        </div>

        {/* ── Portfolio Sections ── */}
        <div className="an-section-title">Portfolio Sections Tracked</div>
        <div className="an-grid">
          {[
            { label: 'Homepage',            sub: 'page_view · /' },
            { label: 'Prism Showcase',      sub: 'page_view · /projects/prism' },
            { label: 'Lens Showcase',       sub: 'page_view · /projects/lens' },
            { label: 'Sentinel Showcase',   sub: 'page_view · /projects/sentinel' },
            { label: 'CodeCollab Showcase', sub: 'page_view · /projects/codecollab' },
            { label: 'Currency Showcase',   sub: 'page_view · /projects/currency' },
            { label: 'Beyond the Code',     sub: 'beyond_code_open event' },
          ].map(item => (
            <div className="an-stat" key={item.label}>
              <div className="an-stat-label">{item.label}</div>
              <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: '#334155', marginTop: 4 }}>
                {item.sub}
              </div>
            </div>
          ))}
        </div>

      </div>
    </div>
  );
}

// ── Root ─────────────────────────────────────────────────────────
export default function AnalyticsDashboard() {
  const [authed, setAuthed] = useState(() => {
    const already = sessionStorage.getItem(SESSION_KEY) === '1';
    if (already) markAsInternal();
    return already;
  });
  if (!authed) return <Gate onAuth={() => setAuthed(true)} />;
  return <Dashboard />;
}
