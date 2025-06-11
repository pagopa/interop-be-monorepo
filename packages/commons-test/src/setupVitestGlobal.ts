/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable no-console */
/* eslint-disable @typescript-eslint/ban-ts-comment */
/* eslint-disable @typescript-eslint/explicit-function-return-type */
/* eslint-disable functional/immutable-data */
/* eslint-disable functional/no-let */
import path from "path";
import { z } from "zod";
import { config as dotenvFlow } from "dotenv-flow";
import dotenv from "dotenv";
import type { ProvidedContext } from "vitest";
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
import type { TestProject } from "vitest/node";
import { PecEmailManagerConfigTest } from "./testConfig.js";

// Enhanced config per port override da .envPort
export const EnhancedTokenGenerationReadModelDbConfig =
  TokenGenerationReadModelDbConfig.and(
    z.object({ TOKEN_GENERATION_READ_MODEL_DB_PORT: z.coerce.number() })
  ).transform((env) => ({
    ...env,
    tokenGenerationReadModelDbPort: env.TOKEN_GENERATION_READ_MODEL_DB_PORT,
  }));

export type EnhancedTokenGenerationReadModelDbConfig = z.infer<
  typeof EnhancedTokenGenerationReadModelDbConfig
>;

// ✅ Augmentazione del contesto Vitest
declare module "vitest" {
  export interface ProvidedContext {
    readModelConfig?: ReadModelDbConfig;
    readModelSQLConfig?: ReadModelSQLDbConfig;
    tokenGenerationReadModelConfig?: EnhancedTokenGenerationReadModelDbConfig;
    eventStoreConfig?: EventStoreConfig;
    fileManagerConfig?: FileManagerConfig & S3Config;
    redisRateLimiterConfig?: RedisRateLimiterConfig;
    emailManagerConfig?: PecEmailManagerConfigTest;
    sesEmailManagerConfig?: AWSSesConfig;
    analyticsSQLDbConfig?: AnalyticsSQLDbConfig;
  }
}

export function setupVitestGlobal() {
  const packageRoot = process.cwd();
  const envPortPath = path.resolve(__dirname, "../../../.envPort");
  console.log(`📂 Caricamento variabili principali da: ${packageRoot}`);
  dotenvFlow({ path: packageRoot });
  console.log("✅ Variabili principali caricate con dotenv-flow");

  // Caricamento porte da .envPort
  console.log(`📂 Caricamento variabili porte da: ${envPortPath}`);
  dotenv.config({ path: envPortPath, override: true });

  return async function ({
    provide,
  }: TestProject): Promise<() => Promise<void>> {
    // Fix del tipo con callback
    const provideConfig = <K extends keyof ProvidedContext>(
      label: K,
      parseFn: () => z.SafeParseReturnType<any, ProvidedContext[K]>
    ) => {
      const parser = parseFn();
      if (parser.success) {
        provide(label, parser.data);
        console.log(`✅ Provided ${label}`);
      } else {
        console.log(`ℹ️ Skipped optional config ${label}`);
      }
    };

    provideConfig("eventStoreConfig", () =>
      EventStoreConfig.safeParse(process.env)
    );
    provideConfig("readModelSQLConfig", () =>
      ReadModelSQLDbConfig.safeParse(process.env)
    );
    provideConfig("analyticsSQLDbConfig", () =>
      AnalyticsSQLDbConfig.safeParse(process.env)
    );
    provideConfig("readModelConfig", () =>
      ReadModelDbConfig.safeParse(process.env)
    );
    provideConfig("redisRateLimiterConfig", () =>
      RedisRateLimiterConfig.safeParse(process.env)
    );
    provideConfig("sesEmailManagerConfig", () =>
      AWSSesConfig.safeParse(process.env)
    );
    provideConfig("emailManagerConfig", () =>
      PecEmailManagerConfigTest.safeParse(process.env)
    );

    // Config opzionale per Dynamo tokenGeneration
    provideConfig("tokenGenerationReadModelConfig", () =>
      EnhancedTokenGenerationReadModelDbConfig.safeParse(process.env)
    );

    // FileManager + S3 combinati
    const fileManagerParsed = FileManagerConfig.safeParse(process.env);
    const s3Parsed = S3Config.safeParse(process.env);
    if (fileManagerParsed.success) {
      provide("fileManagerConfig", {
        ...fileManagerParsed.data,
        s3Bucket: s3Parsed.success
          ? s3Parsed.data.s3Bucket
          : "interop-local-bucket",
      });
      console.log("✅ Provided fileManagerConfig with s3Bucket");
    } else {
      console.warn("⚠️ Failed to provide fileManagerConfig");
    }

    return async () => {
      // Nessuna logica di cleanup necessaria
    };
  };
}
