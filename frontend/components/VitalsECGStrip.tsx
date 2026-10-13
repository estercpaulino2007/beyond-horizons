/**
 * Decorative animated waveform for the HUD console header. Explicitly
 * labelled as illustrative: this app has no ECG sensor anywhere (see
 * app/domain/vitals_reference.py's heart_rhythm handling), so this is a
 * stylized heartbeat-shaped line, not a real electrical trace, and it does
 * not change shape based on any entered value -- it would be dishonest to
 * make it look data-driven when it isn't.
 */
const BEAT = "M0 40 L60 40 L75 10 L90 70 L105 20 L120 40 L300 40 L315 10 L330 70 L345 20 L360 40 L600 40";

export default function VitalsECGStrip({ color = "#6fe3a3" }: { color?: string }) {
  return (
    <svg viewBox="0 0 600 80" preserveAspectRatio="none" className="h-10 w-full opacity-80" aria-hidden="true">
      <path d={BEAT} fill="none" stroke={color} strokeWidth={1.6} strokeLinejoin="round" strokeLinecap="round" className="vitals-ecg-line" opacity={0.9} />
      <path d={BEAT} fill="none" stroke={color} strokeWidth={5} strokeLinejoin="round" strokeLinecap="round" opacity={0.08} />
    </svg>
  );
}
