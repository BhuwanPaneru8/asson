import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { AddressBook } from "@/components/account/address-book";

export const metadata = { title: "Addresses" };

export default async function AddressesPage() {
  const user = await requireUser("/account/addresses");
  const addresses = await db.address.findMany({ where: { userId: user.id }, orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }] });
  return <AddressBook addresses={addresses.map((a) => ({ id: a.id, fullName: a.fullName, phone: a.phone, line1: a.line1, line2: a.line2 ?? "", city: a.city, district: a.district, postalCode: a.postalCode ?? "", isDefault: a.isDefault }))} />;
}
