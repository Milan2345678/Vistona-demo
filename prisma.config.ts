import { defineConfig, env } from "prisma/config";
import { config as loadDotEnv } from "dotenv";

loadDotEnv({ path: ".env.local" });
loadDotEnv();

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: env("DATABASE_URL"),
  },
});
