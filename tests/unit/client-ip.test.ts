import { describe, expect, it } from "vitest";
import { clientIp } from "@/lib/client-ip";

describe("clientIp", () => {
  it("prefers Cloudflare's header over a spoofable X-Forwarded-For", () => {
    const h = new Headers({ "cf-connecting-ip": "27.34.1.2", "x-forwarded-for": "1.1.1.1, 27.34.1.2" });
    expect(clientIp(h)).toBe("27.34.1.2");
  });
  it("falls back to X-Forwarded-For's first entry, then 'local'", () => {
    expect(clientIp(new Headers({ "x-forwarded-for": " 10.0.0.5 , 10.0.0.1" }))).toBe("10.0.0.5");
    expect(clientIp(new Headers())).toBe("local");
  });
});
