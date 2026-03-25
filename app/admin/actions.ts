"use server";

import { redirect } from "next/navigation";

import {
  clearAdminSession,
  createAdminSession,
  verifyAdminPassword,
} from "@/lib/auth";

export type LoginState = {
  error: string | null;
};

export async function loginAction(
  _previousState: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const password = String(formData.get("password") ?? "");

  if (!verifyAdminPassword(password)) {
    return { error: "Incorrect password. Double-check the shared admin key." };
  }

  await createAdminSession();
  redirect("/admin/tournaments");
}

export async function logoutAction() {
  await clearAdminSession();
  redirect("/admin/login");
}
