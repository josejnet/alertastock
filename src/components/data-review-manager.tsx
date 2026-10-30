"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { Check, ClipboardPenLine, X } from "lucide-react";

type Purchase = {
  id: string;
  name: string;
  detail?: string | null;
  quantity: number;
  unit: string;
  expiresAt: string;
};

const stockKey = "reservaclara-stock-v1";

export function DataReviewManager() {
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [selected, setSelected] = useState<Purchase | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    const local = JSON.parse(localStorage.getItem(stockKey) ?? "{}");
    setPurchases(local.purchases ?? []);
    fetch("/api/workspace")
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (data) setPurchases(data.purchases ?? []);
      })
      .catch(() => undefined);
  }, []);

  const incomplete = useMemo(
    () => purchases.filter((item) => !item.detail?.trim()),
    [purchases],
  );

  function flash(message: string) {
    setNotice(message);
    window.setTimeout(() => setNotice(""), 2800);
  }

  async function saveDetail(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    const detail = String(new FormData(event.currentTarget).get("detail") ?? "").trim();
    if (!detail) {
      setError("Escribe una variedad, formato o tipo de envase.");
      return;
    }
    const response = await fetch("/api/workspace", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "updatePurchase", itemId: selected.id, detail, quantity: selected.quantity, expiresAt: selected.expiresAt }),
    }).catch(() => null);
    if (response && !response.ok && response.status !== 503) {
      setError("No se pudo guardar el detalle.");
      return;
    }
    const next = purchases.map((item) =>
      item.id === selected.id ? { ...item, detail } : item,
    );
    setPurchases(next);
    const local = JSON.parse(localStorage.getItem(stockKey) ?? "{}");
    localStorage.setItem(stockKey, JSON.stringify({ ...local, purchases: next }));
    setSelected(null);
    setError("");
    flash(`${selected.name} actualizado`);
  }

  return (
    <div>
      <div className="mb-8">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-600">
          Calidad del inventario
        </p>
        <h2 className="mt-2 text-3xl font-bold tracking-tight text-slate-950">
          Revisar información
        </h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
          Completa los detalles opcionales de tus lotes para distinguir, por ejemplo,
          macarrones, fideos o el formato concreto dentro de una misma categoría.
        </p>
      </div>
      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between gap-4 border-b border-slate-100 p-5">
          <div>
            <h3 className="font-bold text-slate-900">Artículos con información pendiente</h3>
            <p className="mt-1 text-sm text-slate-500">
              {incomplete.length} {incomplete.length === 1 ? "lote necesita" : "lotes necesitan"} un detalle.
            </p>
          </div>
          <ClipboardPenLine className="text-emerald-600" size={22} />
        </div>
        <div className="divide-y divide-slate-100">
          {incomplete.map((item) => (
            <div key={item.id} className="flex items-center justify-between gap-4 p-5">
              <div>
                <p className="font-semibold text-slate-800">{item.name}</p>
                <p className="mt-1 text-xs text-slate-500">
                  {item.quantity} {item.unit} · caduca el {new Date(`${item.expiresAt}T00:00:00`).toLocaleDateString("es-ES")}
                </p>
                <p className="mt-1 text-xs font-medium text-amber-700">Detalle pendiente</p>
              </div>
              <button
                onClick={() => { setSelected(item); setError(""); }}
                className="shrink-0 rounded-xl bg-emerald-600 px-3 py-2 text-xs font-bold text-white"
              >
                Completar detalle
              </button>
            </div>
          ))}
          {incomplete.length === 0 && (
            <div className="p-10 text-center">
              <Check className="mx-auto text-emerald-600" size={26} />
              <p className="mt-3 text-sm font-semibold text-slate-700">Todo el inventario está bien identificado.</p>
              <p className="mt-1 text-sm text-slate-500">Los nuevos detalles se pueden añadir al registrar cada compra.</p>
            </div>
          )}
        </div>
      </section>
      {selected && (
        <div role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelected(null); }} className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/30 p-5 backdrop-blur-sm">
          <div role="dialog" aria-modal="true" className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <div className="mb-6 flex items-start justify-between">
              <div>
                <h3 className="text-lg font-bold">Completar información</h3>
                <p className="mt-1 text-sm text-slate-500">{selected.name}</p>
              </div>
              <button onClick={() => setSelected(null)} aria-label="Cerrar ventana" className="rounded-lg p-2 text-slate-400 hover:bg-slate-100"><X size={19} /></button>
            </div>
            <form onSubmit={saveDetail} className="space-y-4">
              <label className="block text-sm font-semibold">
                Detalle del artículo
                <input name="detail" autoFocus placeholder="Ej. macarrones, fideos, bote de 500 g" className="mt-1.5 h-11 w-full rounded-xl border border-slate-200 px-3 outline-none focus:border-emerald-500" />
                <span className="mt-1 block text-xs font-normal text-slate-400">Indica variedad, formato o tipo de envase.</span>
              </label>
              {error && <p className="rounded-lg bg-rose-50 p-3 text-xs text-rose-700">{error}</p>}
              <button className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 text-sm font-bold text-white"><Check size={16} />Guardar detalle</button>
            </form>
          </div>
        </div>
      )}
      {notice && <div className="fixed bottom-6 right-6 z-50 rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white shadow-xl">{notice}</div>}
    </div>
  );
}
