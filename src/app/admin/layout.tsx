import type { Metadata } from "next";
import { ADMIN_MANIFEST } from "@/lib/app-manifest";
import { store } from "@/lib/config";

// The staff side: /admin/login (sign-in, open to anyone) and the staff pages in (staff), which need a staff session.
export const metadata: Metadata = {
  title: { default: "Admin", template: "%s · Admin" },
  robots: { index: false },
  // staff install this as its own app ("Asson Admin", terracotta icon), separate from the shop's
  manifest: ADMIN_MANIFEST,
  icons: { apple: "/icons/admin-apple-180.png" },
  appleWebApp: { capable: true, title: `${store.name} Admin`, statusBarStyle: "default" },
};

export default function AdminRoot({ children }: { children: React.ReactNode }) {
  return children;
}
