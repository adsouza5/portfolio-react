import React, { useRef, useEffect, useState } from 'react';
import entries from './TimelineData';
import Skills from './Skills';
import './Projects.css';

const TYPE_LABELS = {
  project:   'Project',
  work:      'Work',
  education: 'Education',
};


const Projects = () => {
  const cardRefs   = useRef([]);
  const [markerTops, setMarkerTops] = useState([]);

  useEffect(() => {
    const measure = () =>
      setMarkerTops(cardRefs.current.map((el) => el?.offsetTop ?? 0));
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, []);

  const openLink = (link) => {
    if (link) window.open(link, '_blank', 'noopener,noreferrer');
  };

  return (
    <section id="projects" className="projects-section">

      {/* ── Timeline spine ── */}
      <div className="timeline" aria-hidden="true">
        <div className="timeline-line" />
        {entries.map((entry, i) => (
          <div
            key={i}
            className={`timeline-entry timeline-entry--${entry.type}`}
            style={{ top: `${(markerTops[i] ?? 0) + 28}px` }}
          >
            <div className="timeline-marker" />
            <span className="timeline-label">{entry.date}</span>
          </div>
        ))}
      </div>

      {/* ── Cards ── */}
      <div className="projects-content">
        <h1 className="projects-title">Timeline</h1>
        <Skills />

        {entries.map((entry, i) => (
          <div
            key={i}
            className={`project-card project-card--${entry.type}${entry.link ? ' clickable' : ''}`}
            ref={(el) => (cardRefs.current[i] = el)}
            onClick={() => openLink(entry.link)}
            role={entry.link ? 'link' : undefined}
            tabIndex={entry.link ? 0 : undefined}
            onKeyDown={(e) => e.key === 'Enter' && openLink(entry.link)}
          >
            {/* Row 1 — type · status · date · location */}
            <div className="card-meta">
              <div className="card-meta-left">
                <span className={`card-type card-type--${entry.type}`}>
                  {TYPE_LABELS[entry.type]}
                </span>
                {entry.status && (
                  <span className="card-status">{entry.status}</span>
                )}
              </div>
              <div className="card-meta-right">
                <span className="card-date">{entry.date}</span>
                {entry.location && (
                  <span className="card-location">{entry.location}</span>
                )}
              </div>
            </div>

            {/* Row 2 — title + org */}
            <div className="card-header">
              <h3 className="card-title">{entry.title}</h3>
              {entry.org && (
                <span className="card-org">@ {entry.org}</span>
              )}
            </div>

            <p className="card-desc">{entry.description}</p>

            {entry.tags?.length > 0 && (
              <div className="card-tags">
                {entry.tags.map((tag) => (
                  <span key={tag} className={`card-tag card-tag--${entry.type}`}>
                    {tag}
                  </span>
                ))}
              </div>
            )}

            {entry.link && (
              <span className="card-cta">View →</span>
            )}
          </div>
        ))}
      </div>
    </section>
  );
};

export default Projects;
