import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import ReactDOM from 'react-dom';
import './Personal.css';
import { INTRO, HOBBIES, POEMS, PHOTOS } from './PersonalData';

/* ── Hex math: axial coordinates, pointy-top orientation ── */
const HEX_W      = 155;
const HEX_H      = 179;
const SQRT3      = Math.sqrt(3);
const CANVAS_PAD = 300;          // ensures the viewport can always scroll to center the core

// Six axial step-directions for walking a hex ring
const DIRS = [[1,0],[0,1],[-1,1],[-1,0],[0,-1],[1,-1]];

function hexRing(n) {
  if (n === 0) return [[0, 0]];
  const out = [];
  let [q, r] = [DIRS[4][0] * n, DIRS[4][1] * n]; // start at (0, -n)
  for (let s = 0; s < 6; s++) {
    for (let i = 0; i < n; i++) {
      out.push([q, r]);
      q += DIRS[s][0];
      r += DIRS[s][1];
    }
  }
  return out;
}

function buildLayout(count) {
  const cells = [];
  for (let ring = 0; cells.length < count; ring++) {
    for (const [q, r] of hexRing(ring)) {
      if (cells.length >= count) break;
      cells.push({ q, r, ring, x: HEX_W * (q + r / 2), y: HEX_W * SQRT3 / 2 * r });
    }
  }
  return cells;
}

function canvasMetrics(cells) {
  if (!cells.length) return { width: 0, height: 0, ox: 0, oy: 0 };
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (const { x, y } of cells) {
    x0 = Math.min(x0, x - HEX_W / 2);
    x1 = Math.max(x1, x + HEX_W / 2);
    y0 = Math.min(y0, y - HEX_H / 2);
    y1 = Math.max(y1, y + HEX_H / 2);
  }
  return {
    width:  x1 - x0 + CANVAS_PAD * 2,
    height: y1 - y0 + CANVAS_PAD * 2,
    ox: -x0 + CANVAS_PAD,
    oy: -y0 + CANVAS_PAD,
  };
}

/* ── Lightbox — editorial centered fade ────────────────── */
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

  const counter = `${String(index + 1).padStart(2, '0')} · ${String(photos.length).padStart(2, '0')}`;

  return ReactDOM.createPortal(
    <div className="lightbox" onClick={onClose}>
      {/* Prev arrow */}
      {index > 0 && (
        <button
          className="lightbox-nav lightbox-nav--prev"
          onClick={(e) => { e.stopPropagation(); onNavigate(-1); }}
          aria-label="Previous image"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <polyline points="15,4 7,12 15,20" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
      )}

      {/* Image — key triggers re-animation on navigate */}
      <img
        key={index}
        src={photos[index]}
        alt={`moment ${index + 1}`}
        className="lightbox-img"
        onClick={(e) => e.stopPropagation()}
      />

      {/* Next arrow */}
      {index < photos.length - 1 && (
        <button
          className="lightbox-nav lightbox-nav--next"
          onClick={(e) => { e.stopPropagation(); onNavigate(1); }}
          aria-label="Next image"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <polyline points="9,4 17,12 9,20" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
      )}

      {/* Counter */}
      <span className="lightbox-counter">{counter}</span>
    </div>,
    document.body
  );
};

