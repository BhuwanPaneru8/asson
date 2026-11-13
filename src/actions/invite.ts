"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { createSession } from "@/lib/auth";
import { acceptInvite, TeamError } from "@/lib/team";
import { rateLimit } from "@/lib/rate-limit";
import { headers } from "next/headers";
import { clientIp } from "@/lib/client-ip";

const schema = z.object({
  token: z.string().min(20).max(80),
  password: z.string().min(8, "Use at least 8 characters").max(128).regex(/[A-Za-z]/, "Include a letter").regex(/\d/, "Include a number"),
  confirm: z.string(),
}).refine((d) => d.password === d.confirm, { message: "The two passwords don't match", path: ["confirm"] });

/** A new team member sets their password from the owner's invite link, then lands in the staff area. */
export async function setPasswordFromInvite(input: z.input<typeof schema>): Promise<{ ok: false; error: string }> {
  if (!rateLimit(`invite:${clientIp(await headers())}`, 10, 15 * 60_000)) return { ok: false, error: "Too many tries. Wait a few minutes." };
  const p = schema.safeParse(input);
  if (!p.success) return { ok: false, error: p.error.issues[0]?.message ?? "Check your password." };
  let user: { id: string; role: Parameters<typeof createSession>[0]["role"]; tokenVersion: number };
  try {
    user = await db.$transaction((tx) => acceptInvite(tx, p.data.token, p.data.password));
  } catch (e) {
    if (e instanceof TeamError) return { ok: false, error: e.message };
    throw e;
  }
  await createSession(user);
  redirect("/admin");
}
