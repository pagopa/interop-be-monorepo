/* eslint-disable @typescript-eslint/no-non-null-assertion */
import {
  initPDFGenerator,
  launchPuppeteerBrowser,
} from "pagopa-interop-commons";
import {
  ReadEvent,
  StoredEvent,
  readLastEventByStreamId,
  setupTestContainersVitest,
  sortPurpose,
  writeInEventstore,
  writeInReadmodel,
} from "pagopa-interop-commons-test";
import {
  EService,
  Purpose,
  PurposeEvent,
  toPurposeV2,
  toReadModelPurpose,
  toReadModelEService,
  Tenant,
  toReadModelTenant,
  toReadModelAgreement,
  Agreement,
  Delegation,
  PurposeId,
  ListResult,
} from "pagopa-interop-models";
import { afterAll, afterEach, expect, inject, vi } from "vitest";
import puppeteer, { Browser } from "puppeteer";
import {
  agreementReadModelServiceBuilder,
  catalogReadModelServiceBuilder,
  delegationReadModelServiceBuilder,
  purposeReadModelServiceBuilder,
  tenantReadModelServiceBuilder,
} from "pagopa-interop-readmodel";
import {
  upsertAgreement,
  upsertDelegation,
  upsertEService,
  upsertPurpose,
} from "pagopa-interop-readmodel/testUtils";
import { readModelServiceBuilder } from "../src/services/readModelService.js";
import { purposeServiceBuilder } from "../src/services/purposeService.js";
import { config } from "../src/config/config.js";
import { readModelServiceBuilderSQL } from "../src/services/readModelServiceSQL.js";

export const {
  cleanup,
  readModelRepository,
  postgresDB,
  fileManager,
  readModelDB,
} = await setupTestContainersVitest(
  inject("readModelConfig"),
  inject("eventStoreConfig"),
  inject("fileManagerConfig"),
  undefined,
  undefined,
  undefined,
  inject("readModelSQLConfig")
);

afterEach(cleanup);

export const agreements = readModelRepository.agreements;
export const eservices = readModelRepository.eservices;
export const tenants = readModelRepository.tenants;
export const attributes = readModelRepository.attributes;
export const purposes = readModelRepository.purposes;
export const delegations = readModelRepository.delegations;

export const purposeReadModelServiceSQL =
  purposeReadModelServiceBuilder(readModelDB);
export const catalogReadModelServiceSQL =
  catalogReadModelServiceBuilder(readModelDB);
export const tenantReadModelServiceSQL =
  tenantReadModelServiceBuilder(readModelDB);
export const agreementReadModelServiceSQL =
  agreementReadModelServiceBuilder(readModelDB);
export const delegationReadModelServiceSQL =
  delegationReadModelServiceBuilder(readModelDB);

const oldReadModelService = readModelServiceBuilder(readModelRepository);
const readModelServiceSQL = readModelServiceBuilderSQL({
  readModelDB,
  purposeReadModelServiceSQL,
  catalogReadModelServiceSQL,
  tenantReadModelServiceSQL,
  agreementReadModelServiceSQL,
  delegationReadModelServiceSQL,
});
export const readModelService =
  config.featureFlagSQL &&
  config.readModelSQLDbHost &&
  config.readModelSQLDbPort
    ? readModelServiceSQL
    : oldReadModelService;

const testBrowserInstance: Browser = await launchPuppeteerBrowser({
  pipe: true,
});
const closeTestBrowserInstance = async (): Promise<void> =>
  await testBrowserInstance.close();

afterAll(closeTestBrowserInstance);

vi.spyOn(puppeteer, "launch").mockImplementation(
  async () => testBrowserInstance
);
export const pdfGenerator = await initPDFGenerator();

export const purposeService = purposeServiceBuilder(
  postgresDB,
  readModelService,
  fileManager,
  pdfGenerator
);

export const addOnePurpose = async (purpose: Purpose): Promise<void> => {
  await writePurposeInEventstore(purpose);
  await writeInReadmodel(toReadModelPurpose(purpose), purposes);

  await upsertPurpose(readModelDB, purpose, 0);
};

export const addOneEService = async (eservice: EService): Promise<void> => {
  await writeInReadmodel(toReadModelEService(eservice), eservices);

  await upsertEService(readModelDB, eservice, 0);
};

export const addOneTenant = async (tenant: Tenant): Promise<void> => {
  await writeInReadmodel(toReadModelTenant(tenant), tenants);

  await tenantReadModelServiceSQL.upsertTenant(tenant, 0);
};

export const addOneAgreement = async (agreement: Agreement): Promise<void> => {
  await writeInReadmodel(toReadModelAgreement(agreement), agreements);

  await upsertAgreement(readModelDB, agreement, 0);
};

export const addOneDelegation = async (
  delegation: Delegation
): Promise<void> => {
  await writeInReadmodel(delegation, delegations);

  await upsertDelegation(readModelDB, delegation, 0);
};

export const writePurposeInEventstore = async (
  purpose: Purpose
): Promise<void> => {
  const purposeEvent: PurposeEvent = {
    type: "PurposeAdded",
    event_version: 2,
    data: { purpose: toPurposeV2(purpose) },
  };
  const eventToWrite: StoredEvent<PurposeEvent> = {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    stream_id: purposeEvent.data.purpose!.id,
    version: 0,
    event: purposeEvent,
  };

  await writeInEventstore(eventToWrite, "purpose", postgresDB);
};

export const readLastPurposeEvent = async (
  purposeId: PurposeId
): Promise<ReadEvent<PurposeEvent>> =>
  await readLastEventByStreamId(purposeId, "purpose", postgresDB);

export function expectSinglePageListResult(
  actual: ListResult<Purpose>,
  expected: Purpose[]
): void {
  expect({
    totalCount: actual.totalCount,
    results: actual.results.map(sortPurpose),
  }).toEqual({
    totalCount: expected.length,
    results: expected.map(sortPurpose),
  });
  expect(actual.results).toHaveLength(expected.length);
}
