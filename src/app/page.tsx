"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Leaf, LockKeyhole, UserRound } from "lucide-react";

export default function LoginPage() {
  const [username, setUsername] = useState("jose");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    if (!response.ok) {
      setError("Usuario o contraseña incorrectos.");
      setLoading(false);
      return;
    }
    router.push("/dashboard");
  }
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f3f1e8] px-5">
      <div className="prepper-panel w-full max-w-md rounded-3xl border bg-[#fffefa] p-8">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#66734a] text-white shadow-lg shadow-[#66734a]/20">
            <Leaf size={22} fill="currentColor" />
          </div>
          <div>
            <p className="text-lg font-bold">ReservaClara</p>
            <p className="prepper-eyebrow text-xs font-bold text-slate-500">
              Preparación · control · reserva
            </p>
          </div>
        </div>
        <div className="mt-10">
          <h1 className="text-2xl font-bold tracking-tight text-slate-950">
            Accede a tu reserva
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            Entra para consultar inventario, packs y autonomía.
          </p>
        </div>
        <form onSubmit={submit} className="mt-7 space-y-4">
          <label className="block text-sm font-semibold text-slate-700">
            Usuario
            <div className="relative mt-1.5">
              <UserRound
                className="absolute left-3 top-3 text-slate-400"
                size={16}
              />
              <input
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                className="h-11 w-full rounded-xl border border-[#d9d8cc] bg-[#fffefa] pl-10 pr-3 outline-none focus:border-[#66734a] focus:ring-2 focus:ring-[#dfe6cb]"
              />
            </div>
          </label>
          <label className="block text-sm font-semibold text-slate-700">
            Contraseña
            <div className="relative mt-1.5">
              <LockKeyhole
                className="absolute left-3 top-3 text-slate-400"
                size={16}
              />
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="h-11 w-full rounded-xl border border-[#d9d8cc] bg-[#fffefa] pl-10 pr-3 outline-none focus:border-[#66734a] focus:ring-2 focus:ring-[#dfe6cb]"
              />
            </div>
          </label>
          {error && (
            <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">
              {error}
            </p>
          )}
          <button
            disabled={loading}
            className="h-11 w-full rounded-xl bg-[#465335] text-sm font-bold text-white shadow-lg shadow-[#465335]/15 hover:bg-[#354126] disabled:opacity-60"
          >
            {loading ? "Comprobando..." : "Entrar"}
          </button>
        </form>
        <p className="mt-6 text-center text-xs text-slate-400">
          Acceso de administrador:{" "}
          <a className="font-semibold text-[#66734a]" href="/admin">
            /admin
          </a>
        </p>
      </div>
    </main>
  );
}
