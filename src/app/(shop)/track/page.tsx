import type { Metadata } from "next";
import { TrackForm } from "@/components/account/track-form";

export const metadata: Metadata = { title: "Track your order" };

export default function TrackPage() {
  return (
    <div className="container-page flex justify-center py-16">
      <div className="w-full max-w-md">
        <h1 className="text-center font-display text-4xl">Track your order</h1>
        <p className="mt-2 text-center text-[14.5px] text-muted">Enter your order number and the email used at checkout.</p>
        <TrackForm />
      </div>
    </div>
  );
}
