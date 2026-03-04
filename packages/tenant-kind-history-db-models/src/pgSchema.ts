import { pgSchema } from "drizzle-orm/pg-core";
import { TenantKindHistoryDBConfig } from "pagopa-interop-commons";

const config = TenantKindHistoryDBConfig.parse(process.env);

export const tenantKindHistorySchema = pgSchema(config.tenantKindHistoryDBSchema);
