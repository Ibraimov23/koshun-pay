"use client";

import { useEffect, useRef, useState } from "react";

function clamp01(x: number) {
  if (x < 0) return 0;
  if (x > 1) return 1;
  return x;
}

export function AnimatedNumber({ value, decimals = 2 }: { value: number; decimals?: number }) {
  const [v, setV] = useState(0);
  const ref = useRef(0);

  useEffect(() => {
    const from = ref.current;
    const to = value;
    const start = performance.now();
    const dur = 900;
    let raf = 0;

    const tick = (t: number) => {
      const p = clamp01((t - start) / dur);
      const eased = 1 - Math.pow(1 - p, 3);
      const next = from + (to - from) * eased;
      ref.current = next;
      setV(next);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value]);

  return <span>{v.toLocaleString(undefined, { maximumFractionDigits: decimals })}</span>;
}