/* ── Apple Watch–style radial hex beehive gallery ─────── */
const PhotoGallery = ({ photos }) => {
  const [lightboxIndex, setLightbox] = useState(null);
  const vpRef     = useRef(null);
  const canvasRef = useRef(null);
  const hexRefs   = useRef([]);
  const rafRef    = useRef(null);
  const posRef    = useRef({ x: 0, y: 0 }); // current canvas translate
  const dragRef   = useRef(null);            // active drag state

  const visible = photos.filter(Boolean);
  const cells   = useMemo(() => buildLayout(visible.length), [visible.length]);
  const cm      = useMemo(() => canvasMetrics(cells),        [cells]);

  const navigate = useCallback((dir) => {
    setLightbox(i => {
      const n = i + dir;
      return (n < 0 || n >= visible.length) ? i : n;
    });
  }, [visible.length]);

  useEffect(() => {
    const vp     = vpRef.current;
    const canvas = canvasRef.current;
    if (!vp || !canvas || !cm.width) return;

    const setPos = (x, y) => {
      posRef.current = { x, y };
      canvas.style.transform = `translate(${x}px, ${y}px)`;
    };

    const updateScales = () => {
      // Viewport centre expressed in canvas-local coordinates
      const cx = vp.clientWidth  / 2 - posRef.current.x;
      const cy = vp.clientHeight / 2 - posRef.current.y;
      const md = Math.hypot(vp.clientWidth / 2, vp.clientHeight / 2);
      const dz = 180; // deadzone — ring-0 & ring-1 stay at 1.0 when centred

      cells.forEach(({ x, y }, i) => {
        const el = hexRefs.current[i];
        if (!el) return;
        const d = Math.hypot(cm.ox + x - cx, cm.oy + y - cy);
        const t = Math.min(1, Math.max(0, d - dz) / (md - dz));
        el.style.transform = `scale(${(1 - t * 0.38).toFixed(3)})`;
      });
    };

    // Centre the canvas on mount; double-rAF ensures layout is settled
    setPos(
      -(cm.width  - vp.clientWidth)  / 2,
      -(cm.height - vp.clientHeight) / 2,
    );
    requestAnimationFrame(() => requestAnimationFrame(updateScales));

    // ── Drag-to-pan ──────────────────────────────────────
    const onPointerDown = (e) => {
      if (e.button > 0) return;
      vp.setPointerCapture(e.pointerId); // locks all pointermove to this element
      dragRef.current = {
        sx: e.clientX, sy: e.clientY,
        ox: posRef.current.x, oy: posRef.current.y,
        moved: false,
      };
      vp.classList.add('is-dragging');
    };

    const onPointerMove = (e) => {
      if (!dragRef.current) return;
      const dx = e.clientX - dragRef.current.sx;
      const dy = e.clientY - dragRef.current.sy;
      if (!dragRef.current.moved && Math.hypot(dx, dy) < 4) return;
      dragRef.current.moved = true;

      const minX = -(cm.width  - vp.clientWidth);
      const minY = -(cm.height - vp.clientHeight);
      setPos(
        Math.min(0, Math.max(minX, dragRef.current.ox + dx)),
        Math.min(0, Math.max(minY, dragRef.current.oy + dy)),
      );
      cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(updateScales);
    };

    const onPointerUp = (e) => {
      if (!dragRef.current) return; // guard against lostpointercapture double-fire
      const wasDrag = dragRef.current.moved;
      dragRef.current = null;
      vp.classList.remove('is-dragging');
      if (vp.hasPointerCapture(e.pointerId)) vp.releasePointerCapture(e.pointerId);

      if (!wasDrag) {
        // Use elementFromPoint so click detection works regardless of capture
        const target = document.elementFromPoint(e.clientX, e.clientY);
        const cell = target?.closest('[data-hex-index]');
        if (cell) setLightbox(parseInt(cell.dataset.hexIndex, 10));
      }
    };

    // All listeners on vp — pointer capture routes events here during drag
    vp.addEventListener('pointerdown',        onPointerDown);
    vp.addEventListener('pointermove',        onPointerMove);
    vp.addEventListener('pointerup',          onPointerUp);
    vp.addEventListener('pointercancel',      onPointerUp);
    vp.addEventListener('lostpointercapture', onPointerUp);

    return () => {
      vp.removeEventListener('pointerdown',        onPointerDown);
      vp.removeEventListener('pointermove',        onPointerMove);
      vp.removeEventListener('pointerup',          onPointerUp);
      vp.removeEventListener('pointercancel',      onPointerUp);
      vp.removeEventListener('lostpointercapture', onPointerUp);
      cancelAnimationFrame(rafRef.current);
    };
  }, [cells, cm]);

  if (!visible.length) return null;

  return (
    <>
      <div className="hex-viewport" ref={vpRef}>
        <div
          ref={canvasRef}
          className="hex-canvas"
          style={{ width: cm.width, height: cm.height }}
        >
          {visible.map((src, i) => {
            const { x, y } = cells[i];
            return (
              <div
                key={i}
                ref={el => { hexRefs.current[i] = el; }}
                className="hex-cell"
                data-hex-index={i}
                style={{ left: cm.ox + x - HEX_W / 2, top: cm.oy + y - HEX_H / 2 }}
              >
                <div className="hex-inner">
                  <img src={src} alt={`moment ${i + 1}`} draggable={false} />
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <p className="hex-hint">drag to explore &nbsp;·&nbsp; click to expand</p>

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

/* ── Poem block with smooth read-more ─────────────────── */
const PREVIEW_STANZAS = 2;

const PoemBlock = ({ poem, onToggle, onCollapse }) => {
  const bodyRef  = useRef(null);
  const [expanded,    setExpanded]    = useState(false);
  const [fullHeight,  setFullHeight]  = useState(null);
  const [previewH,    setPreviewH]    = useState(400);
  const [needsToggle, setNeedsToggle] = useState(false);

  useEffect(() => {
    const el = bodyRef.current;
    if (!el) return;
    const full = el.scrollHeight;
    setFullHeight(full);

    const stanzas = poem.body.split('\n\n');
    if (stanzas.length > PREVIEW_STANZAS) {
      const probe = el.cloneNode(false);
      probe.style.cssText        = window.getComputedStyle(el).cssText;
      probe.style.position       = 'absolute';
      probe.style.visibility     = 'hidden';
      probe.style.height         = 'auto';
      probe.style.width          = `${el.offsetWidth}px`;
      probe.textContent          = stanzas.slice(0, PREVIEW_STANZAS).join('\n\n');
      el.parentNode.insertBefore(probe, el);
      const ph = probe.offsetHeight + 28;
      probe.remove();
      setPreviewH(ph);
      const needs = full > ph + 40;
      setNeedsToggle(needs);
      onToggle?.(needs);
    } else {
      setNeedsToggle(false);
      onToggle?.(false);
    }
  }, [poem.body, onToggle]);

  const wrapHeight = !needsToggle
    ? undefined
    : fullHeight === null
      ? previewH
      : expanded ? fullHeight : previewH;

  return (
    <div className={`poem-block${expanded ? ' poem-block--expanded' : ''}`}>
      <h3 className="poem-title">{poem.title}</h3>

      <div
        className={`poem-body-wrap${needsToggle ? ' poem-body-wrap--clipped' : ''}`}
        style={needsToggle ? { height: wrapHeight } : {}}
      >
        <p ref={bodyRef} className="poem-body">{poem.body}</p>
      </div>

      {needsToggle && (
        <button
          className={`poem-toggle${expanded ? ' poem-toggle--open' : ''}`}
          onClick={() => {
            if (expanded) onCollapse?.();
            setExpanded(e => !e);
          }}
        >
          <span className="poem-toggle-rule" />
          <span className="poem-toggle-label">
            {expanded ? 'collapse' : 'continue'}
          </span>
          <span className="poem-toggle-rule" />
        </button>
      )}
    </div>
  );
};

/* ── Scroll-reveal fade-in ─────────────────────────────── */
const FadeIn = ({ children, delay = 0 }) => {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) { setVisible(true); obs.disconnect(); }
      },
      { threshold: 0.06, rootMargin: '0px 0px -30px 0px' }
    );
    // Wait for the overlay open transition (600ms) before observing,
    // so above-fold elements don't fire while the panel is still sliding up
    const t = setTimeout(() => { if (el) obs.observe(el); }, 660);
    return () => { clearTimeout(t); obs.disconnect(); };
  }, []);

  return (
    <div
      ref={ref}
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? 'none' : 'translateY(20px)',
        transition: `opacity 0.75s ease ${delay}ms, transform 0.8s cubic-bezier(0.25, 1, 0.35, 1) ${delay}ms`,
      }}
    >
      {children}
    </div>
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
  const [contentKey,  setContentKey]  = useState(0);
  const [poemIndex,      setPoemIndex]      = useState(0);
  const [poemHasToggle,  setPoemHasToggle]  = useState(false);
  const [sectionFading,  setSectionFading]  = useState(false);
  const poemsSectionRef = useRef(null);

  const handlePoemCollapse = useCallback(() => {
    requestAnimationFrame(() => {
      const section = poemsSectionRef.current;
      const overlay = overlayRef.current;
      if (!section || !overlay) return;
      const sectionDocTop = section.getBoundingClientRect().top + overlay.scrollTop;
      const targetScrollTop = Math.max(0, sectionDocTop - overlay.clientHeight * 0.25);
      overlay.scrollTo({ top: targetScrollTop, behavior: 'smooth' });
    });
  }, []);

  const navigatePoem = useCallback((dir) => {
    // Fade out old poem + scroll to center simultaneously
    setSectionFading(true);
    requestAnimationFrame(() => {
      const section = poemsSectionRef.current;
      const overlay = overlayRef.current;
      if (!section || !overlay) return;
      const sectionDocTop = section.getBoundingClientRect().top + overlay.scrollTop;
      const targetScrollTop = Math.max(0, sectionDocTop - overlay.clientHeight * 0.25);
      overlay.scrollTo({ top: targetScrollTop, behavior: 'smooth' });
    });
    // After fade-out completes, swap poem then fade in slowly
    setTimeout(() => {
      setPoemIndex(i => i + dir);
      requestAnimationFrame(() => requestAnimationFrame(() => setSectionFading(false)));
    }, 380);
  }, []);

  useEffect(() => {
    if (isOpen && overlayRef.current) overlayRef.current.scrollTop = 0;
    if (isOpen) { setContentKey(k => k + 1); setPoemIndex(0); setPoemHasToggle(false); setSectionFading(false); }
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

      <div className="personal-content" key={contentKey}>

        <FadeIn delay={0}>
          <div className="personal-header">
            <span className="personal-eyebrow">Adam Dsouza — the person</span>
            <h1 className="personal-title">Hi. This is the other side.</h1>
            <p className="personal-intro">{INTRO}</p>
          </div>
        </FadeIn>

        <FadeIn delay={90}>
          <div className="personal-section">
            <span className="personal-section-label">{'// when I\'m not coding'}</span>
            <div className="hobbies-grid">
              {HOBBIES.map((h) => (
                <div key={h.name} className="hobby-card">
                  <span className="hobby-name">{h.name}</span>
                  <span className="hobby-desc">{h.desc}</span>
                </div>
              ))}
            </div>
          </div>
        </FadeIn>

        {POEMS.length > 0 && (
          <FadeIn>
            <div style={{
              opacity: sectionFading ? 0 : 1,
              transition: sectionFading
                ? 'opacity 0.35s ease'
                : 'opacity 0.9s cubic-bezier(0.25, 1, 0.35, 1)',
            }}>
            <div ref={poemsSectionRef} className="personal-section personal-section--poems">
              <span className="personal-section-label">{'// things I write'}</span>
              <div className={`poems-nav${poemHasToggle ? '' : ' poems-nav--centered'}`}>
                <button
                  className="poems-arrow poems-arrow--prev"
                  onClick={() => navigatePoem(-1)}
                  aria-label="Previous poem"
                  style={{ visibility: poemIndex > 0 ? 'visible' : 'hidden' }}
                >←</button>

                <div className="poem-carousel">
                  <PoemBlock
                    key={poemIndex}
                    poem={POEMS[poemIndex]}
                    onToggle={setPoemHasToggle}
                    onCollapse={handlePoemCollapse}
                  />
                </div>

                <button
                  className="poems-arrow poems-arrow--next"
                  onClick={() => navigatePoem(1)}
                  aria-label="Next poem"
                  style={{ visibility: poemIndex < POEMS.length - 1 ? 'visible' : 'hidden' }}
                >→</button>
              </div>
            </div>
            </div>
          </FadeIn>
        )}

        <FadeIn>
          <div className="personal-section">
            <span className="personal-section-label">{'// places & moments'}</span>
            <PhotoGallery photos={PHOTOS} />
          </div>
        </FadeIn>

      </div>
    </div>
  );
};

export default Personal;
