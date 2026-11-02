"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Check,
  PackagePlus,
  Search,
  ShoppingCart,
  X,
} from "lucide-react";
import { initialCatalog, isEquipmentItem, isEquipmentName, type CatalogItem } from "@/lib/catalog";

type Planned = CatalogItem & { id: string };
type Purchase = {
  id: string;
  name: string;
  detail?: string | null;
  category?: string | null;
  quantity: number;
  unit: string;
  expiresAt: string;
};
type ShoppingLine = {
  id: string;
  plannedStockId: string;
  name: string;
  desiredQuantity: number;
  purchasedQuantity: number;
  remainingQuantity: number;
  unit: string;
};
const stockKey = "reservaclara-stock-v1";
const shoppingKey = "reservaclara-shopping-list-v1";

export function ShoppingListManager() {
  const [planned, setPlanned] = useState<Planned[]>([]);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("Todas");
  const [buying, setBuying] = useState<Planned | null>(null);
  const [adding, setAdding] = useState<Planned | null>(null);
  const [shoppingItemId, setShoppingItemId] = useState<string | null>(null);
  const [shoppingList, setShoppingList] = useState<ShoppingLine[]>([]);
  const [notice, setNotice] = useState("");
  useEffect(() => {
    const saved = localStorage.getItem(stockKey);
    if (saved) {
      const parsed = JSON.parse(saved);
      setPlanned((parsed.planned ?? []).filter((item: Planned) => !isEquipmentItem(item)));
      setPurchases((parsed.purchases ?? []).filter((item: Purchase) => item.category !== "Equipamiento y energía" && !isEquipmentName(item.name)));
    } else
      setPlanned(
        initialCatalog.filter((item) => !isEquipmentItem(item)).map((item, index) => ({
          ...item,
          id: `${item.name}-${index}`,
        })),
      );
    const savedShopping = localStorage.getItem(shoppingKey);
    if (savedShopping) setShoppingList(JSON.parse(savedShopping));
    fetch("/api/workspace")
      .then(async (response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (!data) return;
        setPlanned((data.planned ?? []).filter((item: Planned) => !isEquipmentItem(item)));
        setPurchases((data.purchases ?? []).filter((item: Purchase) => item.category !== "Equipamiento y energía" && !isEquipmentName(item.name)));
        setShoppingList(data.shoppingList ?? []);
      })
      .catch(() => undefined);
  }, []);
  useEffect(() => {
    if (planned.length || purchases.length)
      localStorage.setItem(stockKey, JSON.stringify({ planned, purchases }));
  }, [planned, purchases]);
  useEffect(() => {
    localStorage.setItem(shoppingKey, JSON.stringify(shoppingList));
  }, [shoppingList]);
  const purchasedByName = useMemo(
    () =>
      purchases.reduce<Record<string, number>>((result, item) => {
        result[item.name] = (result[item.name] ?? 0) + item.quantity;
        return result;
      }, {}),
    [purchases],
  );
  const pending = useCallback(
    (item: Planned) =>
      Math.max(item.plannedQuantity - (purchasedByName[item.name] ?? 0), 0),
    [purchasedByName],
  );
  const categories = useMemo(
    () => [
      "Todas",
      ...Array.from(new Set(planned.map((item) => item.category))),
    ],
    [planned],
  );
  const rows = useMemo(
    () =>
      planned.filter(
        (item) =>
          pending(item) > 0 &&
          (category === "Todas" || item.category === category) &&
          item.name
            .toLocaleLowerCase("es")
            .includes(query.toLocaleLowerCase("es")),
      ),
    [planned, category, query, pending],
  );
  const totalPending = planned.reduce(
    (total, item) => total + pending(item),
    0,
  );
  const buyingLimit = buying
    ? shoppingItemId
      ? shoppingList.find((line) => line.id === shoppingItemId)?.remainingQuantity ?? pending(buying)
      : pending(buying)
    : 0;
  function flash(message: string) {
    setNotice(message);
    window.setTimeout(() => setNotice(""), 2600);
  }
  async function addToShoppingList(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!adding) return;
    const quantity = Number(new FormData(event.currentTarget).get("quantity"));
    if (!quantity || quantity <= 0 || quantity > pending(adding)) return;
    const response = await fetch("/api/workspace", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "addShoppingItem", plannedStockId: adding.id, quantity }),
    }).catch(() => null);
    const serverLine = response?.ok ? await response.json() : null;
    const existing = shoppingList.find((line) => line.plannedStockId === adding.id);
    const line: ShoppingLine = serverLine ?? {
      id: existing?.id ?? crypto.randomUUID(),
      plannedStockId: adding.id,
      name: adding.name,
      desiredQuantity: Math.min(pending(adding), (existing?.desiredQuantity ?? 0) + quantity),
      purchasedQuantity: existing?.purchasedQuantity ?? 0,
      remainingQuantity: Math.min(pending(adding), (existing?.desiredQuantity ?? 0) + quantity) - (existing?.purchasedQuantity ?? 0),
      unit: adding.unit,
    };
    setShoppingList((current) => [...current.filter((item) => item.plannedStockId !== adding.id), line]);
    setAdding(null);
    flash(`${adding.name} añadido a la lista de compra`);
  }
  async function removeFromShoppingList(line: ShoppingLine) {
    await fetch("/api/workspace", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "removeShoppingItem", id: line.id }) }).catch(() => undefined);
    setShoppingList((current) => current.filter((item) => item.id !== line.id));
    flash(`${line.name} retirado de la lista`);
  }
  function openShoppingPurchase(line: ShoppingLine) {
    const item = planned.find((candidate) => candidate.id === line.plannedStockId);
    if (!item) return;
    setShoppingItemId(line.id);
    setBuying(item);
  }
  async function registerPurchase(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!buying) return;
    const form = new FormData(event.currentTarget);
    const quantity = Number(form.get("quantity"));
    const expiresAt = String(form.get("expiresAt") ?? "");
    const detail = String(form.get("detail") ?? "").trim();
    if (!quantity || quantity <= 0 || !expiresAt) return;
    const response = await fetch("/api/workspace", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "createPurchase",
        plannedStockId: buying.id,
        quantity,
        expiresAt,
        detail,
        shoppingItemId,
      }),
    }).catch(() => null);
    if (response && !response.ok) return flash("No se pudo registrar la compra");
    const serverItem = response?.ok ? await response.json() : null;
    setPurchases((current) => [
      ...current,
      {
        id: serverItem?.id ?? crypto.randomUUID(),
        name: buying.name,
        detail,
        quantity,
        unit: buying.unit,
        expiresAt,
      },
    ]);
    if (shoppingItemId) {
      setShoppingList((current) => current.flatMap((line) => {
        if (line.id !== shoppingItemId) return [line];
        const purchasedQuantity = line.purchasedQuantity + quantity;
        return purchasedQuantity >= line.desiredQuantity ? [] : [{ ...line, purchasedQuantity, remainingQuantity: line.desiredQuantity - purchasedQuantity }];
      }));
    }
    flash(`${buying.name} añadido al inventario`);
    setBuying(null);
    setShoppingItemId(null);
  }
  return (
    <div>
      <div className="mb-8 flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-600">
            Acción pendiente
          </p>
          <h2 className="mt-2 text-3xl font-bold tracking-tight text-slate-950">
            Lista de compra
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
            Aquí solo aparecen los alimentos cuyo inventario está por debajo del
            objetivo de Stock a completar. No es otro inventario: es la
            diferencia que falta comprar.
          </p>
        </div>
        <Link
          href="/dashboard/inventario"
          className="flex w-fit items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 hover:border-emerald-300 hover:text-emerald-700"
        >
          Ver inventario
        </Link>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Líneas pendientes" value={String(rows.length)} />
        <Stat
          label="Unidades pendientes"
          value={`${totalPending.toLocaleString("es-ES")} uds.`}
        />
        <Stat label="Fuente" value="Stock objetivo" />
      </div>
      <div className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm leading-6 text-emerald-800">
        <strong>Flujo:</strong> objetivo planificado → lista de compra →
        registro de compra con caducidad → inventario real. Al consumir una
        unidad, vuelve automáticamente a esta lista.
      </div>
      <section className="mt-6 overflow-hidden rounded-2xl border border-amber-200 bg-white shadow-sm">
        <div className="flex items-center justify-between gap-4 border-b border-amber-100 bg-amber-50 p-5">
          <div>
            <h3 className="font-bold text-slate-900">Mi lista para la próxima compra</h3>
            <p className="mt-1 text-sm text-slate-600">Solo contiene artículos que todavía tienen stock pendiente.</p>
          </div>
          <ShoppingCart className="text-amber-600" size={22} />
        </div>
        <div className="divide-y divide-slate-100">
          {shoppingList.map((line) => (
            <div key={line.id} className="flex items-center justify-between gap-4 p-5">
              <div>
                <p className="font-semibold text-slate-800">{line.name}</p>
                <p className="mt-1 text-xs text-slate-500">{line.remainingQuantity} {line.unit} por comprar ahora</p>
              </div>
              <div className="flex shrink-0 gap-2">
                <button onClick={() => openShoppingPurchase(line)} className="rounded-xl bg-emerald-600 px-3 py-2 text-xs font-bold text-white">Completar compra</button>
                <button onClick={() => removeFromShoppingList(line)} aria-label={`Quitar ${line.name} de la lista`} className="rounded-xl p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-600"><X size={16} /></button>
              </div>
            </div>
          ))}
          {shoppingList.length === 0 && <p className="p-6 text-sm text-slate-500">Todavía no has preparado una lista. Añade desde las líneas pendientes.</p>}
        </div>
      </section>
      <section className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-slate-100 p-5 sm:flex-row">
          <div className="relative min-w-0 flex-1">
            <Search
              className="absolute left-3 top-2.5 text-slate-400"
              size={16}
            />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar alimento pendiente..."
              className="h-10 w-full rounded-lg border border-slate-200 bg-slate-50 pl-9 pr-3 text-sm outline-none focus:border-emerald-500"
            />
          </div>
          <select
            value={category}
            onChange={(event) => setCategory(event.target.value)}
            className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm sm:w-56"
          >
            {categories.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
        </div>
        <div className="hidden grid-cols-[1.5fr_1fr_1fr_1fr_auto] gap-4 border-b border-slate-100 bg-slate-50 px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-400 sm:grid">
          <span>Alimento</span>
          <span>Objetivo</span>
          <span>Comprado</span>
          <span>Falta</span>
          <span />
        </div>
        {rows.map((item) => (
          <div
            key={item.id}
            className="grid gap-3 border-b border-slate-100 px-5 py-4 last:border-0 sm:grid-cols-[1.5fr_1fr_1fr_1fr_auto] sm:items-center sm:gap-4"
          >
            <div>
              <p className="font-semibold text-slate-800">{item.name}</p>
              <p className="text-xs text-slate-400">{item.category}</p>
            </div>
            <span className="text-sm text-slate-600">
              {item.plannedQuantity} {item.unit}
            </span>
            <span className="text-sm text-slate-600">
              {purchasedByName[item.name] ?? 0} {item.unit}
            </span>
            <span className="font-bold text-amber-600">
              {pending(item)} {item.unit}
            </span>
            <button
              onClick={() => setAdding(item)}
              className="flex w-fit items-center gap-1 rounded-lg bg-emerald-50 px-2.5 py-1.5 text-xs font-bold text-emerald-700"
            >
              <PackagePlus size={14} />
              Añadir a lista
            </button>
          </div>
        ))}
        {rows.length === 0 && (
          <div className="p-12 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
              <Check size={24} />
            </div>
            <h3 className="mt-4 font-bold text-slate-900">Stock completo</h3>
            <p className="mt-1 text-sm text-slate-500">
              No hay compras pendientes con los filtros actuales.
            </p>
          </div>
        )}
      </section>
      {adding && (
        <Modal title={`Añadir a la lista: ${adding.name}`} onClose={() => setAdding(null)}>
          <form onSubmit={addToShoppingList} className="space-y-4">
            <label className="block text-sm font-semibold">
              Cantidad que vas a comprar
              <input name="quantity" type="number" min="0.01" max={pending(adding)} step="0.01" defaultValue={Math.min(pending(adding), 1)} required className="mt-1.5 h-11 w-full rounded-xl border border-slate-200 px-3 outline-none focus:border-emerald-500" />
              <span className="mt-1 block text-xs font-normal text-slate-400">Puedes añadirla varias veces mientras siga existiendo stock pendiente.</span>
            </label>
            <p className="rounded-lg bg-blue-50 p-3 text-xs leading-5 text-blue-800">Pendiente total de {adding.name}: {pending(adding)} {adding.unit}.</p>
            <button className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 text-sm font-bold text-white"><ShoppingCart size={16} />Añadir a mi lista</button>
          </form>
        </Modal>
      )}
      {buying && (
        <Modal
          title={`Completar compra: ${buying.name}`}
          onClose={() => { setBuying(null); setShoppingItemId(null); }}
        >
          <form onSubmit={registerPurchase} className="space-y-4">
            <label className="block text-sm font-semibold">
              Cantidad de esta compra
              <input
                name="quantity"
                type="number"
                min="0.01"
                max={buyingLimit}
                step="0.01"
                defaultValue={Math.min(buyingLimit, 1)}
                required
                className="mt-1.5 h-11 w-full rounded-xl border border-slate-200 px-3 outline-none focus:border-emerald-500"
              />
            </label>
            <label className="block text-sm font-semibold">
              Detalle opcional
              <input name="detail" placeholder="Ej. macarrones, fideos, bote de 500 g" className="mt-1.5 h-11 w-full rounded-xl border border-slate-200 px-3 outline-none focus:border-emerald-500" />
              <span className="mt-1 block text-xs font-normal text-slate-400">Variedad, formato o tipo de envase.</span>
            </label>
            <label className="block text-sm font-semibold">
              {buying.category === "Equipamiento y energía" ? "Fecha de revisión / sustitución" : "Fecha de caducidad"}
              <input
                name="expiresAt"
                type="date"
                required
                className="mt-1.5 h-11 w-full rounded-xl border border-slate-200 px-3 outline-none focus:border-emerald-500"
              />
            </label>
            <p className="flex gap-2 rounded-lg bg-amber-50 p-3 text-xs leading-5 text-amber-800">
              <AlertTriangle size={15} className="shrink-0" />
              {buying.category === "Equipamiento y energía" ? "La fecha de revisión o sustitución es obligatoria para controlar el equipo." : "La caducidad es obligatoria para dar de alta el lote."}
            </p>
            <button className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 text-sm font-bold text-white">
              <ShoppingCart size={16} />
              Guardar compra
            </button>
          </form>
        </Modal>
      )}
      {notice && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white shadow-xl">
          <Check size={16} className="text-emerald-400" />
          {notice}
        </div>
      )}
    </div>
  );
}
function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-bold text-slate-950">{value}</p>
    </div>
  );
}
function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", closeOnEscape);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", closeOnEscape);
      document.body.style.overflow = previousOverflow;
    };
  }, [onClose]);
  return (
    <div
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/30 p-5 backdrop-blur-sm"
    >
      <div
        role="dialog"
        aria-modal="true"
        className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl"
      >
        <div className="mb-6 flex items-start justify-between">
          <div>
            <h2 className="text-lg font-bold">{title}</h2>
            <p className="mt-1 text-sm text-slate-500">
              Se actualiza el mismo inventario de tu espacio.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar ventana"
            title="Cerrar"
            className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            <X size={19} />
          </button>
        </div>
        {children}
        <button
          type="button"
          onClick={onClose}
          className="mt-3 w-full rounded-xl py-2 text-sm font-semibold text-slate-500 hover:bg-slate-50 hover:text-slate-800"
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}
