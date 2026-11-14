"use server";

import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { endSession, startSession, verifyPassword } from "@/lib/auth";
import { resolveCode } from "@/lib/access";
import { str } from "@/lib/util";

export async function login(formData: FormData) {
  const email = str(formData, "email").toLowerCase();
  const password = String(formData.get("password") ?? "");
  const user = email ? await db.user.findUnique({ where: { email } }) : null;
  const valid = !!user && user.active && (await verifyPassword(password, user.passwordHash));
  if (!user || !valid) {
    redirect(`/login?error=${encodeURIComponent("Email o contraseña incorrectos")}`);
  }
  await startSession(user.id);
  redirect(user.role === "SUPERADMIN" ? "/admin" : "/panel");
}

export async function logout() {
  await endSession();
  redirect("/login");
}

export async function enterCode(formData: FormData) {
  const access = await resolveCode(str(formData, "code"));
  if (!access) {
    redirect(`/codigo?error=${encodeURIComponent("Ese código no existe o ya venció")}`);
  }
  redirect(access.role === "TABLE" ? `/mesa/${access.code}` : `/juez/${access.code}`);
}
