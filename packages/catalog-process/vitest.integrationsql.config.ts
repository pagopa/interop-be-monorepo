import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globalSetup: ["./test/vitestIntegrationGlobalSetup.ts"],
    include: ["./test/integration/**/*.test.ts"],
    testTimeout: 120_000, // Aumentato a 120s per test di integrazione lenti con Testcontainers
    hookTimeout: 120_000, // Aumentato per hook che inizializzano container
    fileParallelism: false, // Mantenuto per evitare conflitti con Testcontainers
    pool: "threads", // Cambiato da 'forks' a 'threads' per migliore parallelismo
    poolOptions: {
      threads: {
        maxThreads: 8, // Allineato a maxConcurrency=8 nel workflow
        minThreads: 2, // Garantisce un minimo di parallelismo
      },
    },
    clearMocks: true,
    restoreMocks: true,
    mockReset: true,
    reporters: ["default", "verbose"], // Aggiunto 'verbose' per debug su CI
    env: {
      FEATURE_FLAG_SQL: "true",
      TESTCONTAINERS_REUSE_ENABLE: "true", // Abilita riutilizzo container
    },
    watch: false,
    maxConcurrency: 8, // Esplicito, allineato al workflow
  },
});
