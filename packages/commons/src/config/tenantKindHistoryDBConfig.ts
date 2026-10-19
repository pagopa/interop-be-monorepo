import { z } from "zod";

export const TenantKindHistoryDBConfig = z
  .object({
    TENANT_KIND_HISTORY_DB_HOST: z.string().default("localhost"),
    TENANT_KIND_HISTORY_DB_NAME: z.string().default("root"),
    TENANT_KIND_HISTORY_DB_USERNAME: z.string().default("root"),
    TENANT_KIND_HISTORY_DB_PASSWORD: z.string().default("root"),
    TENANT_KIND_HISTORY_DB_PORT: z.coerce.number().min(1001).default(6008),
    TENANT_KIND_HISTORY_DB_USE_SSL: z
      .enum(["true", "false"])
      .transform((value) => value === "true")
      .default("false"),
    TENANT_KIND_HISTORY_DB_SCHEMA: z.string().default("tenant_kind_history"),
  })
  .transform((c) => ({
    tenantKindHistoryDBHost: c.TENANT_KIND_HISTORY_DB_HOST,
    tenantKindHistoryDBName: c.TENANT_KIND_HISTORY_DB_NAME,
    tenantKindHistoryDBUsername: c.TENANT_KIND_HISTORY_DB_USERNAME,
    tenantKindHistoryDBPassword: c.TENANT_KIND_HISTORY_DB_PASSWORD,
    tenantKindHistoryDBPort: c.TENANT_KIND_HISTORY_DB_PORT,
    tenantKindHistoryDBUseSSL: c.TENANT_KIND_HISTORY_DB_USE_SSL,
    tenantKindHistoryDBSchema: c.TENANT_KIND_HISTORY_DB_SCHEMA,
  }));

export type TenantKindHistoryDBConfig = z.infer<
  typeof TenantKindHistoryDBConfig
>;
