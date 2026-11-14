"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { hashPassword, requireSuperadmin, setActingOrg } from "@/lib/auth";
import { newCode, slugify, str } from "@/lib/util";

const back = (kind: "error" | "ok", message: string): never =>
  redirect(`/admin?${kind}=${encodeURIComponent(message)}`);

export async function createOrganizer(formData: FormData) {
  await requireSuperadmin();
  const orgName = str(formData, "orgName");
  const name = str(formData, "name");
  const email = str(formData, "email").toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (!orgName || !name || !email) back("error", "Completá organización, nombre y email");
  if (password.length < 8) back("error", "La contraseña inicial necesita 8 caracteres o más");
  if (await db.user.findUnique({ where: { email } })) back("error", "Ya existe una cuenta con ese email");

  let slug = slugify(orgName);
  if (await db.organization.findUnique({ where: { slug } })) {
    slug = `${slug}-${newCode(4).toLowerCase()}`;
  }

  await db.organization.create({
    data: {
      name: orgName,
      slug,
      users: {
        create: { email, name, role: "ORGANIZER", passwordHash: await hashPassword(password) },
      },
    },
  });
  back("ok", `Organizador creado: ${email}`);
}

export async function setUserActive(formData: FormData) {
  await requireSuperadmin();
  const id = str(formData, "userId");
  const active = str(formData, "active") === "1";
  await db.user.updateMany({ where: { id, role: "ORGANIZER" }, data: { active } });
  refresh();
}

export async function resetPassword(formData: FormData) {
  await requireSuperadmin();
  const id = str(formData, "userId");
  const password = String(formData.get("password") ?? "");
  if (password.length < 8) back("error", "La contraseña necesita 8 caracteres o más");
  await db.user.updateMany({
    where: { id, role: "ORGANIZER" },
    data: { passwordHash: await hashPassword(password) },
  });
  back("ok", "Contraseña actualizada");
}

export async function deleteOrganization(formData: FormData) {
  await requireSuperadmin();
  await db.organization.deleteMany({ where: { id: str(formData, "orgId") } });
  back("ok", "Organización eliminada");
}

export async function enterOrganization(formData: FormData) {
  await requireSuperadmin();
  const org = await db.organization.findUnique({
    where: { id: str(formData, "orgId") },
    select: { id: true },
  });
  if (!org) redirect("/admin");
  await setActingOrg(org.id);
  redirect("/panel");
}

export async function leaveOrganization() {
  await requireSuperadmin();
  await setActingOrg(null);
  redirect("/admin");
}
