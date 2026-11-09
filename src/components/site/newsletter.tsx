"use client";

import { useState } from "react";
import { toast } from "sonner";

export function NewsletterForm() {
  const [email, setEmail] = useState("");
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!/^\S+@\S+\.\S+$/.test(email)) return toast.error("Enter a valid email");
        // Hook up to your ESP (Klaviyo, Mailchimp, etc.) in an API route.
        toast.success("You're on the list. Watch your inbox for 10% off.");
        setEmail("");
      }}
      className="flex max-w-sm"
    >
      <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" placeholder="Your email for 10% off" aria-label="Email address" className="h-11 flex-1 border border-r-0 border-line bg-white px-3 text-[14.5px] outline-none focus:border-ink" />
      <button className="h-11 bg-ink px-4 text-[13.5px] font-medium text-white hover:bg-ink-soft">Subscribe</button>
    </form>
  );
}
