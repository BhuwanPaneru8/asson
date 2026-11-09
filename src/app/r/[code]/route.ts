import { NextResponse, type NextRequest } from "next/server";

/** Share link /r/CODE: remember the friend's code for checkout (30 days), then show the shop. */
export async function GET(req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const code = (await params).code.toUpperCase();
  const res = NextResponse.redirect(new URL("/", req.url));
  if (/^[A-Z0-9]{6,12}$/.test(code)) {
    res.cookies.set("asson_ref", code, { maxAge: 30 * 86_400, sameSite: "lax", httpOnly: true, secure: process.env.NODE_ENV === "production", path: "/" });
  }
  return res;
}
