import { useEffect, useRef } from 'react';
import { ASSETS } from '../data/defaults';
import type { ScreenMode } from '../types/game';

interface OceanCanvasProps {
  screen: ScreenMode;
  targetDepth: number;
  depthElementRef: React.RefObject<HTMLDivElement | null>;
}

interface Bubble {
  x: number;
  y: number;
  s: number;
  r: number;
}

interface Fish {
  x: number;
  y: number;
  s: number;
  size: number;
  dir: number;
}

export function OceanCanvas({
  screen,
  targetDepth,
  depthElementRef,
}: OceanCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const screenRef = useRef<ScreenMode>(screen);
  const targetDepthRef = useRef<number>(targetDepth);
  const visualDepthRef = useRef<number>(0);

  useEffect(() => {
    screenRef.current = screen;
  }, [screen]);

  useEffect(() => {
    targetDepthRef.current = targetDepth;
  }, [targetDepth]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const c = canvas.getContext('2d');
    if (!c) return;

    const waterImg = new Image();
    const krillImg = new Image();
    waterImg.src = ASSETS.water;
    krillImg.src = ASSETS.krill;

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let w = 0;
    let h = 0;
    let last = 0;
    let sceneTime = 0;
    let surfaceY = 0;
    let rafId = 0;

    const bubbles: Bubble[] = Array.from({ length: 70 }, () => ({
      x: Math.random(),
      y: Math.random(),
      s: Math.random() * 0.016 + 0.005,
      r: Math.random() < 0.7 ? 1 : 2,
    }));

    const fishList: Fish[] = Array.from({ length: 25 }, () => ({
      x: Math.random(),
      y: Math.random() * 1500,
      s: Math.random() * 0.014 + 0.009,
      size: Math.floor(Math.random() * 3) + 2,
      dir: Math.random() < 0.5 ? -1 : 1,
    }));

    const resize = () => {
      w = Math.ceil(window.innerWidth / 3);
      h = Math.ceil(window.innerHeight / 3);
      canvas.width = w;
      canvas.height = h;
      c.imageSmoothingEnabled = false;
      if (!surfaceY) surfaceY = h * 0.53;
    };

    window.addEventListener('resize', resize);
    resize();

    const rect = (
      x: number,
      y: number,
      width: number,
      height: number,
      color: string,
    ) => {
      c.fillStyle = color;
      c.fillRect(Math.round(x), Math.round(y), Math.round(width), Math.round(height));
    };

    const cloud = (x: number, y: number, s: number) => {
      c.save();
      c.translate(Math.round(x), Math.round(y));
      c.scale(s, s);
      c.fillStyle = '#e9f2f0';
      const blocks: Array<[number, number, number, number]> = [
        [0, 12, 70, 6],
        [7, 7, 54, 7],
        [18, 0, 21, 10],
        [13, 4, 36, 10],
        [34, 5, 17, 9],
        [48, 10, 16, 7],
      ];
      blocks.forEach((b) => c.fillRect(...b));
      c.fillStyle = '#d0e0e5';
      c.fillRect(0, 15, 52, 3);
      c.restore();
    };

    const boat = (x: number, y: number, t: number) => {
      c.save();
      c.translate(
        Math.round(x),
        Math.round(y + (reduced ? 0 : Math.sin(t * 0.001) * 1.3)),
      );
      c.fillStyle = '#082b3b';
      const hull: Array<[number, number, number, number]> = [
        [0, 0, 40, 3],
        [2, 3, 35, 3],
        [6, 6, 27, 2],
        [14, -9, 16, 10],
        [16, -11, 18, 2],
        [18, -25, 2, 17],
        [35, -3, 9, 3],
      ];
      hull.forEach((b) => c.fillRect(...b));
      c.fillStyle = '#b9ddea';
      c.fillRect(17, -7, 3, 5);
      c.fillRect(23, -7, 3, 5);
      c.fillStyle = '#fa4e89';
      c.fillRect(10, -25, 8, 5);
      c.fillRect(8, -23, 3, 2);
      c.restore();
    };

    const fishSprite = (
      x: number,
      y: number,
      s: number,
      dir: number,
      color: string,
    ) => {
      c.save();
      c.translate(Math.round(x), Math.round(y));
      c.scale(dir, 1);
      rect(-s, -s / 2, s * 3, s, color);
      rect(0, -s, s, s * 2, color);
      rect(-s * 2, -s, s / 2, s * 2, color);
      rect(-s * 1.5, -s / 2, s, s, color);
      c.restore();
    };

    const jelly = (x: number, y: number, t: number, color: string) => {
      c.save();
      c.translate(Math.round(x), Math.round(y));
      rect(-5, -3, 10, 3, color);
      rect(-7, 0, 14, 5, color);
      rect(-4, -5, 8, 2, color);
      for (let j = -5; j <= 5; j += 3) {
        const bend = reduced ? 0 : Math.sin(t * 0.002 + j) * 2;
        rect(j, 5, 1, 6, color);
        rect(j + bend, 11, 1, 5, color);
      }
      c.restore();
    };

    const frame = (t: number) => {
      const dt = Math.min(40, t - last || 16);
      last = t;
      if (!reduced) sceneTime += dt;

      const tDepth = targetDepthRef.current;
      let vDepth = visualDepthRef.current;
      vDepth += (tDepth - vDepth) * (reduced ? 1 : 0.035);
      if (Math.abs(tDepth - vDepth) < 0.05) vDepth = tDepth;
      visualDepthRef.current = vDepth;

      const mode = screenRef.current;
      if (mode === 'play' && depthElementRef.current) {
        depthElementRef.current.textContent = `${Math.round(vDepth).toLocaleString()}m`;
      }

      const desiredSurface =
        mode === 'home'
          ? h * 0.54
          : mode === 'results'
            ? h * 0.35
            : mode === 'editor'
              ? -h
              : h * 0.23 - Math.min(vDepth, 20000) * 0.35;
      surfaceY += (desiredSurface - surfaceY) * (reduced ? 1 : 0.045);

      const deep = Math.min(1, vDepth / 3500);
      c.clearRect(0, 0, w, h);

      const ocean = c.createLinearGradient(0, 0, 0, h);
      ocean.addColorStop(
        0,
        `rgb(${Math.round(10 - deep * 7)},${Math.round(69 - deep * 52)},${Math.round(105 - deep * 72)})`,
      );
      ocean.addColorStop(
        1,
        `rgb(3,${Math.round(31 - deep * 22)},${Math.round(52 - deep * 30)})`,
      );
      c.fillStyle = ocean;
      c.fillRect(0, 0, w, h);

      if (mode === 'editor') {
        if (waterImg.complete && waterImg.naturalWidth) {
          c.drawImage(waterImg, 0, 0, w, h);
        }
        rect(0, 0, w, h, '#040d18a0');
      } else {
        if (surfaceY > 0) {
          const sky = c.createLinearGradient(0, 0, 0, Math.max(1, surfaceY));
          sky.addColorStop(0, '#91c9da');
          sky.addColorStop(1, '#e0f3f5');
          c.fillStyle = sky;
          c.fillRect(0, 0, w, surfaceY + 2);

          const sy = surfaceY - h * 0.5;
          rect(w * 0.79, sy + 17, 34, 31, '#f2d47c');
          rect(w * 0.79 - 3, sy + 23, 40, 20, '#f2d47c');
          rect(w * 0.79 + 6, sy + 13, 21, 40, '#f2d47c');

          cloud(
            w * 0.09 + (reduced ? 0 : Math.sin(sceneTime * 0.000015) * 5),
            sy + 26,
            1.5,
          );
          cloud(w * 0.55, sy + 21, 1);
          cloud(w * 0.39, sy + 67, 1.05);
          cloud(w * 0.88, sy + 75, 1.15);
          boat(w * 0.28, surfaceY - 4, sceneTime);

          c.beginPath();
          c.moveTo(0, surfaceY);
          for (let x = 0; x <= w + 3; x += 3) {
            c.lineTo(
              x,
              surfaceY + (reduced ? 0 : Math.sin(x * 0.05 + sceneTime * 0.0008) * 1.2),
            );
          }
          c.lineTo(w, h);
          c.lineTo(0, h);
          c.closePath();
          c.fillStyle = ocean;
          c.fill();
        }

        if (surfaceY < h * 0.4 && deep < 0.5) {
          for (let i = 0; i < 4; i++) {
            c.fillStyle = `rgba(96,180,192,${0.022 * (1 - deep)})`;
            c.beginPath();
            c.moveTo(w * (i * 0.25 + 0.1), Math.max(0, surfaceY));
            c.lineTo(w * (i * 0.25 + 0.3), h);
            c.lineTo(w * (i * 0.25 + 0.47), h);
            c.closePath();
            c.fill();
          }
        }

        for (const f of fishList) {
          const yy = (((f.y - vDepth * 0.06) % (h + 80)) + (h + 80)) % (h + 80) - 20;
          if (yy < surfaceY + 28) continue;
          let xx = (f.x * w + (reduced ? 0 : sceneTime * f.s * f.dir)) % (w + 30);
          if (xx < -15) xx += w + 30;
          fishSprite(xx, yy, f.size, f.dir, deep > 0.4 ? '#093042' : '#03283b');
        }

        if (vDepth > 800 && vDepth < 4000) {
          for (let j = 0; j < 3; j++) {
            const jy = (h * 0.4 + j * 47 - vDepth * 0.05 + h * 10) % h;
            jelly(
              w * (j % 2 ? 0.82 : 0.17),
              jy,
              sceneTime + j * 900,
              j === 1 ? '#8e6bb680' : '#59d5d066',
            );
          }
        }

        if (vDepth > 2800) {
          c.save();
          c.globalAlpha = Math.min(0.38, (vDepth - 2800) / 7000);
          if (waterImg.complete && waterImg.naturalWidth) {
            c.drawImage(waterImg, 0, 0, w, h);
          }
          c.restore();
        }

        for (const b of bubbles) {
          if (!reduced) {
            b.y -= (b.s * dt) / h;
            if (b.y < 0) b.y = 1;
          }
          const by = b.y * h;
          if (by < surfaceY + 3) continue;
          const bx = b.x * w;
          c.fillStyle = '#b2f3f039';
          if (b.r === 1) {
            c.fillRect(bx, by, 1, 1);
          } else {
            c.strokeStyle = '#9fe5f34d';
            c.strokeRect(Math.round(bx), Math.round(by), 1, 1);
          }
        }

        // Depth ruler tracks the same world coordinates as the surface
        const rx = w - Math.max(14, (w - 330) / 2);
        c.strokeStyle = '#acd9e84d';
        c.beginPath();
        c.moveTo(rx, Math.max(0, surfaceY));
        c.lineTo(rx, h - 18);
        c.stroke();
        c.font = '4px monospace';
        c.textAlign = 'right';
        for (let i = 0; i < 14; i++) {
          const step = 100;
          const first = Math.max(0, Math.floor(vDepth / step) - 3);
          const d = (first + i) * step;
          const y = surfaceY + d * 0.35;
          if (y < 0 || y > h - 18) continue;
          c.strokeStyle = '#98ccdd44';
          c.beginPath();
          c.moveTo(rx - (i % 2 ? 2 : 4), y);
          c.lineTo(rx, y);
          c.stroke();
          if (d % 200 === 0) {
            c.fillStyle = '#a1c3d17a';
            c.fillText(`${d}m`, rx - 6, y + 1);
          }
        }

        if (krillImg.complete && krillImg.naturalWidth) {
          const kx =
            mode === 'home'
              ? w * 0.53
              : w * 0.19 + (reduced ? 0 : Math.sin(sceneTime * 0.0008) * 10);
          const ky =
            mode === 'home'
              ? surfaceY + 18
              : Math.max(surfaceY + 20, h * 0.66) +
                (reduced ? 0 : Math.sin(sceneTime * 0.002) * 3);
          c.drawImage(krillImg, Math.round(kx - 11), Math.round(ky - 11), 22, 22);
          for (let i = 0; i < 5; i++) {
            const by = ky - 10 - ((sceneTime * 0.015 + i * 7) % 35);
            c.strokeStyle = '#9ee4ef88';
            c.strokeRect(
              Math.round(kx + 7 + Math.sin(i + sceneTime * 0.002) * 3),
              Math.round(by),
              1,
              1,
            );
          }
        }

        const landmark =
          vDepth < 200
            ? ''
            : vDepth < 1000
              ? 'SUNLIGHT FADES ABOVE'
              : vDepth < 4000
                ? 'THE MIDNIGHT ZONE'
                : vDepth < 6000
                  ? 'THE ABYSSAL ZONE'
                  : 'THE HADAL ZONE';
        if (mode === 'play' && landmark) {
          c.textAlign = 'left';
          c.font = '4px monospace';
          c.fillStyle = '#c1d7e04f';
          c.fillText(landmark, 12, h * 0.5);
        }

        const vignette = c.createLinearGradient(0, h * 0.73, 0, h);
        vignette.addColorStop(0, '#030b1700');
        vignette.addColorStop(1, '#030b17ec');
        c.fillStyle = vignette;
        c.fillRect(0, h * 0.73, w, h * 0.27);
      }

      rafId = requestAnimationFrame(frame);
    };

    rafId = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener('resize', resize);
    };
  }, [depthElementRef]);

  return (
    <canvas
      ref={canvasRef}
      id="ocean"
      aria-hidden="true"
      className="fixed inset-0 w-full h-full z-0 pointer-events-none [image-rendering:pixelated]"
    />
  );
}
