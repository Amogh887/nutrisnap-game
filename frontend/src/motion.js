import { useState, useEffect } from "react";

export function usePrefersReducedMotion() {
  const query = "(prefers-reduced-motion: reduce)";
  const [reduced, setReduced] = useState(() => {
    if (typeof window === "undefined" || !window.matchMedia) return false;
    return window.matchMedia(query).matches;
  });

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mql = window.matchMedia(query);
    const handler = (event) => setReduced(event.matches);
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, []);

  return reduced;
}

export function useCountUp(target, { duration = 850, active = true } = {}) {
  const reduced = usePrefersReducedMotion();
  const numericTarget = Number(target) || 0;
  const [value, setValue] = useState(reduced || !active ? numericTarget : 0);

  useEffect(() => {
    if (!active || reduced) {
      const instant = requestAnimationFrame(() => setValue(numericTarget));
      return () => cancelAnimationFrame(instant);
    }

    let frame = null;
    let start = null;
    const step = (timestamp) => {
      if (start === null) start = timestamp;
      const progress = Math.min((timestamp - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.round(eased * numericTarget));
      if (progress < 1) {
        frame = requestAnimationFrame(step);
      }
    };

    frame = requestAnimationFrame(step);
    return () => {
      if (frame) cancelAnimationFrame(frame);
    };
  }, [numericTarget, duration, active, reduced]);

  return value;
}
