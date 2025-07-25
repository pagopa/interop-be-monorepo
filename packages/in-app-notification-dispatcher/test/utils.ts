import { setupTestContainersVitest } from "pagopa-interop-commons-test";
import { Agreement, EService, Purpose, Tenant } from "pagopa-interop-models";
import { afterEach, inject } from "vitest";
import {
  agreementReadModelServiceBuilder,
  catalogReadModelServiceBuilder,
  purposeReadModelServiceBuilder,
  tenantReadModelServiceBuilder,
  notificationConfigReadModelServiceBuilder,
} from "pagopa-interop-readmodel";
import {
  upsertAgreement,
  upsertEService,
} from "pagopa-interop-readmodel/testUtils";
import { readModelServiceBuilderSQL } from "../src/services/readModelServiceSQL.js";

export const { cleanup, readModelDB } = await setupTestContainersVitest(
  undefined,
  undefined,
  undefined,
  undefined,
  undefined,
  undefined,
  inject("readModelSQLConfig")
);

const agreementReadModelServiceSQL =
  agreementReadModelServiceBuilder(readModelDB);
const catalogReadModelServiceSQL = catalogReadModelServiceBuilder(readModelDB);
const purposeReadModelServiceSQL = purposeReadModelServiceBuilder(readModelDB);
const tenantReadModelServiceSQL = tenantReadModelServiceBuilder(readModelDB);
const notificationConfigReadModelServiceSQL =
  notificationConfigReadModelServiceBuilder(readModelDB);

export const readModelService = readModelServiceBuilderSQL({
  agreementReadModelServiceSQL,
  catalogReadModelServiceSQL,
  tenantReadModelServiceSQL,
  notificationConfigReadModelServiceSQL,
});

export const interopFeBaseUrl = "http://localhost/fe";

export const addOneTenant = async (tenant: Tenant): Promise<void> => {
  await tenantReadModelServiceSQL.upsertTenant(tenant, 0);
};

export const addOneAgreement = async (agreement: Agreement): Promise<void> => {
  await upsertAgreement(readModelDB, agreement, 0);
};

export const addOneEService = async (eservice: EService): Promise<void> => {
  await upsertEService(readModelDB, eservice, 0);
};

export const addOnePurpose = async (purpose: Purpose): Promise<void> => {
  await purposeReadModelServiceSQL.upsertPurpose(purpose, 0);
};

afterEach(cleanup);
