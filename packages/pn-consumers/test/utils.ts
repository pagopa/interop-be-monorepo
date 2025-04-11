import { GenericCollection } from "pagopa-interop-commons";
import {
  setupTestContainersVitest,
  writeInReadmodel,
} from "pagopa-interop-commons-test";
import { afterEach, inject } from "vitest";
import { Purpose, Tenant } from "pagopa-interop-models";
import {
  purposeReadModelServiceBuilder,
  tenantReadModelServiceBuilder,
} from "pagopa-interop-readmodel";
import { readModelServiceBuilder } from "../src/services/readModelService.js";
import { readModelServiceBuilderSQL } from "../src/services/readModelServiceSQL.js";
import { config } from "../src/configs/config.js";

export const { cleanup, readModelRepository, postgresDB, readModelDB } =
  await setupTestContainersVitest(
    inject("readModelConfig"),
    inject("eventStoreConfig"),
    undefined,
    undefined,
    undefined,
    undefined,
    inject("readModelSQLConfig")
  );

afterEach(cleanup);

export const { purposes, tenants } = readModelRepository;

const purposeReadModelServiceSQL = purposeReadModelServiceBuilder(readModelDB);
const tenantReadModelServiceSQL = tenantReadModelServiceBuilder(readModelDB);

const oldReadModelService = readModelServiceBuilder(readModelRepository);
const readModelServiceSQL = readModelServiceBuilderSQL(readModelDB);
export const readModelService =
  config.featureFlagSQL &&
  config.readModelSQLDbHost &&
  config.readModelSQLDbPort
    ? readModelServiceSQL
    : oldReadModelService;

export async function seedCollection<T>(
  collection: GenericCollection<T>,
  data: T[]
): Promise<void> {
  for (const d of data) {
    await writeInReadmodel(d, collection);
  }
}

export const seedTenants = async (tenants: Tenant[]): Promise<void> => {
  for (const t of tenants) {
    await tenantReadModelServiceSQL.upsertTenant(t, 0);
  }
};

export const seedPurposes = async (purposes: Purpose[]): Promise<void> => {
  for (const p of purposes) {
    await purposeReadModelServiceSQL.upsertPurpose(p, 0);
  }
};
