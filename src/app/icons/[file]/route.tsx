import { appIcon, ICON_FILES, type IconFile } from "@/lib/app-icon";

// /icons/shop-192.png and friends: the icons named in the two app manifests.
export async function GET(_req: Request, { params }: { params: Promise<{ file: string }> }) {
  const { file } = await params;
  const spec = Object.hasOwn(ICON_FILES, file) ? ICON_FILES[file as IconFile] : null;
  if (!spec) return new Response("Not found", { status: 404 });
  const res = appIcon(spec);
  res.headers.set("Cache-Control", "public, max-age=86400, stale-while-revalidate=604800");
  return res;
}

export function generateStaticParams() {
  return Object.keys(ICON_FILES).map((file) => ({ file }));
}
