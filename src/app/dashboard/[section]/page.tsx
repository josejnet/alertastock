import { AppShell } from "@/components/app-shell";
const titles: Record<string, string> = { inventario: "Inventario", consumos: "Consumos", revisar: "Revisar datos", equipamiento: "Equipamiento", "lista-compra": "Lista de compra", packs: "Packs y lotes", calendario: "Calendario", autonomia: "Autonomía", hogar: "Mi hogar", configuracion: "Configuración", admin: "Administración" };
export default async function SectionPage({ params }: { params: Promise<{ section: string }> }) { const { section } = await params; return <AppShell section={titles[section] ?? "Resumen"} />; }
