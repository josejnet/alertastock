"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Check, MinusCircle, Search, X } from "lucide-react";

type Purchase = { id: string; name: string; detail?: string | null; quantity: number; unit: string; expiresAt: string };
const stockKey = "reservaclara-stock-v1";

export function ConsumptionManager() {
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Purchase | null>(null);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const local = JSON.parse(localStorage.getItem(stockKey) ?? "{}");
    setPurchases(local.purchases ?? []);
    fetch("/api/workspace").then((response) => response.ok ? response.json() : null).then((data) => { if (data) setPurchases(data.purchases ?? []); }).catch(() => undefined);
  }, []);

  const rows = useMemo(() => purchases.filter((item) => `${item.name} ${item.detail ?? ""}`.toLocaleLowerCase("es").includes(query.toLocaleLowerCase("es"))), [purchases, query]);
  function flash(message: string) { setNotice(message); window.setTimeout(() => setNotice(""), 2800); }
  async function consume(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    const quantity = Number(new FormData(event.currentTarget).get("quantity"));
    if (!Number.isFinite(quantity) || quantity <= 0 || quantity > selected.quantity) { setError("La cantidad debe ser mayor que 0 y no superar el lote disponible."); return; }
    const response = await fetch("/api/workspace", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "consume", itemId: selected.id, quantity }) }).catch(() => null);
    if (response && !response.ok && response.status !== 503) { setError("No se pudo registrar el consumo."); return; }
    const remaining = selected.quantity - quantity;
    const next = purchases.flatMap((item) => item.id !== selected.id ? [item] : remaining > 0 ? [{ ...item, quantity: remaining }] : []);
    setPurchases(next); localStorage.setItem(stockKey, JSON.stringify({ planned: JSON.parse(localStorage.getItem(stockKey) ?? "{}").planned ?? [], purchases: next })); setSelected(null); setError(""); flash(`${selected.name} consumido: ${quantity} ${selected.unit}. Stock pendiente actualizado.`);
  }

  return <div><div className="mb-8"><p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-600">Salidas del inventario</p><h2 className="mt-2 text-3xl font-bold tracking-tight text-slate-950">Consumos individuales</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">Registra lo que consumes lote a lote. El inventario disminuye y la cantidad vuelve automáticamente a Stock a completar.</p></div><section className="rounded-2xl border border-slate-200 bg-white shadow-sm"><div className="border-b border-slate-100 p-5"><div className="relative max-w-xl"><Search className="absolute left-3 top-2.5 text-slate-400" size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar alimento, variedad o envase..." className="h-10 w-full rounded-lg border border-slate-200 bg-slate-50 pl-9 pr-3 text-sm outline-none focus:border-emerald-500" /></div><p className="mt-3 text-xs text-slate-400">{rows.length} lotes disponibles para consumir.</p></div><div className="divide-y divide-slate-100">{rows.map((item) => <div key={item.id} className="flex items-center justify-between gap-4 p-5"><div className="min-w-0"><p className="font-semibold text-slate-800">{item.name}</p>{item.detail && <p className="mt-1 text-sm font-medium text-emerald-700">{item.detail}</p>}<p className="mt-1 text-xs text-slate-500">Disponible: {item.quantity} {item.unit} · caduca el {new Date(`${item.expiresAt}T00:00:00`).toLocaleDateString("es-ES")}</p></div><button onClick={() => { setSelected(item); setError(""); }} className="flex shrink-0 items-center gap-2 rounded-xl bg-emerald-600 px-3 py-2 text-xs font-bold text-white"><MinusCircle size={15} />Registrar consumo</button></div>)}{rows.length === 0 && <div className="p-10 text-center"><p className="text-sm font-semibold text-slate-700">No tienes lotes disponibles para consumir.</p><p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">Primero registra una compra en Inventario. Después cada lote aparecerá aquí con su propio botón de consumo.</p><Link href="/dashboard/inventario" className="mt-5 inline-flex rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white">Ir a Inventario</Link></div>}</div></section>{selected && <div role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelected(null); }} className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/30 p-5 backdrop-blur-sm"><div role="dialog" aria-modal="true" className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl"><div className="mb-6 flex items-start justify-between"><div><h3 className="text-lg font-bold">Registrar consumo</h3><p className="mt-1 text-sm text-slate-500">{selected.name}{selected.detail ? ` · ${selected.detail}` : ""}</p></div><button onClick={() => setSelected(null)} aria-label="Cerrar ventana" className="rounded-lg p-2 text-slate-400 hover:bg-slate-100"><X size={19} /></button></div><form onSubmit={consume} className="space-y-4"><label className="block text-sm font-semibold">Cantidad consumida<input name="quantity" type="number" min="0.01" max={selected.quantity} step="0.01" defaultValue={Math.min(1, selected.quantity)} required className="mt-1.5 h-11 w-full rounded-xl border border-slate-200 px-3 outline-none focus:border-emerald-500" /></label>{error && <p className="rounded-lg bg-rose-50 p-3 text-xs text-rose-700">{error}</p>}<p className="rounded-lg bg-amber-50 p-3 text-xs leading-5 text-amber-800">Quedarán {Math.max(selected.quantity - 1, 0)} {selected.unit} si consumes una unidad.</p><button className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 text-sm font-bold text-white"><Check size={16} />Confirmar consumo</button></form></div></div>}{notice && <div className="fixed bottom-6 right-6 z-50 rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white shadow-xl">{notice}</div>}</div>;
}
