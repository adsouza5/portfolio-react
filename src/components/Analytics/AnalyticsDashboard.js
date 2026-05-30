import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { markAsInternal } from '../../analytics';
import './AnalyticsDashboard.css';

const SESSION_KEY = 'an_auth';
const CORRECT     = btoa('IdahoFalls@never012');

const GA_LINKS = [
  { icon: '⚡', title: 'Realtime',        sub: 'Live visitors right now',        href: 'https://analytics.google.com/analytics/web/#/realtime/overview' },
  { icon: '📈', title: 'Acquisition',     sub: 'Where traffic comes from',       href: 'https://analytics.google.com/analytics/web/' },
  { icon: '📄', title: 'Pages & Screens', sub: 'Most visited pages',             href: 'https://analytics.google.com/analytics/web/' },
  { icon: '🎯', title: 'Events',          sub: 'Project clicks, voice, search',  href: 'https://analytics.google.com/analytics/web/' },
  { icon: '🌍', title: 'Geography',       sub: 'Visitor locations',              href: 'https://analytics.google.com/analytics/web/' },
  { icon: '📱', title: 'Tech & Devices',  sub: 'Browser, OS, screen size',       href: 'https://analytics.google.com/analytics/web/' },
];

const PORTFOLIO_REPOS = [
  'prism-api', 'lens-api', 'sentinel-ml-pipeline',
  'codecollab', 'portfolio-react', 'currency-convert-chatbot',
];

// ── Hooks ─────────────────────────────────────────────────────────
function useIpInfo() {
  const [info, setInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    fetch('https://ipapi.co/json/')
      .then(r => r.json())
      .then(d => setInfo(d))
      .catch(() => setInfo(null))
      .finally(() => setLoading(false));
  }, []);
  return { info, loading };
}

