/**
 * Decorative mission-console corner brackets + scanline wash, layered over
 * every hero-backdrop section. Purely cosmetic (aria-hidden) — see the
 * .hero-frame rules in globals.css.
 */
export default function HudFrame() {
  return (
    <div className="hero-frame" aria-hidden="true">
      <span />
      <span />
      <span />
    </div>
  );
}
