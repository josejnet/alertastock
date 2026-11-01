"use client";
import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Leaf, LockKeyhole } from "lucide-react";
export default function AdminLoginPage() {
  const [password, setPassword] = useState("");
  const router = useRouter();
  const [error, setError] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "admin", password }),
    });
    if (!response.ok) {
      setError("Contraseña incorrecta.");
      return;
    }
    router.push("/dashboard/admin");
  }
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 px-5">
      <form
        onSubmit={submit}
        className="w-full max-w-md rounded-3xl bg-white p-8 shadow-2xl"
      >
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-500 text-white">
            <Leaf size={22} fill="currentColor" />
          </div>
          <div>
            <p className="text-lg font-bold">AlertaStock</p>
            <p className="text-xs uppercase tracking-[0.18em] text-slate-400">
              Superadministración
            </p>
          </div>
        </div>
        <h1 className="mt-10 text-2xl font-bold">Panel de administración</h1>
        <p className="mt-2 text-sm text-slate-500">
          Acceso restringido al superusuario.
        </p>
        <label className="mt-7 block text-sm font-semibold">
          Contraseña
          <div className="relative mt-1.5">
            <LockKeyhole
              className="absolute left-3 top-3 text-slate-400"
              size={16}
            />
            <input
              autoFocus
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="h-11 w-full rounded-xl border border-slate-200 pl-10 pr-3 outline-none focus:border-emerald-500"
            />
          </div>
        </label>
        {error && (
          <p className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {error}
          </p>
        )}
        <button className="mt-6 h-11 w-full rounded-xl bg-slate-900 text-sm font-bold text-white hover:bg-slate-800">
          Entrar como Admin
        </button>
        <Link
          href="/"
          className="mt-5 block text-center text-xs font-semibold text-emerald-600"
        >
          Volver al acceso de usuario
        </Link>
      </form>
    </main>
  );
}
