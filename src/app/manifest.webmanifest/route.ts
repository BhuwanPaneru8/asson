import { manifestResponse, shopManifest } from "@/lib/app-manifest";

export const dynamic = "force-static";
export const GET = () => manifestResponse(shopManifest());
