import React, { useRef, useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import entries from './TimelineData';
import Skills from './Skills';
import './Projects.css';

const SHOWCASE_ROUTES = {
  MLPipelineShowcase: '/projects/sentinel',
};

const TYPE_LABELS = {
  project:   'Project',
  work:      'Work',
  education: 'Education',
};

const Projects = () => {
  const cardRefs = useRef([]);
  const [markerTops, setMarkerTops] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    const measure = () =>
      setMarkerTops(cardRefs.current.map((el) => el?.offsetTop ?? 0));
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, []);

  const handleCardClick = useCallback((entry) => {
    if (entry.showcase) {
      navigate(SHOWCASE_ROUTES[entry.showcase]);
    } else if (entry.link) {
      window.open(entry.link, '_blank', 'noopener,noreferrer');
    }
  }, [navigate]);

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
            className={`project-card project-card--${entry.type}${(entry.link || entry.showcase) ? ' clickable' : ''}`}
            ref={(el) => (cardRefs.current[i] = el)}
            onClick={() => handleCardClick(entry)}
            role={(entry.link || entry.showcase) ? 'button' : undefined}
            tabIndex={(entry.link || entry.showcase) ? 0 : undefined}
            onKeyDown={(e) => e.key === 'Enter' && handleCardClick(entry)}
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

            {(entry.showcase || entry.link) && (
              <span className="card-cta">
                {entry.showcase ? 'Explore →' : 'View →'}
              </span>
            )}
          </div>
        ))}
      </div>
    </section>
  );
};

export default Projects;
