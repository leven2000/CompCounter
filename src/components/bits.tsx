/* eslint-disable @next/next/no-img-element */
import type { Brand } from "@/lib/brand";

export function Flag({ code, className = "h-4 w-6" }: { code: string | null; className?: string }) {
  if (!code) return null;
  return (
    <img
      src={`/flags/${code.toLowerCase()}.svg`}
      alt={code}
      className={`inline-block shrink-0 rounded-[2px] object-cover shadow-sm ${className}`}
    />
  );
}

export function BrandLogo({ brand, className = "h-9" }: { brand: Brand; className?: string }) {
  if (brand.logoUrl) {
    return <img src={brand.logoUrl} alt={brand.name} className={`w-auto object-contain ${className}`} />;
  }
  const initials = brand.name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
  return (
    <span
      className={`inline-flex aspect-square items-center justify-center rounded-lg bg-brand font-bold text-white ${className}`}
    >
      {initials || "•"}
    </span>
  );
}

export function Notice({ sp }: { sp: Record<string, string | string[] | undefined> }) {
  const error = typeof sp.error === "string" ? sp.error : null;
  const ok = typeof sp.ok === "string" ? sp.ok : null;
  if (!error && !ok) return null;
  return (
    <div
      className={`mb-4 rounded-lg border px-4 py-3 text-sm ${
        error
          ? "border-red-200 bg-red-50 text-red-800"
          : "border-emerald-200 bg-emerald-50 text-emerald-800"
      }`}
      role="status"
    >
      {error ?? ok}
    </div>
  );
}

export function Avatar({
  id,
  version,
  className = "h-7 w-7",
}: {
  id: string;
  version: number;
  className?: string;
}) {
  if (version <= 0) return null;
  return (
    <img
      src={`/api/photo/${id}?v=${version}`}
      alt=""
      className={`shrink-0 rounded-full object-cover ${className}`}
    />
  );
}
