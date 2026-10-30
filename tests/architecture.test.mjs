import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (file) => readFile(new URL(`../${file}`, import.meta.url), "utf8");

test("el esquema cubre los dominios persistentes de ReservaClara", async () => {
  const schema = await read("prisma/schema.prisma");
  for (const model of ["User", "Category", "PlannedStock", "Item", "Pack", "PackItem", "HouseholdMember", "NutritionSettings", "AlertSettings"]) {
    assert.match(schema, new RegExp(`model ${model}\\s*\\{`));
  }
  assert.match(schema, /age\s+Int/);
  assert.match(schema, /detail\s+String\?/);
  assert.match(schema, /@@unique\(\[userId, normalizedName\]\)/);
  assert.match(schema, /plannedStockId\s+String\?/);
});

test("las mutaciones de workspace exigen sesión y aíslan los recursos por usuario", async () => {
  const route = await read("src/app/api/workspace/route.ts");
  assert.match(route, /requireSession\(\)/);
  assert.match(route, /userId: user\.id/);
  assert.match(route, /action === "createPack"/);
  assert.match(route, /action === "importSnapshot"/);
  assert.match(route, /Pack quantity exceeds inventory/);
  assert.match(route, /Consumption exceeds available quantity/);
  assert.match(route, /action === "updatePurchase"/);
  assert.match(route, /action === "addShoppingItem"/);
  assert.match(route, /Purchase exceeds shopping list quantity/);
  assert.match(route, /db\.\$transaction/);
});

test("la navegación expone la revisión de información incompleta", async () => {
  const shell = await read("src/components/app-shell.tsx");
  const section = await read("src/app/dashboard/[section]/page.tsx");
  assert.match(shell, /Revisar datos/);
  assert.match(shell, /DataReviewManager/);
  assert.match(section, /revisar: "Revisar datos"/);
});

test("packs separa los lotes por detalle y conserva la selección individual", async () => {
  const packs = await read("src/components/pack-manager.tsx");
  assert.match(packs, /detailGroups/);
  assert.match(packs, /__sin_detalle__/);
  assert.match(packs, /Añadir lote/);
});

test("el catálogo base incluye equipamiento mínimo para emergencias", async () => {
  const catalog = await read("src/lib/catalog.ts");
  for (const item of ["Hornillo portátil", "Cartuchos de gas para hornillo", "Linterna LED", "Botiquín completo", "Extintor"]) {
    assert.match(catalog, new RegExp(item));
  }
  assert.match(catalog, /Equipamiento y energía/);
});

test("el cron de correo permanece separado de la API de workspace", async () => {
  const workspace = await read("src/app/api/workspace/route.ts");
  assert.doesNotMatch(workspace, /Resend/);
  assert.doesNotMatch(workspace, /RESEND_API_KEY/);
});
