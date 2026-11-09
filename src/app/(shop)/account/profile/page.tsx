import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { ProfileForms } from "@/components/account/profile-forms";

export const metadata = { title: "Profile" };

export default async function ProfilePage() {
  const user = await requireUser("/account/profile");
  const me = await db.user.findUniqueOrThrow({ where: { id: user.id }, select: { birthday: true } });
  return <ProfileForms user={{ name: user.name, email: user.email, phone: user.phone ?? "", birthday: me.birthday ?? "" }} />;
}
