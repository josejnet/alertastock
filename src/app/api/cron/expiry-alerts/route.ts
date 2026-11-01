import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function daysBetween(from: Date, to: Date) {
  return Math.ceil((to.getTime() - from.getTime()) / 86400000);
}

export async function GET(request: NextRequest) {
  if (request.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!process.env.DATABASE_URL || !process.env.RESEND_API_KEY) return NextResponse.json({ error: "Missing environment variables" }, { status: 500 });

  const today = new Date(); today.setUTCHours(0, 0, 0, 0);
  const resend = new Resend(process.env.RESEND_API_KEY);
  const users = await db.user.findMany({ where: { status: "ACTIVE", alertSettings: { enabled: true } }, include: { alertSettings: true, items: { where: { status: "ACTIVE", expiresAt: { gte: today } } }, packs: { where: { expiresAt: { gte: today } } } } });
  let sent = 0;

  for (const user of users) {
    if (!user.alertSettings || !user.email) continue;
    const thresholds = user.alertSettings.daysBefore;
    const items = user.items.filter((item) => item.expiresAt && thresholds.includes(daysBetween(today, item.expiresAt)));
    const packs = user.packs.filter((pack) => pack.expiresAt && thresholds.includes(daysBetween(today, pack.expiresAt)));
    if (!items.length && !packs.length) continue;
    const lines = [...items.map((item) => `${item.name} — ${daysBetween(today, item.expiresAt!)} días`), ...packs.map((pack) => `Pack ${pack.name} — ${daysBetween(today, pack.expiresAt!)} días`)].map((line) => `<li>${line}</li>`).join("");
    const result = await resend.emails.send({ from: process.env.EMAIL_FROM ?? "AlertaStock <onboarding@resend.dev>", to: [user.alertSettings.email ?? user.email], subject: "Alertas de caducidad de tu inventario", html: `<h1>Alertas de caducidad</h1><p>Revisa estos elementos:</p><ul>${lines}</ul>` });
    if (result.error) continue;
    sent++;
    await db.$transaction([...items.map((item) => db.alertDelivery.create({ data: { userId: user.id, itemId: item.id, entityType: "ITEM", thresholdDays: daysBetween(today, item.expiresAt!), resendId: result.data?.id } })), ...packs.map((pack) => db.alertDelivery.create({ data: { userId: user.id, packId: pack.id, entityType: "PACK", thresholdDays: daysBetween(today, pack.expiresAt!), resendId: result.data?.id } }))]);
  }
  return NextResponse.json({ ok: true, sent });
}
