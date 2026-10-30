import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "node prisma/seed.mjs",
  },
  engine: "classic",
  datasource: {
    // Generation must work in Vercel's install step before the database is provisioned.
    // Migrations still use DATABASE_URL when it is present.
    url: process.env.DATABASE_URL ?? "postgresql://user:password@localhost:5432/reserva_clara",
  },
});