function useBrowserInfo() {
  const ua = navigator.userAgent;
  const getBrowser = () => {
    if (/Edg\//.test(ua))     return 'Microsoft Edge';
    if (/Chrome\//.test(ua))  return 'Chrome';
    if (/Firefox\//.test(ua)) return 'Firefox';
    if (/Safari\//.test(ua))  return 'Safari';
    return 'Unknown';
  };
  const getOS = () => {
    if (/Windows NT 10/.test(ua)) return 'Windows 11 / 10';
    if (/Windows/.test(ua))       return 'Windows';
    if (/Mac OS X/.test(ua))      return 'macOS';
    if (/iPhone|iPad/.test(ua))   return 'iOS';
    if (/Android/.test(ua))       return 'Android';
    if (/Linux/.test(ua))         return 'Linux';
    return 'Unknown';
  };
  return {
    browser:    getBrowser(),
    os:         getOS(),
    language:   navigator.language,
    screen:     `${window.screen.width} × ${window.screen.height}`,
    viewport:   `${window.innerWidth} × ${window.innerHeight}`,
    dpr:        window.devicePixelRatio,
    cookieOn:   navigator.cookieEnabled ? 'Yes' : 'No',
    platform:   navigator.platform,
  };
}

function useGitHub() {
  const [profile, setProfile]   = useState(null);
  const [repos,   setRepos]     = useState([]);
  const [loading, setLoading]   = useState(true);
  useEffect(() => {
    const h = { Accept: 'application/vnd.github.v3+json' };
    Promise.all([
      fetch('https://api.github.com/users/adsouza5',                              { headers: h }).then(r => r.json()),
      fetch('https://api.github.com/users/adsouza5/repos?per_page=50',            { headers: h }).then(r => r.json()),
    ]).then(([user, all]) => {
      setProfile(user);
      const filtered = (Array.isArray(all) ? all : [])
        .filter(r => PORTFOLIO_REPOS.includes(r.name))
        .sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));
      setRepos(filtered);
    }).finally(() => setLoading(false));
  }, []);
  const totalStars = repos.reduce((s, r) => s + r.stargazers_count, 0);
  const totalForks = repos.reduce((s, r) => s + r.forks_count,      0);
  return { profile, repos, totalStars, totalForks, loading };
}

// ── Gate ──────────────────────────────────────────────────────────
function Gate({ onAuth }) {
  const [pw,    setPw]    = useState('');
  const [error, setError] = useState('');

  const submit = e => {
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
          <div className="an-gate-logo">📊</div>
          <div className="an-gate-title">Analytics</div>
          <div className="an-gate-sub">Private dashboard · enter passcode</div>
          <form className="an-gate-form" onSubmit={submit}>
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

// ── Section wrapper ────────────────────────────────────────────────
function Section({ icon, label, children }) {
  return (
    <div className="an-section">
      <div className="an-section-head">
        <div className="an-section-icon">{icon}</div>
        <div className="an-section-label">{label}</div>
      </div>
      {children}
    </div>
  );
}

// ── Dashboard ──────────────────────────────────────────────────────
function Dashboard() {
  const navigate = useNavigate();
  const { info: ip, loading: ipLoading } = useIpInfo();
  const browser = useBrowserInfo();
  const { profile, repos, totalStars, totalForks, loading: ghLoading } = useGitHub();

  return (
    <div className="an-root">
      <nav className="an-nav">
        <button className="an-back" onClick={() => navigate('/', { state: { scrollTo: 'projects' } })}>
          ← Timeline
        </button>
        <span className="an-nav-title">Analytics Dashboard</span>
        <div className="an-nav-right">
          <span className="an-badge an-badge--green">● Internal</span>
          <span className="an-badge an-badge--gray">Private</span>
        </div>
      </nav>

      <div className="an-body">

        {/* ── IP & Location ── */}
        <Section icon="🌐" label="Your Current IP & Location">
          {ipLoading ? (
            <div className="an-info-card">
              {[...Array(5)].map((_, i) => (
                <div className="an-info-row" key={i}>
                  <div className="an-skeleton" style={{ width: 90 }} />
                  <div className="an-skeleton" style={{ width: 160 }} />
                </div>
              ))}
            </div>
          ) : ip ? (
            <div className="an-info-card">
              <div className="an-info-row">
                <span className="an-info-key">ip</span>
                <span className="an-info-val an-info-val--green">{ip.ip}</span>
              </div>
              <div className="an-info-row">
                <span className="an-info-key">location</span>
                <span className="an-info-val">{ip.city}, {ip.region}, {ip.country_name}</span>
              </div>
              <div className="an-info-row">
                <span className="an-info-key">isp / org</span>
                <span className="an-info-val">{ip.org || '—'}</span>
              </div>
              <div className="an-info-row">
                <span className="an-info-key">timezone</span>
                <span className="an-info-val">{ip.timezone}</span>
              </div>
              <div className="an-info-row">
                <span className="an-info-key">coordinates</span>
                <span className="an-info-val an-info-val--dim">{ip.latitude}, {ip.longitude}</span>
              </div>
            </div>
          ) : (
            <div className="an-info-card">
              <div className="an-info-row">
                <span className="an-info-val an-info-val--dim">Could not fetch IP info</span>
              </div>
            </div>
          )}
        </Section>

        {/* ── Browser Info ── */}
        <Section icon="💻" label="Your Browser & Device">
          <div className="an-info-card">
            <div className="an-info-row">
              <span className="an-info-key">browser</span>
              <span className="an-info-val an-info-val--green">{browser.browser}</span>
            </div>
            <div className="an-info-row">
              <span className="an-info-key">os</span>
              <span className="an-info-val">{browser.os}</span>
            </div>
            <div className="an-info-row">
              <span className="an-info-key">platform</span>
              <span className="an-info-val">{browser.platform}</span>
            </div>
            <div className="an-info-row">
              <span className="an-info-key">language</span>
              <span className="an-info-val">{browser.language}</span>
            </div>
            <div className="an-info-row">
              <span className="an-info-key">screen</span>
              <span className="an-info-val">{browser.screen} @ {browser.dpr}x</span>
            </div>
            <div className="an-info-row">
              <span className="an-info-key">viewport</span>
              <span className="an-info-val">{browser.viewport}</span>
            </div>
            <div className="an-info-row">
              <span className="an-info-key">cookies</span>
              <span className="an-info-val">{browser.cookieOn}</span>
            </div>
          </div>
        </Section>

        <div className="an-divider" />

        {/* ── GitHub Stats ── */}
        <Section icon="⚡" label="GitHub Profile">
          <div className="an-grid-4" style={{ marginBottom: 12 }}>
            {[
              { label: 'Followers',    value: ghLoading ? '—' : profile?.followers ?? '—',  sub: 'github.com/adsouza5' },
              { label: 'Public Repos', value: ghLoading ? '—' : profile?.public_repos ?? '—', sub: 'All public repos' },
              { label: 'Total Stars',  value: ghLoading ? '—' : totalStars,                 sub: 'Portfolio repos' },
              { label: 'Total Forks',  value: ghLoading ? '—' : totalForks,                 sub: 'Portfolio repos' },
            ].map(s => (
              <div className="an-card" key={s.label}>
                <div className="an-card-label">{s.label}</div>
                <div className="an-card-value">{s.value}</div>
                <div className="an-card-sub">{s.sub}</div>
              </div>
            ))}
          </div>

          <div className="an-table-wrap">
            <table className="an-table">
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
                {ghLoading ? (
                  <tr><td colSpan={5} style={{ color: '#334155', textAlign: 'center' }}>Loading…</td></tr>
                ) : repos.map(r => (
                  <tr key={r.name}>
                    <td>
                      <a className="an-repo-link" href={r.html_url} target="_blank" rel="noopener noreferrer">
                        {r.name}
                      </a>
                    </td>
                    <td>{r.language ? <span className="an-lang-pill">{r.language}</span> : <span style={{ color: '#1e293b' }}>—</span>}</td>
                    <td>{r.stargazers_count}</td>
                    <td>{r.forks_count}</td>
                    <td style={{ fontSize: 12, color: '#334155' }}>
                      {new Date(r.updated_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>

        <div className="an-divider" />

        {/* ── GA4 ── */}
        <Section icon="📊" label="Google Analytics 4">
          <div className="an-ga-grid">
            {GA_LINKS.map(l => (
              <a key={l.title} className="an-ga-link" href={l.href} target="_blank" rel="noopener noreferrer">
                <span className="an-ga-link-icon">{l.icon}</span>
                <div>
                  <div className="an-ga-link-title">{l.title}</div>
                  <div className="an-ga-link-sub">{l.sub}</div>
                </div>
              </a>
            ))}
          </div>
        </Section>

      </div>
    </div>
  );
}

// ── Root ───────────────────────────────────────────────────────────
export default function AnalyticsDashboard() {
  const [authed, setAuthed] = useState(() => {
    const already = sessionStorage.getItem(SESSION_KEY) === '1';
    if (already) markAsInternal();
    return already;
  });
  if (!authed) return <Gate onAuth={() => setAuthed(true)} />;
  return <Dashboard />;
}
