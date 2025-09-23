/* eslint-disable functional/no-let */
/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { setupTestContainersVitest } from "pagopa-interop-commons-test";
import { afterEach, inject } from "vitest";
import {
  AgreementCollection,
  AttributeCollection,
  EServiceCollection,
  PurposeCollection,
  TenantCollection,
  DelegationCollection,
  EServiceTemplateCollection,
} from "pagopa-interop-commons";
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
import { readModelServiceBuilder } from "../src/services/readModelService.js";
import { readModelServiceBuilderSQL } from "../src/services/readModelServiceSQL.js";

import { config } from "../src/config/config.js";

export const { cleanup, readModelRepository, readModelDB } =
  await setupTestContainersVitest(
    inject("readModelConfig"),
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    inject("readModelSQLConfig")
  );

afterEach(cleanup);

export const agreements: AgreementCollection = readModelRepository.agreements;
export const eservices: EServiceCollection = readModelRepository.eservices;
export const tenants: TenantCollection = readModelRepository.tenants;
export const attributes: AttributeCollection = readModelRepository.attributes;
export const purposes: PurposeCollection = readModelRepository.purposes;
export const delegations: DelegationCollection =
  readModelRepository.delegations;
export const eserviceTemplates: EServiceTemplateCollection =
  readModelRepository.eserviceTemplates;

const oldReadModelService = readModelServiceBuilder(readModelRepository);

eserviceTemplateReadModelServiceBuilder(readModelDB);
const readModelServiceSQL = readModelServiceBuilderSQL(readModelDB);

export const readModelService =
  config.featureFlagSQL &&
  config.readModelSQLDbHost &&
  config.readModelSQLDbPort
    ? readModelServiceSQL
    : oldReadModelService;

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
