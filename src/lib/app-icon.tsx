import { ImageResponse } from "next/og";

// The home-screen icon: the "a." of the wordmark on the brand's dark ink, drawn in code so there are
// no image files to keep in step. The staff app uses the terracotta accent, so the two don't get mixed up
// on a phone. "Maskable" icons keep the mark inside the middle 80%, because Android crops them to a circle.

export const ICON_FILES = {
  "shop-192.png": { size: 192, admin: false, maskable: false },
  "shop-512.png": { size: 512, admin: false, maskable: false },
  "shop-maskable-512.png": { size: 512, admin: false, maskable: true },
  "shop-apple-180.png": { size: 180, admin: false, maskable: false }, // iPhone "Add to Home Screen"
  "admin-192.png": { size: 192, admin: true, maskable: false },
  "admin-512.png": { size: 512, admin: true, maskable: false },
  "admin-maskable-512.png": { size: 512, admin: true, maskable: true },
  "admin-apple-180.png": { size: 180, admin: true, maskable: false },
} as const;

export type IconFile = keyof typeof ICON_FILES;

const INK = "#141414", ACCENT = "#8a3b24", PAPER = "#fbfaf8";

export function appIcon({ size, admin = false, maskable = false }: { size: number; admin?: boolean; maskable?: boolean }) {
  const mark = size * (maskable ? 0.5 : 0.62); // letter height
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: admin ? ACCENT : INK }}>
        <div style={{ display: "flex", alignItems: "flex-end", color: PAPER, fontSize: mark, fontWeight: 700, lineHeight: 1, letterSpacing: -mark * 0.04, marginTop: -mark * 0.12 }}>
          a
          <div style={{ width: mark * 0.17, height: mark * 0.17, borderRadius: mark, background: admin ? PAPER : ACCENT, marginLeft: mark * 0.04, marginBottom: mark * 0.06 }} />
        </div>
      </div>
    ),
    { width: size, height: size },
  );
}
