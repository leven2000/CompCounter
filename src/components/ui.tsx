"use client";

import { useState, type ReactNode } from "react";
import { useFormStatus } from "react-dom";

export function SubmitButton({
  children,
  className = "btn btn-primary",
  confirm,
}: {
  children: ReactNode;
  className?: string;
  confirm?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      className={className}
      disabled={pending}
      onClick={(e) => {
        if (confirm && !window.confirm(confirm)) e.preventDefault();
      }}
    >
      {pending ? "Guardando…" : children}
    </button>
  );
}

export function CopyButton({ text, label = "Copiar" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className="btn btn-sm"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        } catch {}
      }}
    >
      {copied ? "Copiado" : label}
    </button>
  );
}

export function AutoSubmitSelect({
  name,
  defaultValue,
  children,
  className = "input",
}: {
  name: string;
  defaultValue: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <select
      name={name}
      defaultValue={defaultValue}
      className={className}
      onChange={(e) => e.currentTarget.form?.requestSubmit()}
    >
      {children}
    </select>
  );
}
