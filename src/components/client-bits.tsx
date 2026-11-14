"use client";

import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

export function LocalTime({ iso, mode = "datetime" }: { iso: string; mode?: "datetime" | "time" }) {
  const text = useSyncExternalStore(
    subscribe,
    () =>
      new Intl.DateTimeFormat(
        "es-AR",
        mode === "time" ? { timeStyle: "medium" } : { dateStyle: "short", timeStyle: "short" },
      ).format(new Date(iso)),
    () => "",
  );
  return <time dateTime={iso}>{text}</time>;
}

export function PrintButton() {
  return (
    <button type="button" className="btn btn-sm print:hidden" onClick={() => window.print()}>
      Imprimir
    </button>
  );
}
