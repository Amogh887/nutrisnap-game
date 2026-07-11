import { useMemo } from "react";
import { usePrefersReducedMotion } from "../motion";

const COLORS = ["#f58529", "#dd2a7b", "#8134af", "#f7a34c", "#b64bc6", "#ffffff"];

function noise(seed) {
  const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

export default function Confetti({ active, pieceCount = 90 }) {
  const reduced = usePrefersReducedMotion();

  const pieces = useMemo(() => {
    if (!active || reduced) return [];
    return Array.from({ length: pieceCount }, (_, i) => {
      const r1 = noise(i + 1);
      const r2 = noise(i + 2.7);
      const r3 = noise(i + 5.3);
      const r4 = noise(i + 9.1);
      const angle = r1 * Math.PI * 2;
      const distance = 90 + r2 * 240;
      return {
        tx: `${Math.cos(angle) * distance}px`,
        ty: `${Math.sin(angle) * distance + 280}px`,
        rot: `${r3 * 720 - 360}deg`,
        delay: `${r4 * 0.15}s`,
        duration: `${1 + r2 * 0.8}s`,
        size: 7 + Math.round(r3 * 7),
        color: COLORS[Math.floor(r4 * COLORS.length) % COLORS.length],
        round: r1 > 0.5,
      };
    });
  }, [active, reduced, pieceCount]);

  if (!active || reduced || pieces.length === 0) return null;

  return (
    <div className="confetti-layer" aria-hidden="true">
      {pieces.map((p, i) => (
        <span
          key={i}
          className="confetti-piece"
          style={{
            "--tx": p.tx,
            "--ty": p.ty,
            "--rot": p.rot,
            width: `${p.size}px`,
            height: `${p.size}px`,
            background: p.color,
            borderRadius: p.round ? "50%" : "3px",
            animationDelay: p.delay,
            animationDuration: p.duration,
          }}
        />
      ))}
    </div>
  );
}
