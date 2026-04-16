import React, { useEffect } from 'react';
import './Personal.css';
import { INTRO, HOBBIES, POEMS, PHOTOS } from './PersonalData';

export const PersonalTrigger = ({ onOpen }) => (
  <div className="personal-trigger-section">
    <div className="personal-trigger-card" onClick={onOpen} role="button" tabIndex={0}
         onKeyDown={(e) => e.key === 'Enter' && onOpen()}>
      <span className="trigger-eyebrow">{'// outside the terminal'}</span>
      <h2 className="trigger-title">Beyond the code.</h2>
      <p className="trigger-sub">
        There's more to a person than their pull requests.<br />
        Take a personal look.
      </p>
      <button className="trigger-btn">Explore ↗</button>
    </div>
  </div>
);

const Personal = ({ isOpen, onClose }) => {
  /* Lock body scroll while overlay is open */
  useEffect(() => {
    document.body.style.overflow = isOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  /* Close on Escape */
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className={`personal-overlay${isOpen ? ' open' : ''}`}>

      <div className="personal-close">
        <button className="personal-close-btn" onClick={onClose}>
          ✕ &nbsp;Close
        </button>
      </div>

      <div className="personal-content">

        {/* Header */}
        <div className="personal-header">
          <span className="personal-eyebrow">Adam Dsouza — the person</span>
          <h1 className="personal-title">Hi. This is the other side.</h1>
          <p className="personal-intro">{INTRO}</p>
        </div>

        {/* Hobbies */}
        <div className="personal-section">
          <span className="personal-section-label">{'// when I\'m not coding'}</span>
          <div className="hobbies-grid">
            {HOBBIES.map((h) => (
              <div key={h.name} className="hobby-card">
                <span className="hobby-icon">{h.icon}</span>
                <span className="hobby-name">{h.name}</span>
                <span className="hobby-desc">{h.desc}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Poetry / Writing */}
        {POEMS.length > 0 && (
          <div className="personal-section">
            <span className="personal-section-label">{'// things I write'}</span>
            {POEMS.map((poem) => (
              <div key={poem.title} className="poem-block">
                <p className="poem-title">{poem.title}</p>
                <p className="poem-body">{poem.body}</p>
              </div>
            ))}
          </div>
        )}

        {/* Photo gallery */}
        <div className="personal-section">
          <span className="personal-section-label">{'// places & moments'}</span>
          <div className="photo-grid">
            {PHOTOS.map((src, i) => (
              <div key={i} className="photo-placeholder">
                {src
                  ? <img src={src} alt={`moment ${i + 1}`} />
                  : 'photo'}
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
};

export default Personal;
