"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import {
  Archive,
  CalendarDays,
  ChevronRight,
  ClipboardPenLine,
  Home,
  LayoutDashboard,
  Leaf,
  LogOut,
  MinusCircle,
  Package,
  Settings2,
  ShoppingCart,
  Sparkles,
  Users,
  Wrench,
} from "lucide-react";
import { AdminManager } from "@/components/admin-manager";
import { AutonomyManager } from "@/components/autonomy-manager";
import { CalendarManager } from "@/components/calendar-manager";
import { ConsumptionManager } from "@/components/consumption-manager";
import { DataReviewManager } from "@/components/data-review-manager";
import { EquipmentManager } from "@/components/equipment-manager";
import { HouseholdManager } from "@/components/household-manager";
import { NutritionSettings } from "@/components/nutrition-settings";
import { OverviewManager } from "@/components/overview-manager";
import { PackManager } from "@/components/pack-manager";
import { SettingsManager } from "@/components/settings-manager";
import { ShoppingListManager } from "@/components/shopping-list-manager";
import { StockManager } from "@/components/stock-manager";
const nav = [
  { label: "Resumen", href: "/dashboard", icon: LayoutDashboard },
  { label: "Inventario", href: "/dashboard/inventario", icon: Package },
  { label: "Consumos", href: "/dashboard/consumos", icon: MinusCircle },
  { label: "Revisar datos", href: "/dashboard/revisar", icon: ClipboardPenLine },
  {
    label: "Lista de compra",
    href: "/dashboard/lista-compra",
    icon: ShoppingCart,
  },
  { label: "Packs y lotes", href: "/dashboard/packs", icon: Archive },
  { label: "Calendario", href: "/dashboard/calendario", icon: CalendarDays },
];
const planning = [
  { label: "Equipamiento", href: "/dashboard/equipamiento", icon: Wrench },
  { label: "Autonomía", href: "/dashboard/autonomia", icon: Sparkles },
  { label: "Mi hogar", href: "/dashboard/hogar", icon: Users },
  { label: "Configuración", href: "/dashboard/configuracion", icon: Settings2 },
];
export function AppShell({ section }: { section: string }) {
  const pathname = usePathname();
  const router = useRouter();
  useEffect(() => {
    const migrationKey = "reservaclara-db-migrated-v1";
    if (localStorage.getItem(migrationKey)) return;
    const stock = JSON.parse(localStorage.getItem("reservaclara-stock-v1") ?? "{}");
    const packs = JSON.parse(localStorage.getItem("reservaclara-packs-v1") ?? "[]");
    const members = JSON.parse(localStorage.getItem("reservaclara-household-v1") ?? "[]");
    const nutrition = JSON.parse(localStorage.getItem("reservaclara-calorie-settings-v1") ?? "{}");
    const snapshot = { planned: stock.planned ?? [], purchases: stock.purchases ?? [], packs, members, nutrition };
    const hasLocalData = snapshot.planned.length || snapshot.purchases.length || snapshot.packs.length || snapshot.members.length;
    if (!hasLocalData) return;
    fetch("/api/workspace").then((response) => { if (!response.ok) return null; return fetch("/api/workspace", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "importSnapshot", snapshot }) }); }).then((response) => { if (!response?.ok) return; localStorage.setItem(migrationKey, "1"); window.location.reload(); }).catch(() => undefined);
  }, []);
  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/");
  }
  return (
    <div className="min-h-screen bg-[#f3f1e8] text-[#1b241c]">
      <aside className="fixed inset-y-0 left-0 hidden w-[250px] border-r border-[#d9d8cc] bg-[#fffefa] lg:flex lg:flex-col">
        <div className="flex h-20 items-center gap-3 border-b border-[#e6e4da] px-7">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#66734a] text-white shadow-md shadow-[#66734a]/20">
            <Leaf size={19} fill="currentColor" />
          </div>
          <div>
            <p className="text-[15px] font-bold">ReservaClara</p>
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">
              Preparación · control · reserva
            </p>
          </div>
        </div>
        <div className="px-4 pt-7">
          <p className="mb-3 px-3 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">
            Operaciones
          </p>
          <nav className="space-y-1">
            {nav.map(({ label, href, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                className={`flex items-center justify-between rounded-xl px-3 py-2.5 text-sm font-medium transition ${pathname === href ? "bg-[#edf0e3] text-[#465335] shadow-sm" : "text-slate-500 hover:bg-[#f3f3ed] hover:text-slate-900"}`}
              >
                <span className="flex items-center gap-3">
                  <Icon size={17} />
                  {label}
                </span>
                {label === "Lista de compra" && (
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-500">
                    ·
                  </span>
                )}
              </Link>
            ))}
          </nav>
        </div>
        <div className="mt-8 px-4">
          <p className="mb-3 px-3 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">
            Preparación
          </p>
          <nav className="space-y-1">
            {planning.map(({ label, href, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium ${pathname === href ? "bg-[#edf0e3] text-[#465335] shadow-sm" : "text-slate-500 hover:bg-[#f3f3ed]"}`}
              >
                <Icon size={17} />
                {label}
              </Link>
            ))}
          </nav>
        </div>
        <div className="mt-auto border-t border-[#e6e4da] p-4">
          <button
            onClick={logout}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-slate-500 hover:bg-[#f3f3ed] hover:text-rose-600"
          >
            <LogOut size={17} />
            Cerrar sesión
          </button>
        </div>
      </aside>
      <main className="lg:pl-[250px]">
        <header className="flex h-20 items-center justify-between border-b border-[#d9d8cc] bg-[#fffefa]/95 px-5 lg:px-10 backdrop-blur">
          <div className="flex items-center gap-3">
            <Link
              href="/dashboard"
              className="rounded-lg p-2 text-slate-500 lg:hidden"
            >
              <Home size={20} />
            </Link>
            <div>
              <p className="prepper-eyebrow text-[10px] font-bold text-slate-400">
                ReservaClara · centro de operaciones
              </p>
              <h1 className="mt-0.5 text-xl font-bold tracking-tight text-slate-950">
                {section}
              </h1>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden text-xs font-semibold text-slate-500 sm:block">
              {section === "Administración" ? "Admin" : "Jose"}
            </span>
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#dfe6cb] text-xs font-bold text-[#465335]">
              {section === "Administración" ? "AD" : "JO"}
            </div>
          </div>
        </header>
        <div className="mx-auto max-w-[1400px] p-5 lg:p-10">
          {section === "Administración" ? (
            <AdminManager />
          ) : section === "Resumen" ? (
            <OverviewManager />
          ) : section === "Configuración" ? (
            <>
              <SettingsManager />
              <NutritionSettings />
            </>
          ) : section === "Inventario" ? (
            <StockManager />
          ) : section === "Consumos" ? (
            <ConsumptionManager />
          ) : section === "Revisar datos" ? (
            <DataReviewManager />
          ) : section === "Equipamiento" ? (
            <EquipmentManager />
          ) : section === "Lista de compra" ? (
            <ShoppingListManager />
          ) : section === "Packs y lotes" ? (
            <PackManager />
          ) : section === "Calendario" ? (
            <CalendarManager />
          ) : section === "Mi hogar" ? (
            <HouseholdManager />
          ) : section === "Autonomía" ? (
            <AutonomyManager />
          ) : (
            <GenericSection section={section} />
          )}
        </div>
      </main>
    </div>
  );
}
function GenericSection({ section }: { section: string }) {
  const description =
    "Esta sección está preparada para tus datos y configuración.";
  return (
    <>
      <div className="mb-8 flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <div className="mb-3 flex items-center gap-2 text-xs font-semibold text-emerald-600">
            <Home size={14} /> Espacio personal
          </div>
          <h2 className="text-3xl font-bold tracking-tight text-slate-950">
            {section}
          </h2>
          <p className="mt-2 text-sm text-slate-500">{description}</p>
        </div>
      </div>
      <section className="flex min-h-[320px] flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center shadow-sm">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
          <Leaf size={27} />
        </div>
        <h3 className="mt-5 text-lg font-bold text-slate-900">
          No hay datos todavía
        </h3>
        <p className="mt-2 max-w-md text-sm leading-6 text-slate-500">
          {description}
        </p>
      </section>
      <p className="mt-6 flex items-center gap-2 text-xs text-slate-400">
        <ChevronRight size={14} /> Todos los menús están conectados a su propia
        ruta.
      </p>
    </>
  );
}
