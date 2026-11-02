"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  Archive,
  CalendarDays,
  Check,
  Copy,
  Download,
  FileText,
  MapPin,
  PackagePlus,
  Search,
  Tag,
  Trash2,
  X,
} from "lucide-react";
import { Document, Page, PDFDownloadLink, StyleSheet, Text, View } from "@react-pdf/renderer";
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
  packs?: { id: string; name: string; code?: string | null; location?: string | null }[];
};
type PackLine = {
  purchaseId: string;
  name: string;
  detail?: string | null;
  category?: string | null;
  quantity: number;
  unit: string;
  expiresAt: string;
};
type Pack = {
  id: string;
  name: string;
  code: string;
  location: string;
  expiresAt: string | null;
  createdAt?: string;
  items: PackLine[];
};
type Selected = Record<string, number>;

const stockKey = "reservaclara-stock-v1";
const packsKey = "reservaclara-packs-v1";

export function PackManager() {
  const [planned, setPlanned] = useState<Planned[]>([]);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [packs, setPacks] = useState<Pack[]>([]);
  const [selected, setSelected] = useState<Selected>({});
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("Todas");
  const [showCreate, setShowCreate] = useState(false);
  const [duplicateSource, setDuplicateSource] = useState<Pack | null>(null);
  const [notice, setNotice] = useState("");
  useEffect(() => {
    const stock = JSON.parse(localStorage.getItem(stockKey) ?? "{}");
    const defaultPlanned = initialCatalog.map((item, index) => ({
      ...item,
      id: `${item.name}-${index}`,
    }));
    setPlanned((stock.planned?.length ? stock.planned : defaultPlanned).filter((item: Planned) => !isEquipmentItem(item)));
    setPurchases((stock.purchases ?? []).filter((item: Purchase) => item.category !== "Equipamiento y energía" && !isEquipmentName(item.name)));
    setPacks(JSON.parse(localStorage.getItem(packsKey) ?? "[]"));
    fetch("/api/workspace")
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (!data) return;
        setPlanned((data.planned ?? []).filter((item: Planned) => !isEquipmentItem(item)));
        setPurchases((data.purchases ?? []).filter((item: Purchase) => item.category !== "Equipamiento y energía" && !isEquipmentName(item.name)));
        setPacks(data.packs);
      })
      .catch(() => undefined);
  }, []);
  const categories = useMemo(
    () => [
      "Todas",
      ...Array.from(new Set(planned.map((item) => item.category))),
    ],
    [planned],
  );
  const purchaseById = useMemo(
    () => new Map(purchases.map((purchase) => [purchase.id, purchase])),
    [purchases],
  );
  const rows = useMemo(
    () =>
      planned.filter(
        (item) =>
          (category === "Todas" || item.category === category) &&
          item.name
            .toLocaleLowerCase("es")
            .includes(query.toLocaleLowerCase("es")),
      ),
    [planned, category, query],
  );
  const packByPurchase = useMemo(() => {
    const result = new Map<string, string[]>();
    packs.forEach((pack) =>
      pack.items.forEach((item) =>
        result.set(item.purchaseId, [
          ...(result.get(item.purchaseId) ?? []),
          pack.name,
        ]),
      ),
    );
    return result;
  }, [packs]);
  const selectedCount = Object.values(selected).reduce(
    (sum, quantity) => sum + quantity,
    0,
  );
  function flash(message: string) {
    setNotice(message);
    window.setTimeout(() => setNotice(""), 2800);
  }
  function addPurchase(purchase: Purchase) {
    if (purchase.quantity <= 0) return;
    setSelected((current) => ({ ...current, [purchase.id]: Math.min((current[purchase.id] ?? 0) + 1, purchase.quantity) }));
  }
  function removeSelected(id: string) {
    setSelected((current) => {
      const next = { ...current };
      delete next[id];
      return next;
    });
  }
  async function createPack(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const name = String(form.get("name") ?? "").trim();
    const code = String(form.get("code") ?? "").trim();
    const location = String(form.get("location") ?? "").trim();
    const expiresAt = String(form.get("expiresAt") ?? "");
    if (!name || !code || !location || !expiresAt || !selectedCount) return;
    const items = Object.entries(selected).map(([purchaseId, quantity]) => {
      const purchase = purchaseById.get(purchaseId)!;
      return {
        itemId: purchaseId,
        purchaseId,
        name: purchase.name,
        detail: purchase.detail,
        quantity,
        unit: purchase.unit,
        expiresAt: purchase.expiresAt,
      };
    });
    const response = await fetch("/api/workspace", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "createPack",
        name,
        code,
        location,
        expiresAt,
        items,
      }),
    });
    const saved = response.ok ? await response.json() : null;
    const nextPack = saved ?? {
      id: crypto.randomUUID(),
      name,
      code,
      location,
      expiresAt,
      items,
    };
    const nextPacks = [...packs, nextPack];
    setPacks(nextPacks);
    localStorage.setItem(packsKey, JSON.stringify(nextPacks));
    setSelected({});
    setShowCreate(false);
    flash(`Pack ${name} creado sin modificar el stock`);
  }
  async function deletePack(pack: Pack) {
    await fetch("/api/workspace", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "deletePack", id: pack.id }),
    }).catch(() => undefined);
    const next = packs.filter((candidate) => candidate.id !== pack.id);
    setPacks(next);
    localStorage.setItem(packsKey, JSON.stringify(next));
    flash(`Pack ${pack.name} eliminado`);
  }
  function startDuplicate(pack: Pack) {
    setSelected(pack.items.reduce<Record<string, number>>((result, item) => {
      result[item.purchaseId] = item.quantity;
      return result;
    }, {}));
    setDuplicateSource(pack);
    setShowCreate(true);
    flash(`Contenido de ${pack.name} listo para duplicar`);
  }
  return (
    <div>
      <div className="mb-8 flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-600">
            Organización física
          </p>
          <h2 className="mt-2 text-3xl font-bold tracking-tight text-slate-950">
            Packs y lotes
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
            Agrupa alimentos en cajas con caducidades comunes. Crear un pack no
            descuenta stock: solo añade una ubicación y una relación
            organizativa.
          </p>
        </div>
        <button
          onClick={() => { setDuplicateSource(null); setShowCreate(true); }}
          disabled={!selectedCount}
          className="flex w-fit items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white shadow-lg shadow-emerald-200 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <PackagePlus size={17} />
          Crear pack {selectedCount ? `(${selectedCount})` : ""}
        </button>
      </div>
      <div className="grid gap-6 xl:grid-cols-[1.25fr_0.75fr]">
        <section className="min-w-0 rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 p-5">
            <div className="flex flex-col gap-3 sm:flex-row">
              <div className="relative min-w-0 flex-1">
                <Search
                  className="absolute left-3 top-2.5 text-slate-400"
                  size={16}
                />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Filtrar alimentos..."
                  className="h-10 w-full rounded-lg border border-slate-200 bg-slate-50 pl-9 pr-3 text-sm outline-none focus:border-emerald-500"
                />
              </div>
              <select
                value={category}
                onChange={(event) => setCategory(event.target.value)}
                className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm sm:w-52"
              >
                {categories.map((item) => (
                  <option key={item}>{item}</option>
                ))}
              </select>
            </div>
            <p className="mt-3 text-xs text-slate-400">
              {rows.length} alimentos disponibles en el objetivo · selecciona
              los que quieras meter en una caja.
            </p>
          </div>
          <div className="max-h-[620px] divide-y divide-slate-100 overflow-y-auto overscroll-contain">
            {rows.map((food) => {
              const foodPurchases = purchases.filter(
                (purchase) => purchase.name === food.name,
              );
              const available = foodPurchases.reduce(
                (sum, purchase) => sum + purchase.quantity - (selected[purchase.id] ?? 0),
                0,
              );
              const packedQuantity = foodPurchases.reduce((sum, purchase) => {
                const related = purchase.packs?.length ? purchase.packs : packByPurchase.get(purchase.id) ?? [];
                return sum + (related.length ? purchase.quantity - (selected[purchase.id] ?? 0) : 0);
              }, 0);
              const freeQuantity = Math.max(available - packedQuantity, 0);
              const inPacks = foodPurchases.flatMap(
                (purchase) => packByPurchase.get(purchase.id) ?? [],
              );
              const detailGroups = Array.from(
                foodPurchases.reduce((groups, purchase) => {
                  const key = purchase.detail?.trim().toLocaleLowerCase("es") || "__sin_detalle__";
                  groups.set(key, [...(groups.get(key) ?? []), purchase]);
                  return groups;
                }, new Map<string, Purchase[]>()).entries(),
              );
              return (
                <div
                  key={food.id}
                  className="flex min-w-0 items-center gap-3 p-4"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-slate-800">
                      {food.name}
                    </p>
                    <p className="truncate text-xs text-slate-400">
                      {food.category} · stock total: {available} {food.unit} · libre: {freeQuantity} · en packs: {packedQuantity}
                    </p>
                    {inPacks.length > 0 && (
                      <p className="mt-1 truncate text-[11px] font-medium text-blue-600">
                        En packs: {Array.from(new Set(inPacks)).join(", ")}
                      </p>
                    )}
                  </div>
                  <div className="flex min-w-[280px] flex-col gap-2">
                    {detailGroups.length ? detailGroups.map(([groupKey, group]) => { const groupAvailable = group.reduce((sum, purchase) => sum + purchase.quantity - (selected[purchase.id] ?? 0), 0); const groupPacked = group.reduce((sum, purchase) => { const related = purchase.packs?.length ? purchase.packs : packByPurchase.get(purchase.id) ?? []; return sum + (related.length ? purchase.quantity - (selected[purchase.id] ?? 0) : 0); }, 0); const groupFree = Math.max(groupAvailable - groupPacked, 0); return <div key={groupKey} className="rounded-xl border border-slate-100 bg-slate-50 p-2"><div className="mb-1 flex items-center justify-between gap-2"><p className="truncate text-[11px] font-semibold text-slate-700">{group[0].detail?.trim() || "Sin detalle"}</p><span className="shrink-0 text-[10px] text-slate-400">{groupAvailable} {group[0].unit} · libre {groupFree} · en packs {groupPacked}</span></div><div className="space-y-1">{group.map((purchase) => { const remaining = purchase.quantity - (selected[purchase.id] ?? 0); const relatedPacks = purchase.packs?.length ? purchase.packs : (packByPurchase.get(purchase.id) ?? []).map((name) => ({ name })); const packLabel = relatedPacks.length ? `En ${relatedPacks.map((pack) => pack.name).join(", ")}` : "Sin pack"; return <div key={purchase.id} className="flex items-center justify-between gap-2 rounded-lg border border-white bg-white px-2 py-1.5"><p className="min-w-0 truncate text-[10px] text-slate-500">{remaining} {purchase.unit} · {packLabel} · caduca {new Date(`${purchase.expiresAt}T00:00:00`).toLocaleDateString("es-ES")}</p><button onClick={() => addPurchase(purchase)} disabled={remaining <= 0} title={relatedPacks.length ? "Añadir este lote a otro pack" : "Añadir lote"} className="shrink-0 rounded-md bg-emerald-50 px-2 py-1 text-[10px] font-bold text-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400">{remaining > 0 ? (relatedPacks.length ? "Añadir otra" : "Añadir 1") : "Completo"}</button></div>; })}</div></div>; }) : <span className="text-xs text-slate-400">Sin lotes comprados</span>}
                  </div>
                </div>
              );
            })}
            {rows.length === 0 && (
              <div className="p-10 text-center text-sm text-slate-500">
                No hay alimentos que coincidan con el filtro.
              </div>
            )}
          </div>
        </section>
        <section className="min-w-0 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold">Contenido del nuevo pack</h3>
              <p className="mt-1 text-xs text-slate-500">
                {selectedCount} unidades seleccionadas
              </p>
            </div>
            <Archive className="text-emerald-500" size={20} />
          </div>
          <div className="mt-5 space-y-2">
            {Object.entries(selected).map(([purchaseId, quantity]) => {
              const purchase = purchaseById.get(purchaseId);
              if (!purchase) return null;
              return (
                <div
                  key={purchaseId}
                  className="flex items-center gap-3 rounded-xl bg-slate-50 p-3"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">
                      {purchase.name}
                    </p>
                    {purchase.detail && <p className="truncate text-xs font-medium text-emerald-700">{purchase.detail}</p>}
                    <p className="text-xs text-slate-500">
                      {quantity} {purchase.unit} · caduca{" "}
                      {new Date(
                        `${purchase.expiresAt}T00:00:00`,
                      ).toLocaleDateString("es-ES")}
                    </p>
                  </div>
                  <button
                    onClick={() => removeSelected(purchaseId)}
                    aria-label={`Quitar ${purchase.name} del nuevo pack`}
                    className="rounded-lg p-1.5 text-slate-400 hover:bg-white hover:text-rose-600"
                  >
                    <X size={16} />
                  </button>
                </div>
              );
            })}
            {!selectedCount && (
              <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">
                Añade alimentos desde la lista para preparar una caja.
              </div>
            )}
          </div>
          {selectedCount > 0 && (
            <button
              onClick={() => setShowCreate(true)}
              className="mt-5 w-full rounded-xl bg-slate-900 py-2.5 text-sm font-bold text-white"
            >
              Completar datos del pack
            </button>
          )}
        </section>
      </div>
      <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-bold">Packs creados</h3>
            <p className="mt-1 text-xs text-slate-500">
              Un alimento puede pertenecer a varios packs.
            </p>
          </div>
          <Archive className="text-slate-400" size={20} />
        </div>
        <div className="mt-5 grid gap-3 md:grid-cols-2">
          {packs.map((pack) => (
            <div
              key={pack.id}
              className="rounded-2xl border border-slate-200 p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h4 className="font-bold">{pack.name}</h4>
                  <p className="mt-1 text-xs text-slate-500">
                    Código {pack.code} · {pack.location}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => startDuplicate(pack)}
                    aria-label={`Duplicar pack ${pack.name}`}
                    title="Duplicar pack"
                    className="rounded-lg p-1.5 text-slate-400 hover:bg-blue-50 hover:text-blue-700"
                  >
                    <Copy size={15} />
                  </button>
                  <PDFDownloadLink
                    document={<PackReport pack={pack} />}
                    fileName={`alertastock-pack-${pack.code || pack.name.toLowerCase().replace(/[^a-z0-9]+/gi, "-")}.pdf`}
                    className="rounded-lg p-1.5 text-slate-400 hover:bg-emerald-50 hover:text-emerald-700"
                    title="Descargar ficha PDF del pack"
                  >
                    {({ loading }) => loading ? <FileText size={15} /> : <Download size={15} />}
                  </PDFDownloadLink>
                  <button
                    onClick={() => deletePack(pack)}
                    aria-label={`Eliminar pack ${pack.name}`}
                    className="rounded-lg p-1.5 text-slate-300 hover:bg-rose-50 hover:text-rose-600"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
              <div className="mt-4 flex flex-wrap gap-2 text-xs text-slate-600">
                <span className="flex items-center gap-1 rounded-full bg-slate-50 px-2 py-1">
                  <CalendarDays size={13} />
                  Caduca {pack.expiresAt ? new Date(`${pack.expiresAt}T00:00:00`).toLocaleDateString("es-ES") : "sin fecha"}
                </span>
                <span className="flex items-center gap-1 rounded-full bg-slate-50 px-2 py-1">
                  <Tag size={13} />
                  {pack.items.length} lotes
                </span>
                <span className="flex items-center gap-1 rounded-full bg-slate-50 px-2 py-1">
                  <MapPin size={13} />
                  {pack.location}
                </span>
              </div>
              <p className="mt-3 text-xs leading-5 text-slate-500">
                {pack.items
                  .map((item) => `${item.name}${item.detail ? ` — ${item.detail}` : ""} (${item.quantity} ${item.unit})`)
                  .join(" · ")}
              </p>
            </div>
          ))}
          {packs.length === 0 && (
            <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500 md:col-span-2">
              Todavía no hay cajas creadas.
            </div>
          )}
        </div>
      </section>
      {showCreate && (
        <Modal
          title={duplicateSource ? `Duplicar pack: ${duplicateSource.name}` : "Crear pack de almacenamiento"}
          onClose={() => { setShowCreate(false); setDuplicateSource(null); }}
        >
          <form onSubmit={createPack} className="space-y-4">
            <label className="block text-sm font-semibold">
              Nombre de la caja
              <input
                name="name"
                required
                placeholder="Ej. Caja 01 - Conservas"
                defaultValue={duplicateSource ? `${duplicateSource.name} copia` : ""}
                className="mt-1.5 h-11 w-full rounded-xl border border-slate-200 px-3 outline-none focus:border-emerald-500"
              />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="block text-sm font-semibold">
                Código
                <input
                  name="code"
                  required
                  placeholder="C-001"
                defaultValue={duplicateSource ? `${duplicateSource.code}-2` : ""}
                  className="mt-1.5 h-11 w-full rounded-xl border border-slate-200 px-3 outline-none"
                />
              </label>
              <label className="block text-sm font-semibold">
                Ubicación
                <input
                  name="location"
                  required
                  placeholder="Estantería A"
                defaultValue={duplicateSource?.location ?? ""}
                  className="mt-1.5 h-11 w-full rounded-xl border border-slate-200 px-3 outline-none"
                />
              </label>
            </div>
            <label className="block text-sm font-semibold">
              Caducidad común
              <input
                name="expiresAt"
                type="date"
                required
                defaultValue={duplicateSource?.expiresAt ?? ""}
                className="mt-1.5 h-11 w-full rounded-xl border border-slate-200 px-3 outline-none"
              />
            </label>
            <p className="rounded-lg bg-emerald-50 p-3 text-xs leading-5 text-emerald-800">
              {duplicateSource ? "Se ha copiado el contenido del pack. Revisa el nombre, código, ubicación y caducidad antes de guardarlo." : "Crear el pack no resta existencias. Solo asigna código, ubicación y una fecha común para organizarlo."}
            </p>
            <button className="h-11 w-full rounded-xl bg-emerald-600 text-sm font-bold text-white">
              {duplicateSource ? "Guardar pack duplicado" : "Crear caja"}
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

function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
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
              El pack no modifica las existencias.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar ventana"
            title="Cerrar"
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-800"
          >
            <X size={19} />
          </button>
        </div>
        {children}
        <button
          type="button"
          onClick={onClose}
          className="mt-3 w-full rounded-xl py-2 text-sm font-semibold text-slate-500 hover:bg-slate-50"
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}

const packPdfStyles = StyleSheet.create({
  page: { padding: 24, fontSize: 8, color: "#172033" },
  title: { fontSize: 17, marginBottom: 3, fontWeight: 700 },
  subtitle: { fontSize: 8, color: "#64748b", marginBottom: 8 },
  metadata: { border: "1 solid #dbe4d2", borderRadius: 4, padding: 6, marginBottom: 8 },
  metadataLine: { marginBottom: 2 },
  sectionTitle: { fontSize: 10, fontWeight: 700, color: "#365314", marginBottom: 5 },
  columns: { flexDirection: "row", gap: 8 },
  column: { flex: 1 },
  row: { border: "1 solid #e2e8f0", borderRadius: 3, padding: 4, marginBottom: 4 },
  food: { fontSize: 8, fontWeight: 700, marginBottom: 2 },
  detail: { fontSize: 7, color: "#475569", marginBottom: 1 },
  footer: { position: "absolute", bottom: 12, left: 24, right: 24, fontSize: 6, color: "#94a3b8", textAlign: "center" },
});

function PackReport({ pack }: { pack: Pack }) {
  const columnCount = 2;
  const perColumn = Math.ceil(pack.items.length / columnCount);
  const columns = Array.from({ length: columnCount }, (_, index) => pack.items.slice(index * perColumn, (index + 1) * perColumn));
  return (
    <Document>
      <Page size="A4" wrap={false} style={packPdfStyles.page}>
        <Text style={packPdfStyles.title}>AlertaStock · Ficha de pack</Text>
        <Text style={packPdfStyles.subtitle}>Contenido físico de la caja · generado el {new Date().toLocaleDateString("es-ES")}</Text>
        <View style={packPdfStyles.metadata}>
          <Text style={packPdfStyles.metadataLine}>Pack: {pack.name} · Código: {pack.code || "Sin código"} · Ubicación: {pack.location || "Sin ubicación"}</Text>
          <Text>Caducidad común: {pack.expiresAt ? new Date(`${pack.expiresAt}T00:00:00`).toLocaleDateString("es-ES") : "Sin fecha"} · {pack.items.length} lotes</Text>
        </View>
        <Text style={packPdfStyles.sectionTitle}>Contenido</Text>
        <View style={packPdfStyles.columns}>
          {columns.map((column, columnIndex) => <View key={columnIndex} style={packPdfStyles.column}>{column.map((item, index) => <View key={`${item.purchaseId}-${index}`} style={packPdfStyles.row}><Text style={packPdfStyles.food}>{item.name}</Text><Text style={packPdfStyles.detail}>Categoría: {item.category || "Sin categoría"}</Text><Text style={packPdfStyles.detail}>Tipo: {item.detail || "Sin detalle"} · Cantidad: {item.quantity} {item.unit}</Text><Text style={packPdfStyles.detail}>Caduca: {new Date(`${item.expiresAt}T00:00:00`).toLocaleDateString("es-ES")}</Text></View>)}</View>)}
        </View>
        <Text style={packPdfStyles.footer}>AlertaStock · ficha imprimible de almacenamiento</Text>
      </Page>
    </Document>
  );
}
