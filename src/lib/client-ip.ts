/**
 * The visitor's IP for rate limiting. In production every request arrives through Cloudflare
 * (tunnel, no open ports), which sets CF-Connecting-IP and can't be spoofed by the client.
 * X-Forwarded-For is only a fallback for local/dev: its first entry is client-controlled.
 */
export function clientIp(h: Headers): string {
  return (
    h.get("cf-connecting-ip")?.trim() ||
    h.get("x-real-ip")?.trim() ||
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "local"
  );
}
