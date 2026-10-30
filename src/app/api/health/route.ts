import { NextResponse } from "next/server";
import { db } from "@/lib/db";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET() { const configured = Boolean(process.env.DATABASE_URL); if (!configured) return NextResponse.json({ ok: true, service: "reservaclara", database: { configured: false, connected: false } }); try { await db.$queryRaw`SELECT 1`; return NextResponse.json({ ok: true, service: "reservaclara", database: { configured: true, connected: true } }); } catch { return NextResponse.json({ ok: false, service: "reservaclara", database: { configured: true, connected: false } }, { status: 503 }); } }
