"use client";
import React, { useEffect, useRef, useState } from "react";

/**
 * A number that counts to its new value (2026-10-31): a rating that moves
 * after a result rolls from the old figure to the new one over ~0.6s instead
 * of snapping, so the change is seen rather than missed. The first render
 * shows the value as it is — nothing counts up from zero on opening a
 * screen — and under reduced motion it always just changes.
 *
 * Whole numbers only. A value that isn't one (a "7.4", a "—") is shown as
 * given; the rating column's decimals are a tie-breaking display, not a
 * quantity to animate.
 */
export function CountUp({ value, duration = 600 }: { value: number | string | null | undefined; duration?: number }) {
  const n = typeof value === "number" ? value : typeof value === "string" && /^-?\d+$/.test(value) ? Number(value) : null;
  const [shown, setShown] = useState<number | null>(n);
  const from = useRef<number | null>(n);
  useEffect(() => {
    if (n == null) { from.current = null; setShown(null); return; }
    const start = from.current;
    from.current = n;
    const reduce = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (start == null || start === n || reduce) { setShown(n); return; }
    let raf = 0;
    const t0 = performance.now();
    const tick = (t: number) => {
      const k = Math.min(1, (t - t0) / duration);
      const eased = 1 - Math.pow(1 - k, 3);
      setShown(Math.round(start + (n - start) * eased));
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [n, duration]);
  if (n == null) return <>{value ?? null}</>;
  return <>{shown ?? n}</>;
}
