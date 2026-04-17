import React, { useEffect, useState, useCallback } from 'react';
import ReactDOM from 'react-dom';
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

  return ReactDOM.createPortal(
    <div className="lightbox" onClick={onClose}>
      <div className="lightbox-inner" onClick={(e) => e.stopPropagation()}>
        <img src={photos[index]} alt={`moment ${index + 1}`} className="lightbox-img" />
        <button className="lightbox-nav lightbox-nav--prev" onClick={() => onNavigate(-1)} disabled={index === 0}>←</button>
        <button className="lightbox-nav lightbox-nav--next" onClick={() => onNavigate(1)} disabled={index === photos.length - 1}>→</button>
        <button className="lightbox-close" onClick={onClose}>✕</button>
        <span className="lightbox-counter">{index + 1} / {photos.length}</span>
      </div>
    </div>,
    document.body
  );
};

/* ── Hex beehive gallery ───────────────────────────────── */
const PhotoGallery = ({ photos }) => {
  const [lightboxIndex, setLightbox] = useState(null);
  const visible = photos.filter(Boolean);

  const navigate = useCallback((dir) => {
    setLightbox((i) => {
      const next = i + dir;
      if (next < 0 || next >= visible.length) return i;
      return next;
    });
  }, [visible.length]);

  if (visible.length === 0) return null;

  // 2-3-2 rows — centered alignment produces the hexagonal silhouette naturally
  const rows = [visible.slice(0, 2), visible.slice(2, 5), visible.slice(5, 7)];
  const startOf = [0, 2, 5];

  return (
    <>
      <div className="hex-grid">
        {rows.map((row, ri) => (
          <div key={ri} className="hex-row">
            {row.map((src, pi) => {
              const gi = startOf[ri] + pi;
              return (
                <div key={gi} className="hex-item" onClick={() => setLightbox(gi)}>
                  <div className="hex-inner">
                    <img src={src} alt={`moment ${gi + 1}`} />
                  </div>
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
          onClose={() => setLightbox(null)}
          onNavigate={navigate}
        />
      )}
    </>
  );
};

/* ── Photo slider ──────────────────────────────────────── */
const PhotoSlider = ({ photos }) => {
  const [current, setCurrent]       = useState(0);
  const [lightboxIndex, setLightbox] = useState(null);
  const visible = photos.filter(Boolean);

  const navigate = useCallback((dir) => {
    setLightbox((i) => {
      const next = i + dir;
      if (next < 0 || next >= visible.length) return i;
      return next;
    });
  }, [visible.length]);

  const prev = () => setCurrent((i) => Math.max(0, i - 1));
  const next = () => setCurrent((i) => Math.min(visible.length - 1, i + 1));

  if (visible.length === 0) return null;

  return (
    <>
      <div className="photo-slider">
        {/* Slide track */}
        <div className="slider-track">
          <div
            className="slider-reel"
            style={{ transform: `translateX(${-current * 100}%)` }}
          >
            {visible.map((src, i) => (
              <div
                key={i}
                className="slider-slide"
                onClick={() => setLightbox(i)}
              >
                <img src={src} alt={`moment ${i + 1}`} />
              </div>
            ))}
          </div>
        </div>

        {/* Navigation */}
        <button
          className="slider-nav slider-nav--prev"
          onClick={prev}
          disabled={current === 0}
          aria-label="Previous"
        >
          ←
        </button>
        <button
          className="slider-nav slider-nav--next"
          onClick={next}
          disabled={current === visible.length - 1}
          aria-label="Next"
        >
          →
        </button>

        {/* Dot indicators + counter */}
        <div className="slider-footer">
          <div className="slider-dots">
            {visible.map((_, i) => (
              <button
                key={i}
                className={`slider-dot${i === current ? ' active' : ''}`}
                onClick={() => setCurrent(i)}
                aria-label={`Go to photo ${i + 1}`}
              />
            ))}
          </div>
          <span className="slider-counter">{current + 1} / {visible.length}</span>
        </div>
      </div>

      {lightboxIndex !== null && (
        <Lightbox
          photos={visible}
          index={lightboxIndex}
          onClose={() => setLightbox(null)}
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
