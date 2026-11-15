import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requirePermission } from "@/lib/auth";
import { PageHeader } from "@/components/admin/ui";
import { LookEditor } from "@/components/admin/look-editor";

export const metadata = { title: "New look" };

export default async function NewLookPage() {
  await requirePermission("catalog.edit");
  return (
    <>
      <Link href="/admin/lookbook" className="mb-4 inline-flex items-center gap-1.5 text-[13.5px] text-muted hover:text-ink"><ArrowLeft className="h-4 w-4" /> Lookbook</Link>
      <PageHeader title="New look" description="Style a few of your products into one outfit, with a photo and a short story." />
      <LookEditor look={{ title: "", slug: "", subtitle: "", story: "", heroImage: "", published: false, position: 0, items: [] }} />
    </>
  );
}
