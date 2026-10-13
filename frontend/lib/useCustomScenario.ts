"use client";

import { useEffect, useState } from "react";
import { clearCustomScenario, loadCustomScenario, onCustomScenarioChange, type CustomScenario } from "@/lib/scenarioStore";

/**
 * Client-only hook that reads the last customized simulation scenario (see
 * lib/scenarioStore.ts) and keeps re-rendering in sync if it changes --
 * including when another open tab runs a new customized simulation.
 */
export function useCustomScenario(): {
  scenario: CustomScenario | null;
  reset: () => void;
} {
  const [scenario, setScenario] = useState<CustomScenario | null>(null);

  useEffect(() => {
    setScenario(loadCustomScenario());
    return onCustomScenarioChange(() => setScenario(loadCustomScenario()));
  }, []);

  return {
    scenario,
    reset: () => {
      clearCustomScenario();
      setScenario(null);
    },
  };
}
