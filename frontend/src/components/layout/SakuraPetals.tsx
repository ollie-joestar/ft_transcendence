import { useEffect, useRef } from "react";

// ── SakuraPetals ─────────────────────────────────────────────────────────────
interface Petal {
  x: number;
  y: number;
  size: number;
  rotation: number;
  rotSpeed: number;
  vy: number;
  vx: number;
  opacity: number;
  swayAmp: number;
  swayPhase: number;
}

function spawnPetal(w: number, h: number, scatterY = false): Petal {
  return {
    x: Math.random() * w,
    y: scatterY ? Math.random() * h : -(10 + Math.random() * 80),
    size: 4 + Math.random() * 7,
    rotation: Math.random() * Math.PI * 2,
    rotSpeed: (Math.random() - 0.5) * 0.03,
    vy: 0.3 + Math.random() * 0.5,
    vx: (Math.random() - 0.5) * 0.2,
    opacity: 0.2 + Math.random() * 0.45,
    swayAmp: 0.25 + Math.random() * 0.4,
    swayPhase: Math.random() * Math.PI * 2,
  };
}

function resetPetal(p: Petal, w: number): void {
  p.x = Math.random() * w;
  p.y = -(10 + Math.random() * 40);
  p.size = 4 + Math.random() * 7;
  p.rotation = Math.random() * Math.PI * 2;
  p.rotSpeed = (Math.random() - 0.5) * 0.03;
  p.vy = 0.3 + Math.random() * 0.5;
  p.vx = (Math.random() - 0.5) * 0.2;
  p.opacity = 0.2 + Math.random() * 0.45;
  p.swayAmp = 0.25 + Math.random() * 0.4;
  p.swayPhase = Math.random() * Math.PI * 2;
}

function drawPetal(ctx: CanvasRenderingContext2D, p: Petal, t: number): void {
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(p.rotation + Math.sin(t * 0.012 + p.swayPhase) * 0.22);
  ctx.globalAlpha = p.opacity;
  ctx.fillStyle = "#f4a5b8";
  ctx.beginPath();
  ctx.ellipse(0, 0, p.size * 0.42, p.size, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = p.opacity * 0.5;
  ctx.fillStyle = "#fce8f0";
  ctx.beginPath();
  ctx.ellipse(
    0,
    -p.size * 0.18,
    p.size * 0.17,
    p.size * 0.42,
    0,
    0,
    Math.PI * 2,
  );
  ctx.fill();
  ctx.restore();
}

interface SakuraPetalsProps {
  count?: number;
}

export function SakuraPetals({ count = 69 }: SakuraPetalsProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let w = 0,
      h = 0;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      w = rect.width;
      h = rect.height;
      canvas.width = w;
      canvas.height = h;
    };

    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    resize();

    const petals: Petal[] = Array.from({ length: count }, (_, i) =>
      spawnPetal(w, h, i < Math.floor(count * 0.6)),
    );

    let t = 0;
    let raf: number;

    const tick = () => {
      ctx.clearRect(0, 0, w, h);
      t++;

      for (const p of petals) {
        p.y += p.vy;
        p.x += p.vx + Math.sin(t * 0.018 + p.swayPhase) * p.swayAmp;
        p.rotation += p.rotSpeed;

        if (p.y > h + 20 || p.x < -30 || p.x > w + 30) {
          resetPetal(p, w);
        }

        drawPetal(ctx, p, t);
      }

      raf = requestAnimationFrame(tick);
    };

    tick();

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [count]);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full pointer-events-none"
    />
  );
}
