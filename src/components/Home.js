import React, { useRef, useEffect } from 'react';
import './Home.css';

const MatrixRain = () => {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');

    let w, h, columns, rafId;

    const SPACING   = 90;
    const DOT_R     = 2.2;
    const GAP       = 20;
    const TRAIL_LEN = 7;
    const BASE_SPD  = 0.55;

    const init = () => {
      w = canvas.offsetWidth;
      h = canvas.offsetHeight;
      canvas.width  = w;
      canvas.height = h;

      const count = Math.max(1, Math.floor(w / SPACING));
      columns = Array.from({ length: count }, (_, i) => ({
        x:     SPACING * 0.5 + i * SPACING + (Math.random() - 0.5) * 18,
        y:     -Math.random() * h * 1.2,
        speed: BASE_SPD + Math.random() * 0.55,
      }));
    };

    const tick = () => {
      ctx.clearRect(0, 0, w, h);

      columns.forEach((col) => {
        col.y += col.speed;

        for (let t = 0; t < TRAIL_LEN; t++) {
          const dotY = col.y - t * GAP;
          if (dotY < 0 || dotY > h) continue;

          const alpha = t === 0 ? 0.85 : 0.55 * (1 - t / TRAIL_LEN);
          ctx.beginPath();
          ctx.arc(col.x, dotY, DOT_R, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(23, 126, 137, ${alpha})`;
          ctx.fill();
        }

        if (col.y - TRAIL_LEN * GAP > h) {
          col.y     = -Math.random() * h * 0.6;
          col.speed = BASE_SPD + Math.random() * 0.55;
        }
      });

      rafId = requestAnimationFrame(tick);
    };

    init();
    rafId = requestAnimationFrame(tick);

    window.addEventListener('resize', init);
    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener('resize', init);
    };
  }, []);

  return <canvas ref={canvasRef} className="matrix-canvas" />;
};

const Home = () => (
  <section id="home" className="section visible">
    <MatrixRain />

    <div className="hero-content">
      <p className="hero-eyebrow">
        Open to full-time opportunities <span>▋</span>
      </p>

      <a
        href="https://www.linkedin.com/in/adam-dsouza/"
        target="_blank"
        rel="noopener noreferrer"
        className="hero-name"
      >
        Adam Dsouza
      </a>

      <p className="hero-role">Full-Stack Engineer · Cloud &amp; AI</p>

      <p className="hero-bio">
        Full-stack engineer specializing in cloud-native AI/ML systems and
        distributed backends — currently building production infrastructure
        at Synechron. I build systems that connect technical architecture
        to business outcomes: ML pipelines, API gateways, semantic search
        — designed for real load and real complexity.
      </p>

      <div className="hero-ctas">
        <a href="#projects" className="cta-primary">
          Explore Timeline ↓
        </a>
        <a
          href="/images/resume.jpg"
          target="_blank"
          rel="noopener noreferrer"
          className="cta-secondary"
        >
          Resume ↗
        </a>
      </div>
    </div>
  </section>
);

export default Home;
