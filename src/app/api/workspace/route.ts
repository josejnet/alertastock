import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { defaultCalorieSettings } from "@/lib/nutrition";
import { initialCatalog } from "@/lib/catalog";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const normalize = (value: string) => value.trim().toLocaleLowerCase("es");
const categories = Array.from(
  new Set(initialCatalog.map((item) => item.category)),
);

function decimal(value: unknown) {
  return Number(value ?? 0);
}
function positiveNumber(value: unknown, fallback = 0) {
  const result = Number(value);
  return Number.isFinite(result) && result >= 0 ? result : fallback;
}
function serializeItem(item: {
  id: string;
  name: string;
  detail: string | null;
  quantity: unknown;
  unit: string;
  expiresAt: Date;
  purchaseDate: Date | null;
  status: string;
  category?: { name: string } | null;
  packItems?: {
    pack: {
      id: string;
      name: string;
      code: string | null;
      location: string | null;
    };
  }[];
}) {
  return {
    id: item.id,
    name: item.name,
    detail: item.detail,
    quantity: decimal(item.quantity),
    unit: item.unit,
    expiresAt: item.expiresAt.toISOString().slice(0, 10),
    purchaseDate: item.purchaseDate?.toISOString() ?? null,
    status: item.status,
    category: item.category?.name ?? null,
    packs: item.packItems?.map((line) => line.pack) ?? [],
  };
}
async function currentUser() {
  const session = await requireSession();
  const email = session.username.includes("@")
    ? session.username
    : `${session.username}@reservaclara.local`;
  const existing = await db.user.findUnique({ where: { email } });
  if (existing) {
    if (existing.status !== "ACTIVE") throw new Error("UNAUTHORIZED");
    return existing;
  }
  return db.user.create({
    data: {
      email,
      name: session.username === "jose" ? "Jose" : "Admin",
      role: session.role,
    },
  });
}
async function ensureDefaults(userId: string) {
  const count = await db.plannedStock.count({
    where: { userId, active: true },
  });
  if (count) return;
  const categoryRows = await Promise.all(
    categories.map((name) =>
      db.category.upsert({
        where: { userId_slug: { userId, slug: normalize(name) } },
        update: {},
        create: { userId, name, slug: normalize(name) },
      }),
    ),
  );
  const byName = new Map(categoryRows.map((row) => [row.name, row.id]));
  await db.plannedStock.createMany({
    data: initialCatalog.map((item) => ({
      userId,
      name: item.name,
      normalizedName: normalize(item.name),
      plannedQuantity: item.plannedQuantity,
      unit: item.unit,
      categoryId: byName.get(item.category),
    })),
  });
  await db.nutritionSettings.upsert({
    where: { userId },
    update: {},
    create: { userId, ...defaultCalorieSettings },
  });
}

