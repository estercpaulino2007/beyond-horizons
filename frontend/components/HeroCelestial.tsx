"use client";

import { useEffect, useRef, useState } from "react";
import RealisticCelestialBody from "./RealisticCelestialBody";

/**
 * Positions a RealisticCelestialBody inside a hero section and gives it a
 * gentle scroll parallax -- it drifts at a different rate than the page
 * content as the visitor scrolls past, the classic layered "things move as
 * you scroll" space effect. Pure translateY, cheap, and switched off under
 * prefers-reduced-motion (the body still renders, just stationary).
 */
export default function HeroCelestial({
  textureSrc,
  size,
  glowColor,
  top,
  right,
  parallaxSpeed = 0.12,
}: {
  textureSrc: string;
  size: number;
  glowColor: string;
  top: string;
  right: string;
  parallaxSpeed?: number;
}) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [offset, setOffset] = useState(0);

  useEffect(() => {
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduceMotion) return;

    let frame = 0;
    function onScroll() {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        const el = wrapperRef.current;
        if (!el) return;
        const rect = el.getBoundingClientRect();
        // Distance of the element's center from the viewport's vertical
        // center, scaled down -- drifts a few tens of pixels either way as
        // the hero scrolls through view, not a full-page parallax track.
        const viewportCenter = window.innerHeight / 2;
        const elCenter = rect.top + rect.height / 2;
        setOffset((elCenter - viewportCenter) * parallaxSpeed);
      });
    }
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(frame);
    };
  }, [parallaxSpeed]);

  return (
    <div
      ref={wrapperRef}
      className="celestial"
      aria-hidden="true"
      style={{ top, right, transform: `translateY(${offset}px)`, willChange: "transform" }}
    >
      <RealisticCelestialBody textureSrc={textureSrc} size={size} glowColor={glowColor} />
    </div>
  );
}
