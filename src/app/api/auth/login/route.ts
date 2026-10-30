import { NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "node:crypto";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";

const COOKIE = "reservaclara_session";
const loginAttempts = new Map<string, { count: number; resetAt: number }>();
function signature(value: string) { return createHmac("sha256", process.env.AUTH_SECRET ?? "reservaclara-development-secret").update(value).digest("hex"); }
function matches(input: string, expected: string | undefined) { if (!expected) return false; const a = Buffer.from(input); const b = Buffer.from(expected); return a.length === b.length && timingSafeEqual(a, b); }
function clientKey(request: Request) { return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "unknown"; }

export async function POST(request: Request) {
  if (process.env.NODE_ENV === "production" && !process.env.AUTH_SECRET) return NextResponse.json({ error: "AUTH_SECRET is not configured" }, { status: 503 });
  const key = clientKey(request); const now = Date.now(); const current = loginAttempts.get(key);
  if (current && current.resetAt > now && current.count >= 8) return NextResponse.json({ error: "Demasiados intentos. Espera unos minutos." }, { status: 429 });
  if (current && current.resetAt <= now) loginAttempts.delete(key);
  const body = await request.json().catch(() => ({})); const username = String(body.username ?? "").toLowerCase(); const password = String(body.password ?? "");
  if (process.env.DATABASE_URL && username.includes("@")) {
    try {
      const user = await db.user.findUnique({ where: { email: username } });
      if (user?.passwordHash && user.status === "ACTIVE" && await bcrypt.compare(password, user.passwordHash)) {
        const payload = Buffer.from(JSON.stringify({ username: user.email, role: user.role, createdAt: Date.now() })).toString("base64url");
        loginAttempts.delete(key); const response = NextResponse.json({ ok: true, role: user.role }); response.cookies.set(COOKIE, `${payload}.${signature(payload)}`, { httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 7 }); return response;
      }
    } catch { /* Database is optional until Vercel is provisioned. */ }
  }
  const isAdmin = username === (process.env.ADMIN_USER ?? "admin") && matches(password, process.env.ADMIN_PASSWORD);
  const isJose = username === (process.env.JOSE_USER ?? "jose") && matches(password, process.env.JOSE_PASSWORD);
  if (!isAdmin && !isJose) { const next = loginAttempts.get(key); loginAttempts.set(key, { count: (next?.count ?? 0) + 1, resetAt: next?.resetAt && next.resetAt > now ? next.resetAt : now + 15 * 60 * 1000 }); return NextResponse.json({ error: "Invalid credentials" }, { status: 401 }); }
  const payload = Buffer.from(JSON.stringify({ username, role: isAdmin ? "ADMIN" : "USER", createdAt: Date.now() })).toString("base64url");
  if (process.env.NODE_ENV === "production" && !process.env.AUTH_SECRET) return NextResponse.json({ error: "AUTH_SECRET is not configured" }, { status: 503 });
  loginAttempts.delete(key); const response = NextResponse.json({ ok: true, role: isAdmin ? "ADMIN" : "USER" });
  response.cookies.set(COOKIE, `${payload}.${signature(payload)}`, { httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 7 });
  return response;
}
