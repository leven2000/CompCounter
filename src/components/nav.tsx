"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function NavLink({
  href,
  exact = false,
  children,
  variant = "top",
}: {
  href: string;
  exact?: boolean;
  children: React.ReactNode;
  variant?: "top" | "tab";
}) {
  const pathname = usePathname();
  const active = exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
  if (variant === "tab") {
    return (
      <Link
        href={href}
        className={`border-b-2 px-1 pb-3 text-sm font-medium whitespace-nowrap ${
          active ? "border-brand text-slate-900" : "border-transparent text-slate-500 hover:text-slate-800"
        }`}
      >
        {children}
      </Link>
    );
  }
  return (
    <Link
      href={href}
      className={`rounded-md px-3 py-1.5 text-sm font-medium whitespace-nowrap ${
        active ? "bg-slate-100 text-slate-900" : "text-slate-500 hover:text-slate-900"
      }`}
    >
      {children}
    </Link>
  );
}
