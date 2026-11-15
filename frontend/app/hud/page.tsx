import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "3D Health HUD · Beyond Horizons",
  description: "Holographic astronaut body scan linked to the Beyond Horizons health-monitoring API.",
};

// The HUD is a standalone three.js page in public/hud3d/. Embedding it on the
// same origin means it reads/writes the same localStorage keys as /vitals
// (beyond-horizons:vitals-history), so both share one history.
export default function HudPage() {
  return (
    <main className="w-full" style={{ height: "calc(100vh - 92px)" }}>
      <iframe
        src="/hud3d/index.html"
        title="Beyond Horizons 3D Health HUD"
        className="h-full w-full border-0"
        allow="fullscreen"
        allowFullScreen
      />
    </main>
  );
}
