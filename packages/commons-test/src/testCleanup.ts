/* eslint-disable functional/no-let */
// test/utils/test-cleanup.ts (MODIFICATO)
// Non importare più 'inject' qui!
// import { inject } from "vitest"; // <-- Rimuovi questa riga!
import {
  AWSSesConfig,
  AnalyticsSQLDbConfig,
  EventStoreConfig,
  FileManagerConfig,
  ReadModelDbConfig,
  ReadModelSQLDbConfig,
  RedisRateLimiterConfig,
  S3Config,
  TokenGenerationReadModelDbConfig,
} from "pagopa-interop-commons";
import { z } from "zod"; // Per i tipi se necessario, o importa direttamente i tuoi tipi estesi
import { setupTestContainersVitest } from "./setupTestContainersVitest.js";
import { PecEmailManagerConfigTest } from "./testConfig.js";

// Puoi redefinire i tipi di configurazione estesi qui se non sono già importabili
// o importali dal tuo globalSetup se sono esportati.
// Esempio:
const LoggerConfig = z.object({
  logLevel: z.enum(["debug", "info", "warn", "error"]),
});
type LoggerConfig = z.infer<typeof LoggerConfig>;

const EnhancedFileManagerConfigSchema = z.object({
  s3AccessKeyId: z.string(),
  s3SecretAccessKey: z.string(),
});
type EnhancedFileManagerConfig = FileManagerConfig &
  S3Config &
  z.infer<typeof EnhancedFileManagerConfigSchema>;

const EnhancedTokenGenerationReadModelDbConfig =
  TokenGenerationReadModelDbConfig.and(
    z.object({
      tokenGenerationReadModelDbPort: z.number(),
      tokenGenerationReadModelDbHost: z.string().optional(),
    })
  );
type EnhancedTokenGenerationReadModelDbConfig = z.infer<
  typeof EnhancedTokenGenerationReadModelDbConfig
>;
type TestConfigs = {
  readModelConfig?: ReadModelDbConfig;
  readModelSQLConfig?: ReadModelSQLDbConfig;
  tokenGenerationReadModelConfig?: EnhancedTokenGenerationReadModelDbConfig;
  eventStoreConfig?: EventStoreConfig;
  fileManagerConfig?: EnhancedFileManagerConfig & LoggerConfig;
  redisRateLimiterConfig?: RedisRateLimiterConfig;
  emailManagerConfig?: PecEmailManagerConfigTest;
  sesEmailManagerConfig?: AWSSesConfig;
  analyticsSQLDbConfig?: AnalyticsSQLDbConfig;
};

let cachedCleanupFunction:
  | ((configs: TestConfigs) => Promise<void>)
  | undefined; // Modifica qui

/**
 * Funzione per eseguire la pulizia del database e delle risorse S3/Mailpit.
 * Questa funzione ora accetta le configurazioni come argomenti.
 * Dovrebbe essere chiamata nel `beforeEach` dei tuoi test.
 */
export async function testCleanup(
  configs: TestConfigs // Le configurazioni vengono passate qui
): Promise<void> {
  if (!cachedCleanupFunction) {
    // Chiama setupTestContainersVitest una volta per ottenere la funzione di cleanup
    const { cleanup } = await setupTestContainersVitest(
      configs.readModelConfig,
      configs.eventStoreConfig,
      configs.fileManagerConfig,
      configs.emailManagerConfig,
      configs.redisRateLimiterConfig,
      configs.sesEmailManagerConfig,
      configs.readModelSQLConfig,
      configs.analyticsSQLDbConfig
    );
    cachedCleanupFunction = cleanup;
  }
  // Esegui la funzione di cleanup
  await cachedCleanupFunction(configs); // Passa le configurazioni alla cleanup se necessario (dipende da come l'hai implementata)
  // eslint-disable-next-line no-console
  console.log("Database and resources cleaned up.");
}
