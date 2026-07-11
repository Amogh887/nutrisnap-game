import { usePrefersReducedMotion } from "../motion";

const INK = "#16161a";
const ACCENT = "#dd2a7b";

export default function Mascot({ pose = "happy", size = 112, animate = false, title }) {
  const reduced = usePrefersReducedMotion();
  const isCheer = pose === "cheer";
  const isWave = pose === "wave";

  const svgProps = title
    ? { role: "img", "aria-label": title }
    : { "aria-hidden": "true", focusable: "false" };

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 120 128"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      stroke={INK}
      strokeWidth="3.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{
        animation: animate && !reduced ? "mascotBob 3s ease-in-out infinite" : "none",
        overflow: "visible",
      }}
      {...svgProps}
    >
      {title ? <title>{title}</title> : null}

      {isCheer && (
        <>
          <path d="M40 76 Q28 60 32 46" />
          <path d="M80 76 Q92 60 88 46" />
          <path d="M30 42 l0 -7 M26.5 45.5 l-6 0 M33.5 45.5 l6 0" stroke={ACCENT} strokeWidth="2.6" />
          <path d="M90 42 l0 -7 M86.5 45.5 l-6 0 M93.5 45.5 l6 0" stroke={ACCENT} strokeWidth="2.6" />
        </>
      )}
      {isWave && (
        <>
          <path d="M82 76 Q98 66 98 48" />
          <path d="M104 44 l0 -6 M100.5 47 l-6 0 M107.5 47 l6 0" stroke={ACCENT} strokeWidth="2.6" />
        </>
      )}

      <circle cx="44" cy="34" r="11" fill="#ffffff" />
      <circle cx="60" cy="28" r="13" fill="#ffffff" />
      <circle cx="76" cy="34" r="11" fill="#ffffff" />
      <rect x="36" y="40" width="48" height="15" rx="6" fill="#ffffff" />

      <path d="M32 70 a28 28 0 0 1 56 0 v6 a28 28 0 0 1 -56 0 z" fill="#ffffff" />

      {isCheer || isWave ? (
        <>
          <path d="M46 71 Q51 66 56 71" />
          {isWave ? (
            <circle cx="71" cy="71" r="2.6" fill={INK} stroke="none" />
          ) : (
            <path d="M64 71 Q69 66 74 71" />
          )}
        </>
      ) : (
        <>
          <circle cx="51" cy="71" r="2.8" fill={INK} stroke="none" />
          <circle cx="69" cy="71" r="2.8" fill={INK} stroke="none" />
        </>
      )}

      <circle cx="43" cy="82" r="3.4" fill={ACCENT} stroke="none" opacity="0.55" />
      <circle cx="77" cy="82" r="3.4" fill={ACCENT} stroke="none" opacity="0.55" />

      {isCheer ? (
        <path d="M50 82 Q60 94 70 82" fill={ACCENT} opacity="0.15" stroke={INK} />
      ) : (
        <path d="M51 82 Q60 90 69 82" />
      )}
    </svg>
  );
}
