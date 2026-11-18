"use client";

import { useEffect, useState } from "react";
import type { ControllerState } from "@/types/desktop";

export function useControllers() {
  const [state, setState] = useState<ControllerState | null>(null);

  useEffect(() => {
    const api = window.compcounterDesktop?.controllers;
    if (!api) return;
    let alive = true;
    void api.get().then((value) => {
      if (alive && value) setState(value);
    });
    const stop = api.subscribe(setState);
    return () => {
      alive = false;
      stop();
    };
  }, []);

  return state;
}
