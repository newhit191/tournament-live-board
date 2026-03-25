import { createHmac, timingSafeEqual } from "node:crypto";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

const ADMIN_COOKIE_NAME = "tlb-admin-session";
const SESSION_SCOPE = "tournament-live-board-admin";

function getAdminPassword() {
  return process.env.ADMIN_PASSWORD?.trim() ?? "";
}

function getSessionToken() {
  return createHmac("sha256", getAdminPassword() || "demo-mode")
    .update(SESSION_SCOPE)
    .digest("hex");
}

export function isAdminPasswordConfigured() {
  return getAdminPassword().length > 0;
}

export function verifyAdminPassword(candidate: string) {
  const configuredPassword = getAdminPassword();

  if (!configuredPassword) {
    return true;
  }

  const left = Buffer.from(candidate);
  const right = Buffer.from(configuredPassword);

  if (left.length !== right.length) {
    return false;
  }

  return timingSafeEqual(left, right);
}

export async function createAdminSession() {
  const cookieStore = await cookies();

  cookieStore.set(ADMIN_COOKIE_NAME, getSessionToken(), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 8,
  });
}

export async function clearAdminSession() {
  const cookieStore = await cookies();
  cookieStore.delete(ADMIN_COOKIE_NAME);
}

export async function isAdminAuthenticated() {
  if (!isAdminPasswordConfigured()) {
    return true;
  }

  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_COOKIE_NAME)?.value;

  if (!token) {
    return false;
  }

  const current = Buffer.from(token);
  const expected = Buffer.from(getSessionToken());

  if (current.length !== expected.length) {
    return false;
  }

  return timingSafeEqual(current, expected);
}

export async function requireAdminSession() {
  if (!(await isAdminAuthenticated())) {
    redirect("/admin/login");
  }
}
