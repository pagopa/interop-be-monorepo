/* eslint-disable functional/no-let */
/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { setupTestContainersVitest } from "pagopa-interop-commons-test";
import { afterEach, inject } from "vitest";
import { eserviceTemplateReadModelServiceBuilder } from "pagopa-interop-readmodel";
import {
  Agreement,
  EService,
  Purpose,
  Tenant,
  Delegation,
  EServiceTemplate,
} from "pagopa-interop-models";
import {
  upsertAgreement,
  upsertDelegation,
  upsertEService,
  upsertEServiceTemplate,
  upsertPurpose,
  upsertTenant,
} from "pagopa-interop-readmodel/testUtils";
import { readModelServiceBuilderSQL } from "../src/services/readModelServiceSQL.js";

export const { cleanup, readModelDB } = await setupTestContainersVitest(
  undefined,
  undefined,
  undefined,
  undefined,
  undefined,
  inject("readModelSQLConfig")
);

afterEach(cleanup);

eserviceTemplateReadModelServiceBuilder(readModelDB);
export const readModelService = readModelServiceBuilderSQL(readModelDB);

export const seedTenants = async (tenants: Tenant[]): Promise<void> => {
  for (const t of tenants) {
    await upsertTenant(readModelDB, t, 0);
  }
};

export const seedAgreements = async (
  agreements: Agreement[]
): Promise<void> => {
  for (const a of agreements) {
    await upsertAgreement(readModelDB, a, 0);
  }
};

export const seedPurposes = async (purposes: Purpose[]): Promise<void> => {
  for (const p of purposes) {
    await upsertPurpose(readModelDB, p, 0);
  }
};

export const seedEServices = async (eservices: EService[]): Promise<void> => {
  for (const e of eservices) {
    await upsertEService(readModelDB, e, 0);
  }
};

export const seedDelegations = async (
  delegations: Delegation[]
): Promise<void> => {
  for (const d of delegations) {
    await upsertDelegation(readModelDB, d, 0);
  }
};

export const seedEServiceTemplates = async (
  eserviceTemplates: EServiceTemplate[]
): Promise<void> => {
  for (const e of eserviceTemplates) {
    await upsertEServiceTemplate(readModelDB, e, 0);
  }
};
