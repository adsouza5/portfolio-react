import { useEffect, useRef } from 'react';

const RINGS = [
  { radius: 60,  bins: [0,  4],  opacity: 0.55, spikeMax: 38, color: '16,185,129' },
  { radius: 105, bins: [4,  16], opacity: 0.40, spikeMax: 50, color: '16,185,129' },
  { radius: 155, bins: [16, 48], opacity: 0.28, spikeMax: 60, color: '52,211,153' },
  { radius: 210, bins: [48, 96], opacity: 0.18, spikeMax: 70, color: '52,211,153' },
];

const IDLE_RINGS = [60, 105, 155, 210, 270];
const POINTS = 180;
const TWO_PI = Math.PI * 2;

function drawIdle(ctx, cx, cy, t) {
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  IDLE_RINGS.forEach((r, i) => {
    const pulse = Math.sin(t * 0.6 + i * 0.7) * 4;
    ctx.beginPath();
    ctx.arc(cx, cy, r + pulse, 0, TWO_PI);
    ctx.strokeStyle = `rgba(16,185,129,${0.04 + i * 0.012})`;
    ctx.lineWidth = 1;
    ctx.stroke();
  });
}

function drawActive(ctx, cx, cy, dataArray) {
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);

  // Centre glow
  const grd = ctx.createRadialGradient(cx, cy, 0, cx, cy, 55);
  grd.addColorStop(0, 'rgba(16,185,129,0.08)');
  grd.addColorStop(1, 'rgba(16,185,129,0)');
  ctx.fillStyle = grd;
  ctx.beginPath();
  ctx.arc(cx, cy, 55, 0, TWO_PI);
  ctx.fill();

  RINGS.forEach(({ radius, bins, opacity, spikeMax, color }) => {
    const [binStart, binEnd] = bins;
    const binCount = binEnd - binStart;

    ctx.beginPath();
    for (let i = 0; i <= POINTS; i++) {
      const angle = (i / POINTS) * TWO_PI - Math.PI / 2;
      const binIdx = binStart + Math.floor((i / POINTS) * binCount);
      const amplitude = (dataArray[Math.min(binIdx, dataArray.length - 1)] || 0) / 255;
      const r = radius + amplitude * spikeMax;
      const x = cx + Math.cos(angle) * r;
      const y = cy + Math.sin(angle) * r;
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.strokeStyle = `rgba(${color},${opacity})`;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Faint fill
    ctx.fillStyle = `rgba(${color},${opacity * 0.08})`;
    ctx.fill();
  });
}

export default function CurrencyVisualizer({ state, analyserRef }) {
  const canvasRef = useRef(null);
  const rafRef    = useRef(null);
  const t0Ref     = useRef(performance.now());

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    function resize() {
      canvas.width  = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
    }
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    const dataArray = new Uint8Array(128);

    function loop() {
      rafRef.current = requestAnimationFrame(loop);
      const cx = canvas.width  / 2;
      const cy = canvas.height / 2;
      const t  = (performance.now() - t0Ref.current) / 1000;

      if (state === 'recording' && analyserRef.current) {
        analyserRef.current.getByteFrequencyData(dataArray);
        drawActive(ctx, cx, cy, dataArray);
      } else {
        drawIdle(ctx, cx, cy, t);
      }
    }

    loop();
    return () => {
      cancelAnimationFrame(rafRef.current);
      ro.disconnect();
    };
  }, [state, analyserRef]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'fixed',
        inset: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 0,
      }}
    />
  );
}