export async function GET() {
  try {
    const user = await currentUser();
    await ensureDefaults(user.id);
    const [planned, purchases, packs, members, nutrition, categoryRows, shoppingItems] =
      await Promise.all([
        db.plannedStock.findMany({
          where: { userId: user.id, active: true },
          include: { category: true },
          orderBy: { name: "asc" },
        }),
        db.item.findMany({
          where: { userId: user.id, status: "ACTIVE" },
          include: {
            category: true,
            packItems: {
              include: {
                pack: {
                  select: { id: true, name: true, code: true, location: true },
                },
              },
            },
          },
          orderBy: { expiresAt: "asc" },
        }),
        db.pack.findMany({
          where: { userId: user.id },
          include: { items: { include: { item: true } } },
          orderBy: { createdAt: "desc" },
        }),
        db.householdMember.findMany({
          where: { userId: user.id, active: true },
          orderBy: { createdAt: "asc" },
        }),
        db.nutritionSettings.findUnique({ where: { userId: user.id } }),
        db.category.findMany({
          where: { OR: [{ userId: user.id }, { isGlobal: true }] },
          orderBy: { name: "asc" },
        }),
        db.shoppingItem.findMany({
          where: { userId: user.id, completed: false, plannedStock: { active: true } },
          include: { plannedStock: true },
          orderBy: { createdAt: "asc" },
        }),
      ]);
    return NextResponse.json({
      user: { id: user.id, name: user.name, role: user.role },
      planned: planned.map((item) => ({
        id: item.id,
        name: item.name,
        category: item.category?.name ?? "Sin categoría",
        plannedQuantity: decimal(item.plannedQuantity),
        unit: item.unit,
      })),
      purchases: purchases.map(serializeItem),
      packs: packs.map((pack) => ({
        id: pack.id,
        name: pack.name,
        code: pack.code,
        location: pack.location,
        expiresAt: pack.expiresAt?.toISOString().slice(0, 10) ?? null,
        items: pack.items.map((line) => ({
          itemId: line.itemId,
          purchaseId: line.itemId,
          name: line.item.name,
          detail: line.item.detail,
          quantity: decimal(line.quantity),
          unit: line.item.unit,
          expiresAt: line.item.expiresAt.toISOString().slice(0, 10),
        })),
      })),
      members,
      nutrition: nutrition ?? { ...defaultCalorieSettings },
      categories: categoryRows,
      shoppingList: shoppingItems.map((item) => ({
        id: item.id,
        plannedStockId: item.plannedStockId,
        name: item.name,
        desiredQuantity: decimal(item.desiredQuantity),
        purchasedQuantity: decimal(item.purchasedQuantity),
        remainingQuantity: Math.max(decimal(item.desiredQuantity) - decimal(item.purchasedQuantity), 0),
        unit: item.unit,
        category: item.plannedStock?.categoryId ?? null,
      })),
    });
  } catch (error) {
    const status =
      error instanceof Error && error.message === "UNAUTHORIZED" ? 401 : 503;
    return NextResponse.json(
      { error: status === 401 ? "Unauthorized" : "Database unavailable" },
      { status },
    );
  }
}

