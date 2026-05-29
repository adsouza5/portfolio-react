import { useEffect, useRef } from 'react';

const RINGS = [
  { radius: 60,  binStart: 0,  binEnd: 4,  numSpikes: 32, halfWidth: 0.045, spikeMax: 38, opacity: 0.60, color: '16,185,129' },
  { radius: 105, binStart: 4,  binEnd: 16, numSpikes: 48, halfWidth: 0.038, spikeMax: 52, opacity: 0.42, color: '16,185,129' },
  { radius: 155, binStart: 16, binEnd: 48, numSpikes: 56, halfWidth: 0.032, spikeMax: 62, opacity: 0.28, color: '52,211,153' },
  { radius: 210, binStart: 48, binEnd: 96, numSpikes: 64, halfWidth: 0.028, spikeMax: 72, opacity: 0.18, color: '52,211,153' },
];

const IDLE_RINGS = [60, 105, 155, 210, 270];
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
  grd.addColorStop(0, 'rgba(16,185,129,0.10)');
  grd.addColorStop(1, 'rgba(16,185,129,0)');
  ctx.fillStyle = grd;
  ctx.beginPath();
  ctx.arc(cx, cy, 55, 0, TWO_PI);
  ctx.fill();

  RINGS.forEach(({ radius, binStart, binEnd, numSpikes, halfWidth, spikeMax, opacity, color }) => {
    const binCount = binEnd - binStart;

    // Base circle
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, TWO_PI);
    ctx.strokeStyle = `rgba(${color},${opacity * 0.35})`;
    ctx.lineWidth = 1;
    ctx.stroke();

    // Triangular spikes
    for (let i = 0; i < numSpikes; i++) {
      const centerAngle = (i / numSpikes) * TWO_PI - Math.PI / 2;
      const binIdx = binStart + Math.floor((i / numSpikes) * binCount);
      const amplitude = (dataArray[Math.min(binIdx, dataArray.length - 1)] || 0) / 255;
      if (amplitude < 0.04) continue;

      const tipR = radius + amplitude * spikeMax;
      const lAngle = centerAngle - halfWidth;
      const rAngle = centerAngle + halfWidth;

      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(lAngle) * radius, cy + Math.sin(lAngle) * radius);
      ctx.lineTo(cx + Math.cos(centerAngle) * tipR, cy + Math.sin(centerAngle) * tipR);
      ctx.lineTo(cx + Math.cos(rAngle) * radius, cy + Math.sin(rAngle) * radius);
      ctx.closePath();

      ctx.fillStyle = `rgba(${color},${opacity * 0.35})`;
      ctx.fill();
      ctx.strokeStyle = `rgba(${color},${opacity})`;
      ctx.lineWidth = 1.2;
      ctx.stroke();
    }
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
