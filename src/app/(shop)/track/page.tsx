import type { Metadata } from "next";
import { TrackForm } from "@/components/account/track-form";
import { getT } from "@/lib/i18n/server";

export const metadata: Metadata = { title: "Track your order" };

export default async function TrackPage() {
  const { t } = await getT();
  return (
    <div className="container-page flex justify-center py-16">
      <div className="w-full max-w-md">
        <h1 className="text-center font-display text-4xl">{t("footer.track")}</h1>
        <p className="mt-2 text-center text-[14.5px] text-muted">{t("track.body")}</p>
        <TrackForm />
      </div>
    </div>
  );
}
