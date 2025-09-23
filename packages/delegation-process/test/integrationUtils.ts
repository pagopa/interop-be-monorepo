/* eslint-disable functional/no-let */
import {
  ReadEvent,
  readEventByStreamIdAndVersion,
  readLastEventByStreamId,
  setupTestContainersVitest,
  StoredEvent,
  writeInEventstore,
} from "pagopa-interop-commons-test";
import {
  Agreement,
  Delegation,
  DelegationEvent,
  DelegationId,
  EService,
  Tenant,
  toDelegationV2,
} from "pagopa-interop-models";
import { afterAll, afterEach, inject, vi } from "vitest";
import {
  initPDFGenerator,
  launchPuppeteerBrowser,
} from "pagopa-interop-commons";
import puppeteer, { Browser } from "puppeteer";
import {
  agreementReadModelServiceBuilder,
  catalogReadModelServiceBuilder,
  delegationReadModelServiceBuilder,
  tenantReadModelServiceBuilder,
} from "pagopa-interop-readmodel";
import {
  upsertAgreement,
  upsertDelegation,
  upsertEService,
  upsertTenant,
} from "pagopa-interop-readmodel/testUtils";
import { delegationServiceBuilder } from "../src/services/delegationService.js";
import { readModelServiceBuilderSQL } from "../src/services/readModelServiceSQL.js";

export const { cleanup, postgresDB, fileManager, readModelDB } =
  await setupTestContainersVitest(
    inject("eventStoreConfig"),
    inject("fileManagerConfig"),
    undefined,
    undefined,
    undefined,
    inject("readModelSQLConfig")
  );

afterEach(cleanup);

const delegationReadModelServiceSQL =
  delegationReadModelServiceBuilder(readModelDB);
const catalogReadModelServiceSQL = catalogReadModelServiceBuilder(readModelDB);
const tenantReadModelServiceSQL = tenantReadModelServiceBuilder(readModelDB);
const agreementReadModelServiceSQL =
  agreementReadModelServiceBuilder(readModelDB);

export const readModelService = readModelServiceBuilderSQL({
  readModelDB,
  delegationReadModelServiceSQL,
  catalogReadModelServiceSQL,
  tenantReadModelServiceSQL,
  agreementReadModelServiceSQL,
});

const testBrowserInstance: Browser = await launchPuppeteerBrowser({
  pipe: true,
});
const closeTestBrowserInstance = async (): Promise<void> =>
  await testBrowserInstance.close();

afterAll(closeTestBrowserInstance);
afterAll(() => {
  vi.useRealTimers();
});

vi.spyOn(puppeteer, "launch").mockImplementation(
  async () => testBrowserInstance
);

export const pdfGenerator = await initPDFGenerator();

export const delegationService = delegationServiceBuilder(
  postgresDB,
  readModelService,
  pdfGenerator,
  fileManager
);

export const writeSubmitDelegationInEventstore = async (
  delegation: Delegation
): Promise<void> => {
  const createProducerDelegationEvent: DelegationEvent = {
    type: "ProducerDelegationSubmitted",
    event_version: 2,
    data: {
      delegation: toDelegationV2(delegation),
    },
  };

  const eventToWrite: StoredEvent<DelegationEvent> = {
    stream_id: delegation.id,
    version: 0,
    event: createProducerDelegationEvent,
  };

  await writeInEventstore(eventToWrite, "delegation", postgresDB);
};

export const readLastDelegationEvent = async (
  delegationId: DelegationId
): Promise<ReadEvent<DelegationEvent>> =>
  await readLastEventByStreamId(delegationId, "delegation", postgresDB);

export const readDelegationEventByVersion = async (
  delegationId: DelegationId,
  version: number
): Promise<ReadEvent<DelegationEvent>> =>
  await readEventByStreamIdAndVersion(
    delegationId,
    version,
    "delegation",
    postgresDB
  );

export const addOneDelegation = async (
  delegation: Delegation
): Promise<void> => {
  await writeSubmitDelegationInEventstore(delegation);
  await upsertDelegation(readModelDB, delegation, 0);
};

export const addOneTenant = async (tenant: Tenant): Promise<void> => {
  await upsertTenant(readModelDB, tenant, 0);
};
export const addOneEservice = async (eservice: EService): Promise<void> => {
  await upsertEService(readModelDB, eservice, 0);
};

export const addOneAgreement = async (agreement: Agreement): Promise<void> => {
  await upsertAgreement(readModelDB, agreement, 0);
};
