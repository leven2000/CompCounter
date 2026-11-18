import type { AccessLink } from "@/lib/access-links";
import { CopyButton } from "./ui";

export function AccessCard({ link, desktop = false }: { link: AccessLink; desktop?: boolean }) {
  if (desktop) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold">{link.title}</p>
          <p className="text-xs text-slate-500">{link.hint}</p>
        </div>
        <a href={link.url} target="_blank" rel="noreferrer" className="btn btn-sm shrink-0">
          Abrir ventana
        </a>
      </div>
    );
  }
  return (
    <div className="flex gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
      {link.qr && (
        <div
          className="h-24 w-24 shrink-0 overflow-hidden rounded bg-white p-1 [&>svg]:h-full [&>svg]:w-full"
          dangerouslySetInnerHTML={{ __html: link.qr }}
        />
      )}
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold">{link.title}</p>
        <p className="text-xs text-slate-500">{link.hint}</p>
        {link.code && <p className="mt-1 font-mono text-xl font-bold tracking-[0.2em]">{link.code}</p>}
        <div className="mt-2 flex flex-wrap gap-2">
          <a href={link.url} target="_blank" rel="noreferrer" className="btn btn-sm">
            Abrir ↗
          </a>
          <CopyButton text={link.url} label="Copiar link" />
        </div>
      </div>
    </div>
  );
}
