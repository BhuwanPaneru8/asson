import type { Metadata } from "next";
import Link from "next/link";
import { inviteFor } from "@/lib/team";
import { Logo } from "@/components/site/logo";
import { InviteForm } from "./invite-form";

export const metadata: Metadata = { title: "Set up your staff login", robots: { index: false } };

/** A new team member arrives from the owner's one-time link and chooses their password. */
export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const invite = await inviteFor(token);
  return (
    <main id="main" className="flex min-h-full flex-1 items-center justify-center bg-paper px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center"><Logo /></div>
        {!invite ? (
          <div className="border border-line bg-white p-8 text-center">
            <h1 className="font-display text-3xl">This link has expired</h1>
            <p className="mt-3 text-[15px] text-ink-soft">Invite links work once, for 7 days. Ask the owner for a new one from Team &amp; access.</p>
            <Link href="/login" className="mt-6 inline-block text-[14px] underline underline-offset-4">Already set up? Sign in</Link>
          </div>
        ) : (
          <div className="border border-line bg-white p-8">
            <h1 className="font-display text-3xl">Welcome, {invite.name.split(" ")[0]}</h1>
            <p className="mt-2 text-[15px] text-ink-soft">Choose a password for your Asson staff login{invite.job ? ` (${invite.job})` : ""}. You&apos;ll sign in with <span className="font-medium text-ink">{invite.email}</span>.</p>
            <InviteForm token={token} />
            <p className="mt-6 text-[12.5px] text-muted">Keep your password to yourself. Everything you do is recorded under your name.</p>
          </div>
        )}
      </div>
    </main>
  );
}
