import Link from "next/link";
import { requirePermission } from "@/lib/auth";
import { db } from "@/lib/db";
import { scopeFor, storeFilter } from "@/lib/scope";
import { PageHeader } from "@/components/admin/ui";
import { LogCaseForm } from "@/components/admin/care-forms";

export const metadata = { title: "Log a case" };

export default async function NewCasePage() {
  const me = await requirePermission("care");
  const locations = await db.store.findMany({ where: { active: true, kind: "SHOP", ...storeFilter(await scopeFor(me)) }, orderBy: { name: "asc" }, select: { id: true, name: true } });
  return (
    <>
      <PageHeader title="Log a case" description="A customer called, messaged or came into a shop: write it down here so nothing gets lost." actions={<Link href="/admin/care" className="text-[13.5px] underline underline-offset-4">Back to the queue</Link>} />
      <div className="max-w-3xl"><LogCaseForm locations={locations} /></div>
    </>
  );
}