export async function POST(request: Request) {
  try {
    const user = await currentUser();
    const body = await request.json();
    const action = String(body.action ?? "");
    if (action === "saveNutrition") {
      const values = body.values ?? {};
      const result = await db.nutritionSettings.upsert({
        where: { userId: user.id },
        update: {
          adult: Number(values.adult),
          senior: Number(values.senior),
          teenager: Number(values.teenager),
          child: Number(values.child),
          preschool: Number(values.preschool),
          infant: Number(values.infant),
        },
        create: {
          userId: user.id,
          adult: Number(values.adult),
          senior: Number(values.senior),
          teenager: Number(values.teenager),
          child: Number(values.child),
          preschool: Number(values.preschool),
          infant: Number(values.infant),
        },
      });
      return NextResponse.json(result);
    }
    if (action === "createMember") {
      const result = await db.householdMember.create({
        data: {
          userId: user.id,
          name: String(body.name).trim(),
          age: Number(body.age),
          dailyCalories: Number(body.dailyCalories ?? 0),
        },
      });
      return NextResponse.json(result, { status: 201 });
    }
    if (action === "deleteMember") {
      await db.householdMember.updateMany({
        where: { id: String(body.id), userId: user.id },
        data: { active: false },
      });
      return NextResponse.json({ ok: true });
    }
    if (action === "createCategory") {
      const name = String(body.name).trim();
      if (!name)
        return NextResponse.json(
          { error: "Category name required" },
          { status: 400 },
        );
      const result = await db.category.upsert({
        where: { userId_slug: { userId: user.id, slug: normalize(name) } },
        update: {},
        create: { userId: user.id, name, slug: normalize(name) },
      });
      return NextResponse.json(result, { status: 201 });
    }
    if (action === "createPlanned") {
      const name = String(body.name).trim();
      let categoryId = body.categoryId ? String(body.categoryId) : null;
      if (!categoryId && body.categoryName) {
        const category = await db.category.upsert({
          where: {
            userId_slug: {
              userId: user.id,
              slug: normalize(String(body.categoryName)),
            },
          },
          update: {},
          create: {
            userId: user.id,
            name: String(body.categoryName).trim(),
            slug: normalize(String(body.categoryName)),
          },
        });
        categoryId = category.id;
      }
      const result = await db.plannedStock.upsert({
        where: {
          userId_normalizedName: {
            userId: user.id,
            normalizedName: normalize(name),
          },
        },
        update: {
          plannedQuantity: Number(body.quantity),
          unit: String(body.unit),
          categoryId,
          active: true,
        },
        create: {
          userId: user.id,
          name,
          normalizedName: normalize(name),
          plannedQuantity: Number(body.quantity),
          unit: String(body.unit),
          categoryId,
        },
      });
      return NextResponse.json(result, { status: 201 });
    }
    if (action === "updatePlanned") {
      const id = String(body.id);
      const name = String(body.name ?? "").trim();
      const quantity = positiveNumber(body.quantity);
      const unit = String(body.unit ?? "").trim();
      if (!id || !name || !quantity || !unit) return NextResponse.json({ error: "Planned stock data incomplete" }, { status: 400 });
      let categoryId = body.categoryId ? String(body.categoryId) : null;
      if (!categoryId && body.categoryName) {
        const category = await db.category.upsert({ where: { userId_slug: { userId: user.id, slug: normalize(String(body.categoryName)) } }, update: {}, create: { userId: user.id, name: String(body.categoryName).trim(), slug: normalize(String(body.categoryName)) } });
        categoryId = category.id;
      }
      const duplicate = await db.plannedStock.findFirst({ where: { userId: user.id, normalizedName: normalize(name), id: { not: id }, active: true } });
      if (duplicate) return NextResponse.json({ error: "That planned food already exists" }, { status: 409 });
      const previous = await db.plannedStock.findFirst({ where: { id, userId: user.id, active: true } });
      if (!previous) return NextResponse.json({ error: "Planned stock not found" }, { status: 404 });
      await db.item.updateMany({ where: { userId: user.id, name: previous.name }, data: { name, unit, categoryId } });
      await db.shoppingItem.updateMany({ where: { userId: user.id, name: previous.name }, data: { name, unit, categoryId } });
      const result = await db.plannedStock.updateMany({ where: { id, userId: user.id, active: true }, data: { name, normalizedName: normalize(name), plannedQuantity: quantity, unit, categoryId } });
      if (!result.count) return NextResponse.json({ error: "Planned stock not found" }, { status: 404 });
      return NextResponse.json({ ok: true });
    }
    if (action === "addShoppingItem") {
      const planned = await db.plannedStock.findFirst({ where: { id: String(body.plannedStockId), userId: user.id, active: true } });
      const quantity = positiveNumber(body.quantity);
      if (!planned || !quantity) return NextResponse.json({ error: "Shopping item data incomplete" }, { status: 400 });
      const purchased = await db.item.aggregate({ where: { userId: user.id, name: planned.name, status: "ACTIVE" }, _sum: { quantity: true } });
      const pending = Math.max(decimal(planned.plannedQuantity) - decimal(purchased._sum.quantity), 0);
      const existing = await db.shoppingItem.findUnique({ where: { userId_plannedStockId: { userId: user.id, plannedStockId: planned.id } } });
      const desiredQuantity = Math.min(pending, (existing ? decimal(existing.desiredQuantity) : 0) + quantity);
      if (desiredQuantity <= 0) return NextResponse.json({ error: "No pending stock" }, { status: 400 });
      const result = existing
        ? await db.shoppingItem.update({ where: { id: existing.id }, data: { desiredQuantity, completed: false } })
        : await db.shoppingItem.create({ data: { userId: user.id, plannedStockId: planned.id, name: planned.name, categoryId: planned.categoryId, desiredQuantity, unit: planned.unit } });
      return NextResponse.json({ id: result.id, plannedStockId: planned.id, name: result.name, desiredQuantity: decimal(result.desiredQuantity), purchasedQuantity: decimal(result.purchasedQuantity), remainingQuantity: Math.max(decimal(result.desiredQuantity) - decimal(result.purchasedQuantity), 0), unit: result.unit });
    }
    if (action === "removeShoppingItem") {
      await db.shoppingItem.deleteMany({ where: { id: String(body.id), userId: user.id } });
      return NextResponse.json({ ok: true });
    }
    if (action === "deletePlanned") {
      await db.plannedStock.updateMany({
        where: { id: String(body.id), userId: user.id },
        data: { active: false },
      });
      return NextResponse.json({ ok: true });
    }
    if (action === "createPurchase") {
      const planned = await db.plannedStock.findFirst({ where: { userId: user.id, id: String(body.plannedStockId), active: true } });
      if (!planned) return NextResponse.json({ error: "Planned stock not found" }, { status: 400 });
      const requestedQuantity = positiveNumber(body.quantity);
      const expiry = new Date(`${String(body.expiresAt)}T00:00:00`);
      if (!requestedQuantity || Number.isNaN(expiry.getTime())) return NextResponse.json({ error: "Quantity and expiry date are required" }, { status: 400 });
      const purchased = await db.item.aggregate({ where: { userId: user.id, name: planned.name, status: "ACTIVE" }, _sum: { quantity: true } });
      const pending = Math.max(decimal(planned.plannedQuantity) - decimal(purchased._sum.quantity), 0);
      if (requestedQuantity > pending) return NextResponse.json({ error: "Purchase exceeds pending stock" }, { status: 400 });
      const shoppingItem = body.shoppingItemId
        ? await db.shoppingItem.findFirst({ where: { id: String(body.shoppingItemId), userId: user.id, plannedStockId: planned.id, completed: false } })
        : null;
      if (body.shoppingItemId && (!shoppingItem || requestedQuantity > Math.max(decimal(shoppingItem.desiredQuantity) - decimal(shoppingItem.purchasedQuantity), 0))) return NextResponse.json({ error: "Purchase exceeds shopping list quantity" }, { status: 400 });
      const item = await db.$transaction(async (tx) => {
        const created = await tx.item.create({ data: { userId: user.id, categoryId: planned.categoryId, name: planned.name, detail: String(body.detail ?? "").trim() || null, quantity: requestedQuantity, unit: planned.unit, caloriesPerUnit: body.caloriesPerUnit ? Number(body.caloriesPerUnit) : null, purchaseDate: new Date(), expiresAt: expiry } });
        await tx.stockMovement.create({ data: { userId: user.id, plannedStockId: planned.id, itemId: created.id, type: "PURCHASE", quantity: requestedQuantity } });
        if (shoppingItem) {
          const purchasedQuantity = decimal(shoppingItem.purchasedQuantity) + requestedQuantity;
          await tx.shoppingItem.update({ where: { id: shoppingItem.id }, data: { purchasedQuantity, completed: purchasedQuantity >= decimal(shoppingItem.desiredQuantity) } });
        }
        return created;
      });
      return NextResponse.json(serializeItem(item), { status: 201 });
    }
    if (action === "updatePurchase") {
      const itemId = String(body.itemId ?? "");
      const detail = String(body.detail ?? "").trim() || null;
      const quantity = positiveNumber(body.quantity);
      const expiresAt = new Date(`${String(body.expiresAt ?? "")}T00:00:00`);
      if (!itemId || !quantity || Number.isNaN(expiresAt.getTime())) return NextResponse.json({ error: "Quantity and expiry date are required" }, { status: 400 });
      const item = await db.item.findFirst({ where: { id: itemId, userId: user.id, status: "ACTIVE" } });
      if (!item) return NextResponse.json({ error: "Item not found" }, { status: 404 });
      const planned = await db.plannedStock.findFirst({ where: { userId: user.id, name: item.name, active: true } });
      if (!planned) return NextResponse.json({ error: "Planned stock not found" }, { status: 400 });
      const others = await db.item.aggregate({ where: { userId: user.id, name: item.name, status: "ACTIVE", NOT: { id: item.id } }, _sum: { quantity: true } });
      if (quantity > Math.max(decimal(planned.plannedQuantity) - decimal(others._sum.quantity), 0)) return NextResponse.json({ error: "Quantity exceeds pending stock objective" }, { status: 400 });
      const updated = await db.item.update({ where: { id: item.id }, data: { detail, quantity, expiresAt } });
      return NextResponse.json(serializeItem(updated));
    }
    if (action === "consume") {
      const item = await db.item.findFirst({
        where: { id: String(body.itemId), userId: user.id, status: "ACTIVE" },
      });
      if (!item)
        return NextResponse.json({ error: "Item not found" }, { status: 404 });
      const quantity = positiveNumber(body.quantity ?? 1);
      if (!quantity || quantity > decimal(item.quantity)) return NextResponse.json({ error: "Consumption exceeds available quantity" }, { status: 400 });
      const remaining = decimal(item.quantity) - quantity;
      await db.$transaction(async (tx) => {
        await tx.item.update({ where: { id: item.id }, data: { quantity: remaining, ...(remaining <= 0 ? { status: "CONSUMED" } : {}) } });
        await tx.stockMovement.create({ data: { userId: user.id, itemId: item.id, type: "CONSUMPTION", quantity } });
      });
      return NextResponse.json({ ok: true });
    }
    if (action === "createPack") {
      const lines = Array.isArray(body.items) ? body.items : [];
      if (
        !String(body.name ?? "").trim() ||
        !String(body.code ?? "").trim() ||
        !String(body.location ?? "").trim() ||
        !lines.length
      )
        return NextResponse.json(
          { error: "Pack data incomplete" },
          { status: 400 },
        );
      const itemIds: string[] = lines.map(
        (line: { itemId?: string; purchaseId?: string }) =>
          String(line.itemId ?? line.purchaseId),
      );
      if (
        new Set(itemIds).size !== itemIds.length ||
        itemIds.some((id: string) => !id)
      )
        return NextResponse.json(
          { error: "Invalid pack lines" },
          { status: 400 },
        );
      const ownedItems = await db.item.findMany({
        where: { userId: user.id, id: { in: itemIds }, status: "ACTIVE" },
      });
      if (ownedItems.length !== itemIds.length)
        return NextResponse.json(
          { error: "Invalid inventory item" },
          { status: 400 },
        );
      const ownedById = new Map(
        ownedItems.map((item) => [item.id, decimal(item.quantity)]),
      );
      if (
        lines.some(
          (line: { itemId?: string; purchaseId?: string; quantity?: number }) =>
            positiveNumber(line.quantity, 1) >
            (ownedById.get(String(line.itemId ?? line.purchaseId)) ?? 0),
        )
      )
        return NextResponse.json(
          { error: "Pack quantity exceeds inventory" },
          { status: 400 },
        );
      const pack = await db.$transaction((tx) => tx.pack.create({
        data: {
          userId: user.id,
          name: String(body.name).trim(),
          code: String(body.code).trim(),
          location: String(body.location).trim(),
          expiresAt: body.expiresAt
            ? new Date(`${String(body.expiresAt)}T00:00:00`)
            : null,
          items: {
            create: lines.map(
              (line: {
                itemId?: string;
                purchaseId?: string;
                quantity?: number;
              }) => ({
                itemId: String(line.itemId ?? line.purchaseId),
                quantity: Number(line.quantity ?? 1),
              }),
            ),
          },
        },
        include: { items: { include: { item: true } } },
      }));
      return NextResponse.json(
        {
          id: pack.id,
          name: pack.name,
          code: pack.code,
          location: pack.location,
          expiresAt: pack.expiresAt?.toISOString().slice(0, 10) ?? null,
          items: pack.items.map((line) => ({
            purchaseId: line.itemId,
            itemId: line.itemId,
            name: line.item.name,
            detail: line.item.detail,
            quantity: decimal(line.quantity),
            unit: line.item.unit,
            expiresAt: line.item.expiresAt.toISOString().slice(0, 10),
          })),
        },
        { status: 201 },
      );
    }
    if (action === "deletePack") {
      await db.pack.deleteMany({
        where: { id: String(body.id), userId: user.id },
      });
      return NextResponse.json({ ok: true });
    }
    if (action === "importPurchases") {
      const plannedRows = Array.isArray(body.planned) ? body.planned : [];
      const purchaseRows = Array.isArray(body.purchases) ? body.purchases : [];
      const imported = await db.$transaction(async (tx) => {
        for (const row of plannedRows) {
          const name = String(row.name ?? "").trim();
          if (!name) continue;
          let categoryId: string | null = null;
          if (row.category) {
            const category = await tx.category.upsert({
              where: {
                userId_slug: {
                  userId: user.id,
                  slug: normalize(String(row.category)),
                },
              },
              update: {},
              create: {
                userId: user.id,
                name: String(row.category).trim(),
                slug: normalize(String(row.category)),
              },
            });
            categoryId = category.id;
          }
          await tx.plannedStock.upsert({
            where: {
              userId_normalizedName: {
                userId: user.id,
                normalizedName: normalize(name),
              },
            },
            update: {
              plannedQuantity: positiveNumber(row.plannedQuantity, 1),
              unit: String(row.unit ?? "unidades"),
              categoryId,
              active: true,
            },
            create: {
              userId: user.id,
              name,
              normalizedName: normalize(name),
              plannedQuantity: positiveNumber(row.plannedQuantity, 1),
              unit: String(row.unit ?? "unidades"),
              categoryId,
            },
          });
        }
        let count = 0;
        for (const row of purchaseRows) {
          const name = String(row.name ?? "").trim();
          const quantity = positiveNumber(row.quantity);
          const expiresAt = String(row.expiresAt ?? "");
          if (!name || !quantity || !/^\d{4}-\d{2}-\d{2}$/.test(expiresAt))
            continue;
          const planned = await tx.plannedStock.findFirst({
            where: {
              userId: user.id,
              normalizedName: normalize(name),
              active: true,
            },
          });
          if (!planned) continue;
          const item = await tx.item.create({
            data: {
              userId: user.id,
              categoryId: planned.categoryId,
              name: planned.name,
              detail: String(row.detail ?? "").trim() || null,
              quantity,
              unit: planned.unit,
              purchaseDate: new Date(),
              expiresAt: new Date(`${expiresAt}T00:00:00`),
            },
          });
          await tx.stockMovement.create({
            data: {
              userId: user.id,
              plannedStockId: planned.id,
              itemId: item.id,
              type: "PURCHASE",
              quantity,
            },
          });
          count += 1;
        }
        return count;
      });
      return NextResponse.json({ ok: true, imported });
    }
    if (action === "importSnapshot") {
      const snapshot = body.snapshot ?? {};
      const plannedRows = Array.isArray(snapshot.planned)
        ? snapshot.planned
        : [];
      const purchaseRows = Array.isArray(snapshot.purchases)
        ? snapshot.purchases
        : [];
      const memberRows = Array.isArray(snapshot.members)
        ? snapshot.members
        : [];
      const packRows = Array.isArray(snapshot.packs) ? snapshot.packs : [];
      const imported = await db.$transaction(async (tx) => {
        const plannedIds = new Map<string, string>();
        for (const row of plannedRows) {
          const name = String(row.name ?? "").trim();
          if (!name) continue;
          const normalizedName = normalize(name);
          let categoryId: string | null = null;
          if (row.category) {
            const category = await tx.category.upsert({
              where: {
                userId_slug: {
                  userId: user.id,
                  slug: normalize(String(row.category)),
                },
              },
              update: {},
              create: {
                userId: user.id,
                name: String(row.category).trim(),
                slug: normalize(String(row.category)),
              },
            });
            categoryId = category.id;
          }
          const planned = await tx.plannedStock.upsert({
            where: {
              userId_normalizedName: { userId: user.id, normalizedName },
            },
            update: {
              plannedQuantity: positiveNumber(row.plannedQuantity, 1),
              unit: String(row.unit ?? "unidades"),
              categoryId,
              active: true,
            },
            create: {
              userId: user.id,
              name,
              normalizedName,
              plannedQuantity: positiveNumber(row.plannedQuantity, 1),
              unit: String(row.unit ?? "unidades"),
              categoryId,
            },
          });
          plannedIds.set(String(row.id ?? name), planned.id);
        }
        const itemIds = new Map<string, string>();
        for (const row of purchaseRows) {
          const name = String(row.name ?? "").trim();
          const expiresAt = String(row.expiresAt ?? "");
          const quantity = positiveNumber(row.quantity);
          if (!name || !quantity || !/^\d{4}-\d{2}-\d{2}$/.test(expiresAt))
            continue;
          const planned = await tx.plannedStock.findFirst({
            where: {
              userId: user.id,
              normalizedName: normalize(name),
              active: true,
            },
          });
          if (!planned) continue;
          const item = await tx.item.create({
            data: {
              userId: user.id,
              categoryId: planned.categoryId,
              name: planned.name,
              detail: String(row.detail ?? "").trim() || null,
              quantity,
              unit: planned.unit,
              purchaseDate: new Date(),
              expiresAt: new Date(`${expiresAt}T00:00:00`),
            },
          });
          await tx.stockMovement.create({
            data: {
              userId: user.id,
              plannedStockId: planned.id,
              itemId: item.id,
              type: "PURCHASE",
              quantity,
            },
          });
          itemIds.set(
            String(row.id ?? `${name}-${expiresAt}-${item.id}`),
            item.id,
          );
        }
        for (const row of memberRows) {
          const name = String(row.name ?? "").trim();
          if (name)
            await tx.householdMember.create({
              data: {
                userId: user.id,
                name,
                age: Math.max(0, Math.floor(Number(row.age) || 0)),
                dailyCalories: positiveNumber(row.dailyCalories),
              },
            });
        }
        const nutrition = snapshot.nutrition ?? {};
        await tx.nutritionSettings.upsert({
          where: { userId: user.id },
          update: {
            adult: positiveNumber(
              nutrition.adult,
              defaultCalorieSettings.adult,
            ),
            senior: positiveNumber(
              nutrition.senior,
              defaultCalorieSettings.senior,
            ),
            teenager: positiveNumber(
              nutrition.teenager,
              defaultCalorieSettings.teenager,
            ),
            child: positiveNumber(
              nutrition.child,
              defaultCalorieSettings.child,
            ),
            preschool: positiveNumber(
              nutrition.preschool,
              defaultCalorieSettings.preschool,
            ),
            infant: positiveNumber(
              nutrition.infant,
              defaultCalorieSettings.infant,
            ),
          },
          create: {
            userId: user.id,
            adult: positiveNumber(
              nutrition.adult,
              defaultCalorieSettings.adult,
            ),
            senior: positiveNumber(
              nutrition.senior,
              defaultCalorieSettings.senior,
            ),
            teenager: positiveNumber(
              nutrition.teenager,
              defaultCalorieSettings.teenager,
            ),
            child: positiveNumber(
              nutrition.child,
              defaultCalorieSettings.child,
            ),
            preschool: positiveNumber(
              nutrition.preschool,
              defaultCalorieSettings.preschool,
            ),
            infant: positiveNumber(
              nutrition.infant,
              defaultCalorieSettings.infant,
            ),
          },
        });
        let packsImported = 0;
        for (const row of packRows) {
          const lines = Array.isArray(row.items)
            ? row.items
                .map(
                  (line: {
                    purchaseId?: string;
                    itemId?: string;
                    quantity?: number;
                  }) => ({
                    itemId: itemIds.get(String(line.itemId ?? line.purchaseId)),
                    quantity: positiveNumber(line.quantity, 1),
                  }),
                )
                .filter(
                  (line: {
                    itemId?: string;
                    quantity: number;
                  }): line is { itemId: string; quantity: number } =>
                    Boolean(line.itemId),
                )
            : [];
          if (!String(row.name ?? "").trim() || !lines.length) continue;
          await tx.pack.create({
            data: {
              userId: user.id,
              name: String(row.name).trim(),
              code: String(row.code ?? "").trim() || null,
              location: String(row.location ?? "").trim() || null,
              expiresAt: row.expiresAt
                ? new Date(`${String(row.expiresAt)}T00:00:00`)
                : null,
              items: { create: lines },
            },
          });
          packsImported += 1;
        }
        return {
          planned: plannedIds.size,
          purchases: itemIds.size,
          members: memberRows.length,
          packs: packsImported,
        };
      });
      return NextResponse.json({ ok: true, imported });
    }
    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (error) {
    const status =
      error instanceof Error && error.message === "UNAUTHORIZED" ? 401 : 400;
    return NextResponse.json(
      { error: status === 401 ? "Unauthorized" : "Invalid request" },
      { status },
    );
  }
}
