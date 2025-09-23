import { setupTestContainersVitest } from "pagopa-interop-commons-test";
import { afterEach, inject } from "vitest";
import { Purpose, Tenant } from "pagopa-interop-models";
import {
  upsertPurpose,
  upsertTenant,
} from "pagopa-interop-readmodel/testUtils";
import { readModelServiceBuilderSQL } from "../src/services/readModelServiceSQL.js";

export const { cleanup, postgresDB, readModelDB } =
  await setupTestContainersVitest(
    inject("eventStoreConfig"),
    undefined,
    undefined,
    undefined,
    undefined,
    inject("readModelSQLConfig")
  );

afterEach(cleanup);

export const readModelService = readModelServiceBuilderSQL(readModelDB);

export const seedTenants = async (tenants: Tenant[]): Promise<void> => {
  for (const t of tenants) {
    await upsertTenant(readModelDB, t, 0);
  }
};

export const seedPurposes = async (purposes: Purpose[]): Promise<void> => {
  for (const p of purposes) {
    await upsertPurpose(readModelDB, p, 0);
  }
};
