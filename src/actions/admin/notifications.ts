"use server";

import { refresh } from "next/cache";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { dispatchNotifications } from "@/lib/notifications";

export async function sendQueuedNow(): Promise<{ ok: boolean; message: string }> {
  await requirePermission("orders");
  const r = await dispatchNotifications(200);
  refresh();
  if (r.waiting) return { ok: false, message: `${r.waiting} message(s) waiting — no SMS provider is configured yet.` };
  return { ok: true, message: `${r.sent} sent${r.failed ? `, ${r.failed} failed` : ""}.` };
}

export async function retryNotification(id: string): Promise<{ ok: boolean }> {
  await requirePermission("orders");
  await db.notification.updateMany({ where: { id, status: "FAILED" }, data: { status: "QUEUED", attempts: 0, error: null } });
  refresh();
  return { ok: true };
}
