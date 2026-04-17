import React, { useEffect, useState, useCallback } from 'react';
import './Personal.css';
import { INTRO, HOBBIES, POEMS, PHOTOS } from './PersonalData';

/* ── Lightbox ──────────────────────────────────────────── */
const Lightbox = ({ photos, index, onClose, onNavigate }) => {
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape')     onClose();
      if (e.key === 'ArrowLeft')  onNavigate(-1);
      if (e.key === 'ArrowRight') onNavigate(1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, onNavigate]);

  return (
    <div className="lightbox" onClick={onClose}>
      <div className="lightbox-inner" onClick={(e) => e.stopPropagation()}>
        <img src={photos[index]} alt={`moment ${index + 1}`} className="lightbox-img" />
        <button className="lightbox-nav lightbox-nav--prev" onClick={() => onNavigate(-1)} disabled={index === 0}>←</button>
        <button className="lightbox-nav lightbox-nav--next" onClick={() => onNavigate(1)} disabled={index === photos.length - 1}>→</button>
        <button className="lightbox-close" onClick={onClose}>✕</button>
        <span className="lightbox-counter">{index + 1} / {photos.length}</span>
      </div>
    </div>
  );
};

/* ── Hex photo gallery ─────────────────────────────────── */
const PhotoGallery = ({ photos }) => {
  const [lightboxIndex, setLightboxIndex] = useState(null);
  const visible = photos.filter(Boolean);

  const navigate = useCallback((dir) => {
    setLightboxIndex((i) => {
      const next = i + dir;
      if (next < 0 || next >= visible.length) return i;
      return next;
    });
  }, [visible.length]);

  /* 7 photos → 2-3-2 hexagonal shape
     other counts → rows of 3 with alternating offset */
  const rowDefs = [];
  if (visible.length === 7) {
    rowDefs.push({ photos: visible.slice(0, 2), startIdx: 0, offset: true,  partial: false });
    rowDefs.push({ photos: visible.slice(2, 5), startIdx: 2, offset: false, partial: false });
    rowDefs.push({ photos: visible.slice(5, 7), startIdx: 5, offset: true,  partial: false });
  } else {
    let i = 0, r = 0;
    while (i < visible.length) {
      const chunk = visible.slice(i, i + 3);
      rowDefs.push({
        photos:   chunk,
        startIdx: i,
        offset:   r % 2 === 1 && chunk.length === 3,
        partial:  chunk.length < 3,
      });
      i += 3; r++;
    }
  }

  return (
    <>
      <div className="hex-grid">
        {rowDefs.map((row, rowIdx) => (
          <div
            key={rowIdx}
            className={[
              'hex-row',
              row.offset  ? 'hex-row--offset'  : '',
              row.partial ? 'hex-row--partial' : '',
            ].filter(Boolean).join(' ')}
          >
            {row.photos.map((src, colIdx) => {
              const idx = row.startIdx + colIdx;
              return (
                <div
                  key={colIdx}
                  className="hex-item"
                  onClick={() => setLightboxIndex(idx)}
                >
                  <img src={src} alt={`moment ${idx + 1}`} />
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {lightboxIndex !== null && (
        <Lightbox
          photos={visible}
          index={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
          onNavigate={navigate}
        />
      )}
    </>
  );
};

/* ── Trigger card (on main page) ───────────────────────── */
export const PersonalTrigger = ({ onOpen }) => (
  <div className="personal-trigger-section">
    <div
      className="personal-trigger-card"
      onClick={onOpen}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && onOpen()}
    >
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

/* ── Main overlay ──────────────────────────────────────── */
const Personal = ({ isOpen, onClose }) => {
  const overlayRef = React.useRef(null);

  useEffect(() => {
    if (isOpen && overlayRef.current) overlayRef.current.scrollTop = 0;
    document.body.style.overflow = isOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div ref={overlayRef} className={`personal-overlay${isOpen ? ' open' : ''}`}>

      <div className="personal-close">
        <button className="personal-close-btn" onClick={onClose}>✕ &nbsp;Close</button>
      </div>

      <div className="personal-content">

        <div className="personal-header">
          <span className="personal-eyebrow">Adam Dsouza — the person</span>
          <h1 className="personal-title">Hi. This is the other side.</h1>
          <p className="personal-intro">{INTRO}</p>
        </div>

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

        <div className="personal-section">
          <span className="personal-section-label">{'// places & moments'}</span>
          <PhotoGallery photos={PHOTOS} />
        </div>

      </div>
    </div>
  );
};

export default Personal;
