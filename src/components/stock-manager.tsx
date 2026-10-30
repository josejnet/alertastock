"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Check,
  Minus,
  PackagePlus,
  Pencil,
  Plus,
  Trash2,
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
const key = "reservaclara-stock-v1";

export function StockManager() {
  const [planned, setPlanned] = useState<Planned[]>([]);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [showPurchase, setShowPurchase] = useState<CatalogItem | null>(null);
  const [showPurchaseEdit, setShowPurchaseEdit] = useState<Purchase | null>(null);
  const [showEdit, setShowEdit] = useState<Planned | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [notice, setNotice] = useState("");
  useEffect(() => {
    const saved = localStorage.getItem(key);
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
    fetch("/api/workspace")
      .then(async (response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (!data) return;
        setPlanned((data.planned ?? []).filter((item: Planned) => !isEquipmentItem(item)));
        setPurchases((data.purchases ?? []).filter((item: Purchase) => item.category !== "Equipamiento y energía" && !isEquipmentName(item.name)));
      })
      .catch(() => undefined);
  }, []);
  useEffect(() => {
    if (planned.length || purchases.length)
      localStorage.setItem(key, JSON.stringify({ planned, purchases }));
  }, [planned, purchases]);
  const purchasedByName = useMemo(
    () =>
      purchases.reduce<Record<string, number>>((acc, item) => {
        acc[item.name] = (acc[item.name] ?? 0) + item.quantity;
        return acc;
      }, {}),
    [purchases],
  );
  const pending = (item: Planned) =>
    Math.max(item.plannedQuantity - (purchasedByName[item.name] ?? 0), 0);
  const totalPending = planned.reduce((sum, item) => sum + pending(item), 0);
  function flash(message: string) {
    setNotice(message);
    window.setTimeout(() => setNotice(""), 2600);
  }
  async function purchase(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!showPurchase) return;
    const form = new FormData(event.currentTarget);
    const quantity = Number(form.get("quantity"));
    const expiresAt = String(form.get("expiresAt"));
    const detail = String(form.get("detail") ?? "").trim();
    if (!quantity || !expiresAt) return;
    const plannedStock = planned.find(
      (item) => item.name === showPurchase.name,
    );
    const response = plannedStock
      ? await fetch("/api/workspace", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "createPurchase",
            plannedStockId: plannedStock.id,
            quantity,
            expiresAt,
            detail,
          }),
        }).catch(() => null)
      : null;
    const serverItem = response?.ok ? await response.json() : null;
    setPurchases((current) => [
      ...current,
      {
        id: serverItem?.id ?? crypto.randomUUID(),
        name: showPurchase.name,
        detail,
        quantity,
        unit: showPurchase.unit,
        expiresAt,
      },
    ]);
    setShowPurchase(null);
    flash(`${showPurchase.name} añadido al inventario`);
  }
  function consume(item: Purchase) {
    const next = purchases.flatMap((candidate) =>
      candidate.id !== item.id
        ? [candidate]
        : candidate.quantity > 1
          ? [{ ...candidate, quantity: candidate.quantity - 1 }]
          : [],
    );
    setPurchases(next);
    fetch("/api/workspace", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "consume", itemId: item.id, quantity: 1 }),
    }).catch(() => undefined);
    flash(`${item.name} vuelve a stock pendiente`);
  }
  async function addPlanned(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const name = String(form.get("name")).trim();
    const quantity = Number(form.get("quantity"));
    const unit = String(form.get("unit"));
    const category = String(form.get("category"));
    if (
      !name ||
      !quantity ||
      planned.some(
        (item) =>
          item.name.toLocaleLowerCase("es") === name.toLocaleLowerCase("es"),
      )
    )
      return flash("Ese alimento ya está en Stock a completar");
    const response = await fetch("/api/workspace", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "createPlanned",
        name,
        quantity,
        unit,
        categoryName: category,
      }),
    }).catch(() => null);
    const serverPlanned = response?.ok ? await response.json() : null;
    setPlanned((current) => [
      ...current,
      {
        id: serverPlanned?.id ?? crypto.randomUUID(),
        name,
        category,
        plannedQuantity: quantity,
        unit,
      },
    ]);
    setShowAdd(false);
    flash(`${name} añadido al stock a completar`);
  }
  async function removePlanned(item: Planned) {
    if ((purchasedByName[item.name] ?? 0) > 0) {
      flash("No puedes quitar una línea con inventario comprado");
      return;
    }
    await fetch("/api/workspace", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "deletePlanned", id: item.id }),
    }).catch(() => undefined);
    setPlanned((current) =>
      current.filter((candidate) => candidate.id !== item.id),
    );
    flash(`${item.name} eliminado del stock planificado`);
  }
  async function updatePlanned(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!showEdit) return;
    const form = new FormData(event.currentTarget);
    const name = String(form.get("name") ?? "").trim();
    const quantity = Number(form.get("quantity"));
    const unit = String(form.get("unit") ?? "").trim();
    const category = String(form.get("category") ?? "");
    if (!name || !quantity || !unit) return;
    const response = await fetch("/api/workspace", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "updatePlanned", id: showEdit.id, name, quantity, unit, categoryName: category }) }).catch(() => null);
    if (response && !response.ok && response.status !== 503) return flash("No se pudo actualizar el objetivo");
    setPlanned((current) => current.map((item) => item.id === showEdit.id ? { ...item, name, plannedQuantity: quantity, unit, category } : item));
    setPurchases((current) => current.map((item) => item.name === showEdit.name ? { ...item, name, unit } : item));
    setShowEdit(null); flash(`${name} actualizado en Stock a completar`);
  }
  async function updatePurchase(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!showPurchaseEdit) return;
    const form = new FormData(event.currentTarget);
    const quantity = Number(form.get("quantity"));
    const expiresAt = String(form.get("expiresAt") ?? "");
    const detail = String(form.get("detail") ?? "").trim();
    if (!quantity || !expiresAt) return flash("Cantidad y caducidad son obligatorias");
    const response = await fetch("/api/workspace", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "updatePurchase", itemId: showPurchaseEdit.id, quantity, expiresAt, detail }) }).catch(() => null);
    if (response && !response.ok && response.status !== 503) return flash("No se pudo actualizar el lote");
    setPurchases((current) => current.map((item) => item.id === showPurchaseEdit.id ? { ...item, quantity, expiresAt, detail } : item));
    setShowPurchaseEdit(null);
    flash(`${showPurchaseEdit.name} actualizado`);
  }
  return (
    <div>
      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Líneas planificadas" value={String(planned.length)} />
        <Stat
          label="Pendiente de comprar"
          value={`${totalPending.toLocaleString("es-ES")} uds.`}
        />
        <Stat label="Inventario real" value={`${purchases.length} lotes`} />
      </div>
      <div className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
        <strong>Cómo funciona:</strong> el objetivo permanece fijo. Las compras
        reducen el pendiente; los consumos reducen el inventario y vuelven a
        incrementarlo automáticamente. La caducidad es obligatoria al registrar
        una compra.
      </div>
      <div className="mt-6 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h3 className="text-lg font-bold">Stock a completar</h3>
          <p className="mt-1 text-sm text-slate-500">
            Objetivo importado de la lista de 180 días para 4 personas.
          </p>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="flex w-fit items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white"
        >
          <Plus size={16} />
          Añadir al objetivo
        </button>
      </div>
      <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div className="hidden grid-cols-[1.5fr_1fr_1fr_1fr_auto] gap-4 border-b border-slate-100 bg-slate-50 px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-400 sm:grid">
          <span>Alimento</span>
          <span>Objetivo</span>
          <span>Comprado</span>
          <span>Pendiente</span>
          <span />
        </div>
        {planned.map((item) => (
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
            <span
              className={`text-sm font-bold ${pending(item) > 0 ? "text-amber-600" : "text-emerald-600"}`}
            >
              {pending(item)} {item.unit}
            </span>
            <div className="flex gap-2">
              <button onClick={() => setShowEdit(item)} aria-label={`Editar ${item.name}`} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-800"><Pencil size={15} /></button>
              <button
                onClick={() => setShowPurchase(item)}
                className="flex items-center gap-1 rounded-lg bg-emerald-50 px-2.5 py-1.5 text-xs font-bold text-emerald-700"
              >
                <PackagePlus size={14} />
                Comprar
              </button>
              <button
                onClick={() => removePlanned(item)}
                aria-label={`Eliminar ${item.name}`}
                className="rounded-lg p-1.5 text-slate-300 hover:bg-rose-50 hover:text-rose-600"
              >
                <Trash2 size={15} />
              </button>
            </div>
          </div>
        ))}
        {planned.length === 0 && (
          <div className="p-10 text-center text-sm text-slate-500">
            No hay stock planificado. Añade una línea para empezar.
          </div>
        )}
      </div>
      <div className="mt-8">
        <h3 className="text-lg font-bold">Inventario comprado</h3>
        <p className="mt-1 text-sm text-slate-500">
          Cada lote exige fecha de caducidad y puede consumirse por separado.
        </p>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {purchases.map((item) => (
            <div
              key={item.id}
              className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-4"
            >
              <div>
                <p className="font-semibold text-slate-800">{item.name}</p>
                {item.detail && <p className="mt-1 text-xs font-medium text-emerald-700">{item.detail}</p>}
                <p className="mt-1 text-xs text-slate-500">
                  {item.quantity} {item.unit} · caduca el{" "}
                  {new Date(`${item.expiresAt}T00:00:00`).toLocaleDateString(
                    "es-ES",
                  )}
                </p>
              </div>
              <div className="flex items-center gap-2"><button onClick={() => setShowPurchaseEdit(item)} aria-label={`Editar lote de ${item.name}`} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-800"><Pencil size={15} /></button><button onClick={() => consume(item)} className="flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-bold text-slate-600 hover:border-amber-300 hover:text-amber-700"><Minus size={14} />Consumir 1</button></div>
            </div>
          ))}
          {purchases.length === 0 && (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500 md:col-span-2">
              Todavía no hay compras registradas. Usa «Comprar» en una línea del
              objetivo.
            </div>
          )}
        </div>
      </div>
      {showPurchase && (
        <Modal
          title={`Registrar compra: ${showPurchase.name}`}
          onClose={() => setShowPurchase(null)}
        >
          <form onSubmit={purchase} className="space-y-4">
            <label className="block text-sm font-semibold">
              Cantidad
              <input
                name="quantity"
                type="number"
                min="0.01"
                step="0.01"
                defaultValue={Math.min(showPurchase.plannedQuantity, 1)}
                required
                className="mt-1.5 h-11 w-full rounded-xl border border-slate-200 px-3 outline-none focus:border-emerald-500"
              />
            </label>
            <label className="block text-sm font-semibold">
              Detalle opcional
              <input name="detail" placeholder="Ej. macarrones, fideos, bote de 500 g" className="mt-1.5 h-11 w-full rounded-xl border border-slate-200 px-3 outline-none focus:border-emerald-500" />
              <span className="mt-1 block text-xs font-normal text-slate-400">Puedes indicar variedad, formato o tipo de envase.</span>
            </label>
            <label className="block text-sm font-semibold">
              {showPurchase.category === "Equipamiento y energía" ? "Fecha de revisión / sustitución" : "Fecha de caducidad"}
              <input
                name="expiresAt"
                type="date"
                required
                className="mt-1.5 h-11 w-full rounded-xl border border-slate-200 px-3 outline-none focus:border-emerald-500"
              />
            </label>
            <p className="flex gap-2 rounded-lg bg-amber-50 p-3 text-xs leading-5 text-amber-800">
              <AlertTriangle size={15} className="shrink-0" />
              {showPurchase.category === "Equipamiento y energía" ? "Indica una fecha de revisión o sustitución para mantener el equipo controlado." : "Campo obligatorio: no se puede dar de alta un lote sin caducidad."}
            </p>
            <button className="h-11 w-full rounded-xl bg-emerald-600 text-sm font-bold text-white">
              Guardar compra
            </button>
          </form>
        </Modal>
      )}
      {showAdd && (
        <Modal
          title="Añadir al stock a completar"
          onClose={() => setShowAdd(false)}
        >
          <form onSubmit={addPlanned} className="space-y-4">
            <label className="block text-sm font-semibold">
              Alimento
              <input
                name="name"
                required
                placeholder="Ej. Agua"
                className="mt-1.5 h-11 w-full rounded-xl border border-slate-200 px-3 outline-none"
              />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="block text-sm font-semibold">
                Cantidad
                <input
                  name="quantity"
                  type="number"
                  min="0.01"
                  step="0.01"
                  required
                  className="mt-1.5 h-11 w-full rounded-xl border border-slate-200 px-3 outline-none"
                />
              </label>
              <label className="block text-sm font-semibold">
                Unidad
                <input
                  name="unit"
                  defaultValue="unidades"
                  required
                  className="mt-1.5 h-11 w-full rounded-xl border border-slate-200 px-3 outline-none"
                />
              </label>
            </div>
            <label className="block text-sm font-semibold">
              Categoría
              <select
                name="category"
                className="mt-1.5 h-11 w-full rounded-xl border border-slate-200 bg-white px-3"
              >
                <option>Agua y otros</option>
                <option>Cereales y básicos</option>
                <option>Legumbres y conservas</option>
                <option>Proteínas y conservas</option>
                <option>Energía y desayunos</option>
                <option>Equipamiento y energía</option>
              </select>
            </label>
            <button className="h-11 w-full rounded-xl bg-emerald-600 text-sm font-bold text-white">
              Añadir objetivo
            </button>
          </form>
        </Modal>
      )}
      {showPurchaseEdit && (
        <Modal title={`Editar lote: ${showPurchaseEdit.name}`} onClose={() => setShowPurchaseEdit(null)}>
          <form onSubmit={updatePurchase} className="space-y-4">
            <label className="block text-sm font-semibold">Cantidad<input name="quantity" type="number" min="0.01" step="0.01" defaultValue={showPurchaseEdit.quantity} required className="mt-1.5 h-11 w-full rounded-xl border border-slate-200 px-3 outline-none focus:border-emerald-500" /></label>
            <label className="block text-sm font-semibold">Detalle opcional<input name="detail" defaultValue={showPurchaseEdit.detail ?? ""} placeholder="Ej. macarrones, fideos, bote de 500 g" className="mt-1.5 h-11 w-full rounded-xl border border-slate-200 px-3 outline-none focus:border-emerald-500" /></label>
            <label className="block text-sm font-semibold">Fecha de caducidad<input name="expiresAt" type="date" defaultValue={showPurchaseEdit.expiresAt} required className="mt-1.5 h-11 w-full rounded-xl border border-slate-200 px-3 outline-none focus:border-emerald-500" /></label>
            <button className="h-11 w-full rounded-xl bg-slate-900 text-sm font-bold text-white">Guardar lote</button>
          </form>
        </Modal>
      )}
      {showEdit && (
        <Modal title={`Editar objetivo: ${showEdit.name}`} onClose={() => setShowEdit(null)}>
          <form onSubmit={updatePlanned} className="space-y-4">
            <label className="block text-sm font-semibold">Alimento<input name="name" defaultValue={showEdit.name} required className="mt-1.5 h-11 w-full rounded-xl border border-slate-200 px-3 outline-none focus:border-emerald-500" /></label>
            <div className="grid grid-cols-2 gap-3"><label className="block text-sm font-semibold">Unidades objetivo<input name="quantity" type="number" min="0.01" step="0.01" defaultValue={showEdit.plannedQuantity} required className="mt-1.5 h-11 w-full rounded-xl border border-slate-200 px-3 outline-none" /></label><label className="block text-sm font-semibold">Unidad<input name="unit" defaultValue={showEdit.unit} required className="mt-1.5 h-11 w-full rounded-xl border border-slate-200 px-3 outline-none" /></label></div>
            <label className="block text-sm font-semibold">Categoría<select name="category" defaultValue={showEdit.category} className="mt-1.5 h-11 w-full rounded-xl border border-slate-200 bg-white px-3"><option>Agua y otros</option><option>Cereales y básicos</option><option>Legumbres y conservas</option><option>Proteínas y conservas</option><option>Energía y desayunos</option><option>Equipamiento y energía</option></select></label>
            <p className="rounded-lg bg-blue-50 p-3 text-xs leading-5 text-blue-800">Modificar el objetivo no cambia los lotes ya comprados.</p><button className="h-11 w-full rounded-xl bg-slate-900 text-sm font-bold text-white">Guardar cambios</button>
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
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
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
        aria-labelledby="modal-title"
        className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl"
      >
        <div className="mb-6 flex items-start justify-between">
          <div>
            <h2 id="modal-title" className="text-lg font-bold">
              {title}
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Los cambios se guardan en este navegador.
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
