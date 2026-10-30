import { cookies } from "next/headers";
import { sessionCookie, verifySessionValue, type Session } from "@/lib/auth-core";
export { sessionCookie, verifySessionValue } from "@/lib/auth-core";
export type { Session } from "@/lib/auth-core";
export async function getSession() { return verifySessionValue((await cookies()).get(sessionCookie)?.value); }
export async function requireSession(role?: Session["role"]) { const session = await getSession(); if (!session || (role && session.role !== role)) throw new Error("UNAUTHORIZED"); return session; }
