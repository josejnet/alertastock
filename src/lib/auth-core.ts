import { createHmac, timingSafeEqual } from "node:crypto";
export type Session = { username: string; role: "ADMIN" | "USER"; createdAt: number };
export const sessionCookie = "reservaclara_session";
function secret() { return process.env.AUTH_SECRET || (process.env.NODE_ENV === "production" ? null : "reservaclara-development-secret"); }
function sign(value: string) { const key = secret(); return key ? createHmac("sha256", key).update(value).digest("hex") : null; }
function safeEqual(a: string, b: string) { const left = Buffer.from(a); const right = Buffer.from(b); return left.length === right.length && timingSafeEqual(left, right); }
export function verifySessionValue(value: string | undefined): Session | null { if (!value) return null; const [payload, signature] = value.split("."); const expected = sign(payload ?? ""); if (!payload || !signature || !expected || !safeEqual(signature, expected)) return null; try { const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as Session; if (!parsed.username || !["ADMIN", "USER"].includes(parsed.role) || !Number.isFinite(parsed.createdAt) || parsed.createdAt > Date.now() || Date.now() - parsed.createdAt > 1000 * 60 * 60 * 24 * 7) return null; return parsed; } catch { return null; } }
