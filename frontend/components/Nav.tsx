"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import ThemeToggle from "./ThemeToggle";

const LINKS = [
  { href: "/", label: "Mission" },
  { href: "/simulation", label: "Simulation" },
  { href: "/counterfactual", label: "EVA Decision" },
  { href: "/debate", label: "Debate Chamber" },
  { href: "/evidence", label: "Evidence Graph" },
  { href: "/genetics", label: "Genetics" },
  { href: "/research-navigator", label: "Research Navigator" },
] as const;

export default function Nav() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-20 border-b border-[var(--border)] bg-[var(--background)]/90 backdrop-blur">
      <div className="hidden border-b border-[var(--border)] bg-[var(--background-soft)] sm:block">
        <div className="mono-tag mx-auto flex max-w-6xl items-center justify-between px-6 py-1">
          <span>
            MISSION <span className="text-[var(--accent-strong)]">ARES-180</span> · MARS TRANSIT · CREW 4
          </span>
          <span className="flex items-center gap-1.5">
            <span
              aria-hidden
              className="inline-block h-1.5 w-1.5 rounded-full"
              style={{ background: "var(--tone-emerald)", boxShadow: "0 0 5px 1px color-mix(in srgb, var(--tone-emerald) 80%, transparent)" }}
            />
            SIMULATION LIVE
          </span>
        </div>
      </div>
      <nav className="mx-auto flex max-w-6xl flex-wrap items-center gap-1 px-6 py-3">
        <Link href="/" className="mr-4 flex items-center gap-2 text-sm font-semibold tracking-wide">
          <span
            aria-hidden
            className="inline-block h-2.5 w-2.5 rounded-full"
            style={{
              background: "var(--accent-strong)",
              boxShadow: "0 0 12px 2px var(--accent)",
            }}
          />
          <span className="bg-gradient-to-r from-[var(--accent-strong)] to-[var(--foreground)] bg-clip-text text-transparent">
            BEYOND HORIZONS
          </span>
        </Link>
        {LINKS.map((link) => {
          const active = pathname === link.href || (link.href !== "/" && pathname.startsWith(link.href));
          return (
            <Link
              key={link.href}
              href={link.href}
              className={`rounded-md px-3 py-1.5 text-sm transition-colors ${
                active
                  ? "bg-[var(--accent-soft)] text-[var(--accent-strong)] font-medium"
                  : "text-[var(--muted)] hover:bg-[var(--accent-soft)] hover:text-[var(--foreground)]"
              }`}
            >
              {link.label}
            </Link>
          );
        })}
        <div className="ml-auto flex items-center gap-2">
          <ThemeToggle />
        </div>
      </nav>
    </header>
  );
}
