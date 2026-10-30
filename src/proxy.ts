import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { verifySessionValue } from "@/lib/auth-core";

export function proxy(request: NextRequest) {
  if (request.nextUrl.pathname.startsWith("/dashboard")) {
    const session = verifySessionValue(request.cookies.get("reservaclara_session")?.value);
    if (!session) return NextResponse.redirect(new URL("/", request.url));
    if (request.nextUrl.pathname.startsWith("/dashboard/admin") && session.role !== "ADMIN") return NextResponse.redirect(new URL("/dashboard", request.url));
  }
  return NextResponse.next();
}

export const config = { matcher: ["/dashboard/:path*"] };
