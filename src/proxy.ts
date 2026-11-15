import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySession } from "@/lib/session-token";

// Optimistic gate only — every protected page and action re-checks the session against the DB.
export async function proxy(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  const staffSide = pathname === "/admin" || pathname.startsWith("/admin/");
  // the staff sign-in page (and its two-step page) is open to everyone
  if (pathname === "/admin/login" || pathname.startsWith("/admin/login/")) return NextResponse.next();
  const session = await verifySession(req.cookies.get(SESSION_COOKIE)?.value);
  if (!session) {
    const url = req.nextUrl.clone();
    // two doors: staff pages send you to the staff sign-in, account pages to the shop's
    url.pathname = staffSide ? "/admin/login" : "/login";
    url.search = `?next=${encodeURIComponent(pathname + search)}`;
    return NextResponse.redirect(url);
  }
  if (staffSide && session.role === "CUSTOMER") return NextResponse.redirect(new URL("/admin/login", req.url));
  return NextResponse.next();
}

export const config = { matcher: ["/admin/:path*", "/account/:path*"] };
