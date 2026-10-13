"use client";

import { useEffect, useState } from "react";
import { loadVitalsHistory, onVitalsHistoryChange, type VitalsHistoryRecord } from "@/lib/vitalsStore";

/** Client-only hook mirroring lib/useCustomScenario.ts for vitals history. */
export function useVitalsHistory(): VitalsHistoryRecord[] {
  const [history, setHistory] = useState<VitalsHistoryRecord[]>([]);

  useEffect(() => {
    setHistory(loadVitalsHistory());
    return onVitalsHistoryChange(() => setHistory(loadVitalsHistory()));
  }, []);

  return history;
}
