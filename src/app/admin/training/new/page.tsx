import { requirePermission } from "@/lib/auth";
import { Card, PageHeader } from "@/components/admin/ui";
import { SopEditor } from "@/components/admin/training-forms";

export const metadata = { title: "New procedure" };

export default async function NewSopPage() {
  await requirePermission("ops.manage");
  return (
    <>
      <PageHeader title="New procedure" description="Write it the way you'd explain it to someone on their first day: short steps, in order." />
      <Card><SopEditor /></Card>
    </>
  );
}
