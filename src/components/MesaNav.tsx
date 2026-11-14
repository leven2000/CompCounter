"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function MesaNav({ code }: { code: string }) {
  const pathname = usePathname();
  const base = `/mesa/${code}`;
  const items = [
    { href: base, label: "Control" },
    { href: `${base}/llaves`, label: "Llaves" },
    { href: `${base}/competidores`, label: "Competidores" },
    { href: `${base}/pantallas`, label: "Pantallas" },
  ];
  return (
    <nav className="flex flex-wrap items-center gap-1">
      {items.map((item) => {
        const active = pathname === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`rounded-md px-3 py-1.5 text-sm font-medium whitespace-nowrap ${
              active ? "bg-white text-slate-900" : "text-white/75 hover:bg-white/10 hover:text-white"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
