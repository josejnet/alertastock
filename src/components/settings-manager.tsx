"use client";

import {
  ChangeEvent,
  FormEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  AlertTriangle,
  Check,
  Download,
  FolderPlus,
  Plus,
  Trash2,
  Upload,
} from "lucide-react";
import { initialCatalog, type CatalogItem } from "@/lib/catalog";

type MasterFood = CatalogItem & { id: string };
type Purchase = {
  id: string;
  name: string;
  detail?: string | null;
  quantity: number;
  unit: string;
  expiresAt: string;
};
const stockKey = "reservaclara-stock-v1";
const masterKey = "reservaclara-master-v1";
const categoryKey = "reservaclara-categories-v1";
const normalize = (value: string) => value.trim().toLocaleLowerCase("es");

export function SettingsManager() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [foods, setFoods] = useState<MasterFood[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [planned, setPlanned] = useState<MasterFood[]>([]);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [foodName, setFoodName] = useState("");
  const [foodCategory, setFoodCategory] = useState("");
  const [foodQty, setFoodQty] = useState("1");
  const [newCategory, setNewCategory] = useState("");
  const [notice, setNotice] = useState("");
  const [importResult, setImportResult] = useState<{
    added: number;
    rejected: string[];
  } | null>(null);

  useEffect(() => {
    const stock = JSON.parse(localStorage.getItem(stockKey) ?? "{}");
    setFoods(
      JSON.parse(
        localStorage.getItem(masterKey) ??
          JSON.stringify(
            initialCatalog.map((food, index) => ({
              ...food,
              id: `${food.name}-${index}`,
            })),
          ),
      ),
    );
    setCategories(
      JSON.parse(
        localStorage.getItem(categoryKey) ??
          JSON.stringify(
            Array.from(new Set(initialCatalog.map((food) => food.category))),
          ),
      ),
    );
    setPlanned(stock.planned ?? []);
    setPurchases(stock.purchases ?? []);
    fetch("/api/workspace")
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (!data) return;
        const serverPlanned = data.planned.map((item: MasterFood) => ({
          ...item,
          plannedQuantity: item.plannedQuantity,
          category: item.category,
        }));
        setPlanned(serverPlanned);
        setFoods(serverPlanned);
        setCategories(
          data.categories.map((category: { name: string }) => category.name),
        );
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (foods.length) localStorage.setItem(masterKey, JSON.stringify(foods));
    if (categories.length)
      localStorage.setItem(categoryKey, JSON.stringify(categories));
  }, [foods, categories]);

  const plannedNames = useMemo(
    () => new Set(planned.map((item) => normalize(item.name))),
    [planned],
  );

  function flash(message: string) {
    setNotice(message);
    window.setTimeout(() => setNotice(""), 3000);
  }
  function saveStock(nextPlanned: MasterFood[], nextPurchases: Purchase[]) {
    setPlanned(nextPlanned);
    setPurchases(nextPurchases);
    localStorage.setItem(
      stockKey,
      JSON.stringify({ planned: nextPlanned, purchases: nextPurchases }),
    );
  }

  function addFood(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = foodName.trim();
    if (!name || !foodCategory) return;
    if (foods.some((food) => normalize(food.name) === normalize(name)))
      return flash("Ese alimento ya existe en el maestro");
    setFoods((current) => [
      ...current,
      {
        id: crypto.randomUUID(),
        name,
        category: foodCategory,
        plannedQuantity: Number(foodQty) || 1,
        unit: "unidades",
      },
    ]);
    setFoodName("");
    flash(`${name} añadido al Maestro de Alimentos`);
  }

  async function addCategory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = newCategory.trim();
    if (
      !name ||
      categories.some((category) => normalize(category) === normalize(name))
    )
      return;
    await fetch("/api/workspace", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "createCategory", name }),
    }).catch(() => undefined);
    setCategories((current) => [...current, name]);
    setFoodCategory(name);
    setNewCategory("");
    flash(`Categoría ${name} creada`);
  }

  async function addToPlan(food: MasterFood) {
    if (plannedNames.has(normalize(food.name)))
      return flash("Ese alimento ya está en Stock a completar");
    const category = await fetch("/api/workspace", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "createPlanned",
        name: food.name,
        quantity: food.plannedQuantity,
        unit: food.unit,
        categoryName: food.category,
      }),
    })
      .then((response) => (response.ok ? response.json() : null))
      .catch(() => null);
    if (category?.id) food = { ...food, id: category.id };
    saveStock([...planned, food], purchases);
    flash(`${food.name} añadido a Stock a completar`);
  }

  function removeFood(food: MasterFood) {
    if (plannedNames.has(normalize(food.name)))
      return flash("Primero quita el alimento de Stock a completar");
    setFoods((current) =>
      current.filter((candidate) => candidate.id !== food.id),
    );
    flash(`${food.name} eliminado del maestro`);
  }

  function exportCsv() {
    const rows = [["alimento", "unidades_compradas", "fecha_caducidad", "detalle"]];
    const byName = purchases.reduce<Record<string, Purchase[]>>(
      (result, purchase) => {
        (result[normalize(purchase.name)] ??= []).push(purchase);
        return result;
      },
      {},
    );
    planned.forEach((item) => {
      const batches = byName[normalize(item.name)] ?? [];
      if (!batches.length) rows.push([item.name, "0", "", ""]);
      else
        batches.forEach((batch) =>
          rows.push([
            batch.name,
            String(batch.quantity).replace(".", ","),
            batch.expiresAt,
            batch.detail ?? "",
          ]),
        );
    });
    const csv = rows
      .map((row) =>
        row.map((value) => `"${value.replaceAll('"', '""')}"`).join(";"),
      )
      .join("\r\n");
    const url = URL.createObjectURL(
      new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = "reservaclara_stock_a_completar.csv";
    link.click();
    URL.revokeObjectURL(url);
    flash("Stock exportado en CSV");
  }

  async function importCsv(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    const rows = (await file.text())
      .replace(/^\ufeff/, "")
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
    const dataRows = rows[0]?.toLocaleLowerCase().includes("alimento")
      ? rows.slice(1)
      : rows;
    const nextPlanned = [...planned];
    const nextPurchases = [...purchases];
    const importedPurchases: Purchase[] = [];
    const rejected: string[] = [];
    let added = 0;
    dataRows.forEach((row, index) => {
      const columns = row
        .split(";")
        .map((value) => value.trim().replace(/^"|"$/g, ""));
      if (columns.length !== 3 && columns.length !== 4)
        return rejected.push(
          `Línea ${index + 1}: deben existir 3 columnas obligatorias y una cuarta opcional`,
        );
      const [name, quantityText, expiresAt, detail = ""] = columns;
      const quantity = Number(quantityText.replace(",", "."));
      if (!name || !Number.isFinite(quantity) || quantity < 0)
        return rejected.push(
          `Línea ${index + 1}: alimento o cantidad inválida`,
        );
      if (quantity > 0 && !/^\d{4}-\d{2}-\d{2}$/.test(expiresAt))
        return rejected.push(
          `Línea ${index + 1}: caducidad obligatoria en formato AAAA-MM-DD`,
        );
      let plan = nextPlanned.find(
        (item) => normalize(item.name) === normalize(name),
      );
      if (!plan) {
        const master = foods.find(
          (food) => normalize(food.name) === normalize(name),
        );
        if (!master)
          return rejected.push(
            `Línea ${index + 1}: ${name} no existe en el Maestro de Alimentos`,
          );
        plan = { ...master };
        nextPlanned.push(plan);
      }
      if (quantity > 0) {
        const purchase = {
          id: crypto.randomUUID(),
          name: plan.name,
          detail,
          quantity,
          unit: plan.unit,
          expiresAt,
        };
        nextPurchases.push(purchase);
        importedPurchases.push(purchase);
        added += 1;
      }
    });
    saveStock(nextPlanned, nextPurchases);
    if (importedPurchases.length) fetch("/api/workspace", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "importPurchases", planned: nextPlanned, purchases: importedPurchases }) }).catch(() => undefined);
    setImportResult({ added, rejected });
    if (!rejected.length) flash(`${added} líneas importadas correctamente`);
    event.target.value = "";
  }

  return (
    <div>
      <div className="mb-8">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-600">
          Gestión de tu espacio
        </p>
        <h2 className="mt-2 text-3xl font-bold tracking-tight text-slate-950">
          Configuración útil, no decorativa.
        </h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
          Aquí controlas el catálogo permitido, las categorías y las cargas
          masivas de tu stock. Un alimento solo puede entrar en inventario si
          antes pertenece a Stock a completar.
        </p>
      </div>
      <div className="grid gap-6 xl:grid-cols-2">
        <section className="min-w-0 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="font-bold">Maestro de Alimentos</h3>
              <p className="mt-1 text-xs text-slate-500">
                Catálogo permitido para tu reserva.
              </p>
            </div>
            <FolderPlus className="text-emerald-500" size={19} />
          </div>
          <form
            onSubmit={addFood}
            className="mt-5 grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_76px_auto]"
          >
            <input
              value={foodName}
              onChange={(event) => setFoodName(event.target.value)}
              required
              placeholder="Nuevo alimento"
              className="h-10 min-w-0 rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-emerald-500"
            />
            <select
              value={foodCategory}
              onChange={(event) => setFoodCategory(event.target.value)}
              required
              className="h-10 min-w-0 rounded-lg border border-slate-200 bg-white px-3 text-sm"
            >
              <option value="">Categoría</option>
              {categories.map((category) => (
                <option key={category}>{category}</option>
              ))}
            </select>
            <input
              value={foodQty}
              onChange={(event) => setFoodQty(event.target.value)}
              type="number"
              min="0.01"
              step="0.01"
              className="h-10 min-w-0 rounded-lg border border-slate-200 px-3 text-sm"
              title="Objetivo inicial"
            />
            <button className="flex h-10 min-w-0 items-center justify-center gap-1 whitespace-nowrap rounded-lg bg-emerald-600 px-3 text-xs font-bold text-white">
              <Plus size={14} />
              Crear
            </button>
          </form>
          <div className="mt-5 max-h-[430px] space-y-2 overflow-y-auto overscroll-contain px-0.5 pb-1 pt-1 pr-2">
            {foods.map((food) => (
              <div
                key={food.id}
                className="flex min-w-0 items-center gap-3 rounded-xl border border-slate-100 p-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-slate-700">
                    {food.name}
                  </p>
                  <p className="truncate text-xs text-slate-400">
                    {food.category} · objetivo {food.plannedQuantity}{" "}
                    {food.unit}
                  </p>
                </div>
                {plannedNames.has(normalize(food.name)) ? (
                  <span className="shrink-0 rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-bold text-emerald-700">
                    En objetivo
                  </span>
                ) : (
                  <button
                    onClick={() => addToPlan(food)}
                    className="shrink-0 rounded-lg bg-emerald-50 px-2.5 py-1.5 text-xs font-bold text-emerald-700"
                  >
                    Añadir al objetivo
                  </button>
                )}
                <button
                  onClick={() => removeFood(food)}
                  aria-label={`Eliminar ${food.name}`}
                  className="shrink-0 rounded-lg p-1.5 text-slate-300 hover:bg-rose-50 hover:text-rose-600"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            ))}
          </div>
        </section>
        <section className="min-w-0 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="font-bold">Categorías</h3>
              <p className="mt-1 text-xs text-slate-500">
                Organiza el maestro y el stock planificado.
              </p>
            </div>
            <FolderPlus className="text-blue-500" size={19} />
          </div>
          <form onSubmit={addCategory} className="mt-5 flex min-w-0 gap-2">
            <input
              value={newCategory}
              onChange={(event) => setNewCategory(event.target.value)}
              required
              placeholder="Nueva categoría"
              className="h-10 min-w-0 flex-1 rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-emerald-500"
            />
            <button className="flex h-10 shrink-0 items-center gap-1 rounded-lg bg-slate-900 px-3 text-xs font-bold text-white">
              <Plus size={14} />
              Crear
            </button>
          </form>
          <div className="mt-5 grid gap-2 sm:grid-cols-2">
            {categories.map((category) => (
              <div
                key={category}
                className="flex min-w-0 items-center justify-between gap-2 rounded-xl bg-slate-50 px-3 py-3 text-sm font-semibold text-slate-700"
              >
                <span className="truncate">{category}</span>
                <span className="shrink-0 text-xs text-slate-400">
                  {foods.filter((food) => food.category === category).length}{" "}
                  alimentos
                </span>
              </div>
            ))}
          </div>
          <div className="mt-6 rounded-xl bg-slate-50 p-4 text-xs leading-5 text-slate-500">
            Las categorías se aplican a nuevas líneas del Maestro de Alimentos.
            Las líneas que ya están en el objetivo no se borran al editar el
            catálogo.
          </div>
        </section>
      </div>
      <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
          <div>
            <h3 className="font-bold">Importación incremental</h3>
            <p className="mt-1 max-w-2xl text-xs leading-5 text-slate-500">
              Exporta el objetivo actual, completa compras y caducidades, y
              vuelve a cargar el CSV. Las compras se suman; no reemplazan las
              anteriores.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={exportCsv}
              className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2.5 text-xs font-bold text-slate-700"
            >
              <Download size={15} />
              Exportar CSV
            </button>
            <button
              onClick={() => fileRef.current?.click()}
              className="flex items-center gap-2 rounded-xl bg-emerald-600 px-3 py-2.5 text-xs font-bold text-white"
            >
              <Upload size={15} />
              Importar CSV
            </button>
            <input
              ref={fileRef}
              onChange={importCsv}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
            />
          </div>
        </div>
        <div className="mt-5 grid gap-3 md:grid-cols-4">
          <Column
            label="alimento"
            description="Debe estar en el Maestro de Alimentos."
          />
          <Column
            label="unidades_compradas"
            description="Número comprado en esta carga. Usa 0 para dejarlo pendiente."
          />
          <Column
            label="fecha_caducidad"
            description="Obligatoria si unidades_compradas es mayor que 0. Formato AAAA-MM-DD."
          />
          <Column
            label="detalle (opcional)"
            description="Variedad, formato o envase: macarrones, fideos, bote de 500 g."
          />
        </div>
        {importResult && (
          <div className="mt-5 rounded-xl border border-slate-200 p-4 text-sm">
            <p className="flex items-center gap-2 font-bold text-emerald-700">
              <Check size={16} />
              {importResult.added} líneas de compra importadas
            </p>
            {importResult.rejected.length > 0 && (
              <div className="mt-3 text-rose-700">
                <p className="flex items-center gap-2 font-semibold">
                  <AlertTriangle size={15} />
                  Filas rechazadas
                </p>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-xs">
                  {importResult.rejected.map((error) => (
                    <li key={error}>{error}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </section>
      {notice && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white shadow-xl">
          <Check size={16} className="text-emerald-400" />
          {notice}
        </div>
      )}
    </div>
  );
}

function Column({
  label,
  description,
}: {
  label: string;
  description: string;
}) {
  return (
    <div className="rounded-xl bg-slate-50 p-3">
      <code className="text-xs font-bold text-slate-700">{label}</code>
      <p className="mt-1 text-xs leading-5 text-slate-500">{description}</p>
    </div>
  );
}
