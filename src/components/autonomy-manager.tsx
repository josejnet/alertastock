"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowRight, CircleHelp, Settings2, ShieldCheck, Users } from "lucide-react";
import { initialCatalog, isEquipmentItem, isEquipmentName, type CatalogItem } from "@/lib/catalog";
import { dailyMacroTargets, defaultCalorieSettings, defaultMacroTargets, estimatedCalories, estimatedMacros, householdDailyCalories, type CalorieSettings, type HouseholdMember, type Macros } from "@/lib/nutrition";

type Planned = CatalogItem & { id: string };
type Purchase = { id: string; name: string; category?: string | null; quantity: number; unit: string; expiresAt: string };
const number = (value: number) => value.toLocaleString("es-ES", { maximumFractionDigits: 1 });

function sumMacros(items: { name: string; quantity: number }[]): Macros {
  return items.reduce((total, item) => {
    const macros = estimatedMacros(item.name, item.quantity);
    return { protein: total.protein + macros.protein, carbs: total.carbs + macros.carbs, fat: total.fat + macros.fat };
  }, { protein: 0, carbs: 0, fat: 0 });
}

export function AutonomyManager() {
  const [planned, setPlanned] = useState<Planned[]>(() => initialCatalog.filter((item) => !isEquipmentItem(item)).map((item, index) => ({ ...item, id: `${item.name}-${index}` })));
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [members, setMembers] = useState<HouseholdMember[]>([]);
  const [settings, setSettings] = useState<CalorieSettings>(defaultCalorieSettings);

  useEffect(() => {
    const stock = JSON.parse(localStorage.getItem("reservaclara-stock-v1") ?? "{}");
    setPlanned((stock.planned?.length ? stock.planned : initialCatalog).filter((item: Planned) => !isEquipmentItem(item)));
    setPurchases((stock.purchases ?? []).filter((item: Purchase) => item.category !== "Equipamiento y energía" && !isEquipmentName(item.name)));
    setMembers(JSON.parse(localStorage.getItem("reservaclara-household-v1") ?? "[]"));
    setSettings({ ...defaultCalorieSettings, ...JSON.parse(localStorage.getItem("reservaclara-calorie-settings-v1") ?? "{}") });
    fetch("/api/workspace").then(async (response) => response.ok ? response.json() : null).then((data) => {
      if (!data) return;
      setPlanned((data.planned ?? []).filter((item: Planned) => !isEquipmentItem(item)));
      setPurchases((data.purchases ?? []).filter((item: Purchase) => item.category !== "Equipamiento y energía" && !isEquipmentName(item.name)));
      setMembers(data.members ?? []);
      setSettings({ ...defaultCalorieSettings, ...(data.nutrition ?? {}) });
    }).catch(() => undefined);
  }, []);

  const daily = householdDailyCalories(members, settings);
  const values = useMemo(() => {
    const currentKcal = purchases.reduce((sum, item) => sum + estimatedCalories(item.name, item.quantity), 0);
    const targetKcal = planned.reduce((sum, item) => sum + estimatedCalories(item.name, item.plannedQuantity), 0);
    const currentMacros = sumMacros(purchases);
    const targetMacros = sumMacros(planned.map((item) => ({ name: item.name, quantity: item.plannedQuantity })));
    const dailyMacros = dailyMacroTargets(daily, defaultMacroTargets);
    const coverage = {
      calories: daily ? currentKcal / daily : 0,
      protein: dailyMacros.protein ? currentMacros.protein / dailyMacros.protein : 0,
      carbs: dailyMacros.carbs ? currentMacros.carbs / dailyMacros.carbs : 0,
      fat: dailyMacros.fat ? currentMacros.fat / dailyMacros.fat : 0,
    };
    const limiting = Math.min(...Object.values(coverage));
    return { currentKcal, targetKcal, currentMacros, targetMacros, dailyMacros, coverage, limiting, currentDays: currentKcal / (daily || 1), targetDays: targetKcal / (daily || 1), operationalDays: limiting * 0.85 };
  }, [daily, planned, purchases]);

  return <div>
    <div className="mb-8 flex flex-col justify-between gap-4 md:flex-row md:items-end"><div><p className="prepper-eyebrow text-xs font-bold text-[#66734a]">Autonomía nutricional</p><h2 className="mt-2 text-3xl font-bold tracking-tight text-slate-950">Días de autonomía</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">Mide cuántos días puede sostenerse tu hogar usando energía y macronutrientes. La cifra prudente queda limitada por el nutriente que se agota antes.</p></div><div className="flex gap-2"><Link href="/dashboard/hogar" className="flex items-center gap-2 rounded-xl border border-[#d9d8cc] bg-[#fffefa] px-4 py-2.5 text-sm font-bold text-slate-700"><Users size={16} />Mi hogar</Link><Link href="/dashboard/configuracion" className="flex items-center gap-2 rounded-xl bg-[#465335] px-4 py-2.5 text-sm font-bold text-white"><Settings2 size={16} />Estándares</Link></div></div>
    {!members.length ? <section className="rounded-2xl border border-amber-200 bg-amber-50 p-6"><h3 className="font-bold text-amber-900">Configura primero tu hogar</h3><p className="mt-2 text-sm leading-6 text-amber-800">Necesitamos al menos un habitante para transformar el stock en días de autonomía y macros.</p><Link href="/dashboard/hogar" className="mt-4 inline-flex items-center gap-2 rounded-xl bg-amber-900 px-4 py-2.5 text-sm font-bold text-white">Añadir habitantes <ArrowRight size={15} /></Link></section> : <>
      <div className="grid gap-4 md:grid-cols-4"><Metric label="Autonomía prudente" value={`${number(values.limiting)} días`} accent="olive" /><Metric label="Días operativos" value={`${number(values.operationalDays)} días`} accent="amber" /><Metric label="Autonomía energética" value={`${number(values.currentDays)} días`} /><Metric label="Consumo diario" value={`${daily.toLocaleString("es-ES")} kcal`} /></div>
      <section className="prepper-panel mt-6 rounded-2xl border p-6"><div className="flex items-center gap-3"><ShieldCheck className="text-[#66734a]" size={22} /><div><h3 className="font-bold">Lectura completa del stock</h3><p className="mt-1 text-sm text-slate-500">El indicador prudente considera energía, proteína, hidratos y grasa. Se reserva un 15% como margen operativo.</p></div></div><div className="mt-5 grid gap-3 md:grid-cols-4"><Coverage label="Calorías" days={values.coverage.calories} color="bg-[#66734a]" /><Coverage label="Proteína" days={values.coverage.protein} color="bg-[#b97924]" /><Coverage label="Hidratos" days={values.coverage.carbs} color="bg-sky-600" /><Coverage label="Grasa" days={values.coverage.fat} color="bg-violet-600" /></div><p className="mt-4 flex items-start gap-2 text-xs leading-5 text-slate-500"><CircleHelp size={14} className="mt-0.5 shrink-0" />Los macros son estimaciones medias por alimento y unidad del catálogo. Para una planificación médica o deportiva, contrasta las etiquetas reales.</p></section>
      <div className="mt-6 grid gap-6 lg:grid-cols-2"><MacroCard title="Stock actual" macros={values.currentMacros} daily={values.dailyMacros} /><MacroCard title="Objetivo planificado" macros={values.targetMacros} daily={values.dailyMacros} /></div>
    </>}
  </div>;
}

function Metric({ label, value, accent = "slate" }: { label: string; value: string; accent?: "olive" | "amber" | "slate" }) { const colors = { olive: "text-[#465335]", amber: "text-[#a26118]", slate: "text-slate-950" }; return <div className="prepper-panel rounded-2xl border p-5"><p className="text-sm text-slate-500">{label}</p><p className={`mt-2 text-2xl font-bold ${colors[accent]}`}>{value}</p></div>; }
function Coverage({ label, days, color }: { label: string; days: number; color: string }) { return <div className="rounded-xl border border-[#e7e6dc] bg-[#fbfaf5] p-4"><div className="flex items-center justify-between gap-2"><span className="text-sm font-semibold text-slate-700">{label}</span><span className="text-sm font-bold text-slate-900">{number(days)} días</span></div><div className="mt-3 h-2 overflow-hidden rounded-full bg-[#e8e7dc]"><div className={`h-full rounded-full ${color}`} style={{ width: `${Math.min(days / 30 * 100, 100)}%` }} /></div><p className="mt-2 text-[11px] text-slate-400">Cobertura estimada</p></div>; }
function MacroCard({ title, macros, daily }: { title: string; macros: Macros; daily: Macros }) { return <section className="prepper-panel rounded-2xl border p-5"><h3 className="font-bold">{title}</h3><div className="mt-4 grid grid-cols-3 gap-3">{[["Proteína", macros.protein, daily.protein, "g"], ["Hidratos", macros.carbs, daily.carbs, "g"], ["Grasa", macros.fat, daily.fat, "g"]].map(([label, value, target, unit]) => <div key={String(label)} className="rounded-xl bg-[#f3f3ed] p-3"><p className="text-xs text-slate-500">{label}</p><p className="mt-1 text-lg font-bold text-slate-900">{number(Number(value))}{unit}</p><p className="mt-1 text-[11px] text-slate-400">Meta diaria: {number(Number(target))}{unit}</p></div>)}</div></section>; }
