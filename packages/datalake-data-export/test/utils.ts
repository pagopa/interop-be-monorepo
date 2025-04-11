/* eslint-disable functional/no-let */
/* eslint-disable @typescript-eslint/no-non-null-assertion */
import {
  setupTestContainersVitest,
  writeInReadmodel,
} from "pagopa-interop-commons-test";
import { afterEach, inject } from "vitest";
import {
  AgreementCollection,
  AttributeCollection,
  EServiceCollection,
  GenericCollection,
  PurposeCollection,
  TenantCollection,
} from "pagopa-interop-commons";
import {
  agreementReadModelServiceBuilder,
  catalogReadModelServiceBuilder,
  purposeReadModelServiceBuilder,
  tenantReadModelServiceBuilder,
} from "pagopa-interop-readmodel";
import { Agreement, EService, Purpose, Tenant } from "pagopa-interop-models";
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

const oldReadModelService = readModelServiceBuilder(readModelRepository);

const agreementReadModelServiceSQL =
  agreementReadModelServiceBuilder(readModelDB);
const catalogReadModelServiceSQL = catalogReadModelServiceBuilder(readModelDB);
const purposeReadModelServiceSQL = purposeReadModelServiceBuilder(readModelDB);
const tenantReadModelServiceSQL = tenantReadModelServiceBuilder(readModelDB);
const readModelServiceSQL = readModelServiceBuilderSQL({
  readModelDB,
  agreementReadModelServiceSQL,
  catalogReadModelServiceSQL,
  tenantReadModelServiceSQL,
});
export const readModelService =
  config.featureFlagSQL &&
  config.readModelSQLDbHost &&
  config.readModelSQLDbPort
    ? readModelServiceSQL
    : oldReadModelService;

export async function seedCollection<T>(
  data: T[],
  collection: GenericCollection<T>
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

export const seedAgreements = async (
  agreements: Agreement[]
): Promise<void> => {
  for (const a of agreements) {
    await agreementReadModelServiceSQL.upsertAgreement(a, 0);
  }
};

export const seedPurposes = async (purposes: Purpose[]): Promise<void> => {
  for (const p of purposes) {
    await purposeReadModelServiceSQL.upsertPurpose(p, 0);
  }
};

export const seedEServices = async (eservices: EService[]): Promise<void> => {
  for (const e of eservices) {
    await catalogReadModelServiceSQL.upsertEService(e, 0);
  }
};
