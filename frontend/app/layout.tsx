import type { Metadata } from "next";
import AssistantWidget from "@/components/AssistantWidget";
import GlobalStarfield from "@/components/GlobalStarfield";
import Nav from "@/components/Nav";
import "./globals.css";

export const metadata: Metadata = {
  title: "Beyond Horizons",
  description:
    "Explainable crew digital twin for exploratory space-health simulation. Synthetic data; not medical advice.",
};

// Runs before paint, on the server-rendered HTML, so the chosen theme (or the
// OS preference on first visit) applies with no flash of the wrong theme.
// Kept tiny and inline on purpose -- it must run before React hydrates.
const THEME_INIT_SCRIPT = `
(function () {
  try {
    var stored = localStorage.getItem("beyond-horizons-theme");
    var theme = stored === "light" || stored === "dark"
      ? stored
      : (window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark");
    document.documentElement.setAttribute("data-theme", theme);
  } catch (e) {
    document.documentElement.setAttribute("data-theme", "dark");
  }
})();
`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased" suppressHydrationWarning>
      <head>
        {/* eslint-disable-next-line @next/next/no-sync-scripts */}
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="min-h-full flex flex-col">
        <GlobalStarfield />
        <Nav />
        {children}
        <footer className="mx-auto w-full max-w-6xl px-6 py-8 text-xs text-[var(--faint)]">
          Beyond Horizons — NASA Space Apps Challenge, &quot;Create Health Monitoring Software for
          Astronauts on Space Missions&quot;. Educational and research demonstration only.
        </footer>
        <AssistantWidget />
      </body>
    </html>
  );
}
