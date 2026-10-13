/**
 * Mandatory disclaimer banners. Text is always passed in from the API
 * response (app/core/notices.py on the backend) -- never hardcoded here --
 * so the wording can never drift from the single source of truth.
 *
 * Colors are theme-aware CSS variables (see globals.css) rather than fixed
 * Tailwind shades, so they stay legible on both the dark "deep space" theme
 * and the light "daylight observatory" theme (components/ThemeToggle.tsx).
 */
function toneStyle(tone: string) {
  return {
    borderColor: `color-mix(in srgb, ${tone} 35%, transparent)`,
    background: `color-mix(in srgb, ${tone} 10%, transparent)`,
    color: tone,
  };
}

export function SyntheticDataBanner({ text }: { text: string }) {
  return (
    <p role="note" className="rounded-lg border px-4 py-2.5 text-sm" style={toneStyle("var(--amber)")}>
      <strong className="font-semibold">Synthetic data.</strong> {text}
    </p>
  );
}

export function DisclaimerBanner({ text }: { text: string }) {
  return (
    <p role="note" className="rounded-lg border px-4 py-2.5 text-sm" style={toneStyle("var(--tone-sky)")}>
      <strong className="font-semibold">Exploratory, not clinical.</strong> {text}
    </p>
  );
}

export function LanguageNoteBanner({ text }: { text: string }) {
  return (
    <p role="note" className="rounded-lg border px-4 py-2.5 text-sm" style={toneStyle("var(--tone-violet)")}>
      {text}
    </p>
  );
}

export function ErrorBanner({ message }: { message: string }) {
  return (
    <div role="alert" className="rounded-lg border px-4 py-3 text-sm" style={toneStyle("var(--danger)")}>
      <strong className="font-semibold">Could not load data.</strong>{" "}
      <span className="font-mono text-xs">{message}</span>
    </div>
  );
}

/**
 * Small badge used on every AI-generated scenario illustration. Keeps the
 * project's "nothing is presented as real unless it is" rule visible on the
 * image itself, not just in a figure caption that could be cropped out.
 */
export function ScenarioCaption({ text = "Synthetic illustration — AI-generated concept art, not a real photograph" }: { text?: string }) {
  return <span className="scenario-caption">{text}</span>;
}

/**
 * Shown on the Mission and Genetics pages when they are displaying a
 * customized crew/mission (from the last simulation the person ran on the
 * Simulation page, see lib/scenarioStore.ts) instead of the Ares-180
 * defaults -- so it's never ambiguous which numbers are on screen.
 */
export function CustomScenarioBanner({ savedAt, onReset }: { savedAt: string; onReset: () => void }) {
  const when = new Date(savedAt).toLocaleString();
  return (
    <div
      role="note"
      className="flex flex-wrap items-center justify-between gap-3 rounded-lg border px-4 py-2.5 text-sm"
      style={toneStyle("var(--tone-violet)")}
    >
      <span>
        Showing the <strong className="font-semibold">customized</strong> crew/mission from the
        simulation you ran at {when}, not the Ares-180 defaults.
      </span>
      <button type="button" onClick={onReset} className="btn-ghost shrink-0 !px-3 !py-1 text-xs">
        Reset to default
      </button>
    </div>
  );
}
