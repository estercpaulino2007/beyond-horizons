"use client";

import { useEffect, useRef } from "react";

/**
 * Three fixed, full-viewport star layers behind the whole app (not just the
 * hero banners), each drifting at a different rate as the page scrolls --
 * the classic layered parallax "things move as you scroll" effect. Pure
 * background-position offsets on a repeating dot pattern, so there's no
 * wrap-around seam to manage and no canvas redraw cost.
 *
 * Sits behind body's own background the same way body::before's grid does
 * (globals.css); fades with --star-opacity, which is already tuned low for
 * the light theme, so it stays subtle rather than noisy there. Switched off
 * under prefers-reduced-motion (layers still render, just don't move).
 */
export default function GlobalStarfield() {
  const farRef = useRef<HTMLDivElement>(null);
  const midRef = useRef<HTMLDivElement>(null);
  const nearRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduceMotion) return;

    let frame = 0;
    function onScroll() {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        const y = window.scrollY;
        if (farRef.current) farRef.current.style.backgroundPositionY = `${y * 0.04}px`;
        if (midRef.current) midRef.current.style.backgroundPositionY = `${y * 0.1}px`;
        if (nearRef.current) nearRef.current.style.backgroundPositionY = `${y * 0.18}px`;
      });
    }
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <>
      <div ref={farRef} className="global-starfield global-starfield-far" aria-hidden="true" />
      <div ref={midRef} className="global-starfield global-starfield-mid" aria-hidden="true" />
      <div ref={nearRef} className="global-starfield global-starfield-near" aria-hidden="true" />
    </>
  );
}
