/* eslint-disable functional/no-let */
import {
  ReadEvent,
  readEventByStreamIdAndVersion,
  readLastEventByStreamId,
  setupTestContainersVitest,
  StoredEvent,
  writeInEventstore,
  writeInReadmodel,
} from "pagopa-interop-commons-test";
import {
  Agreement,
  Delegation,
  DelegationEvent,
  DelegationId,
  EService,
  Tenant,
  toDelegationV2,
  toReadModelAgreement,
  toReadModelEService,
  toReadModelTenant,
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
import { delegationServiceBuilder } from "../src/services/delegationService.js";
import { readModelServiceBuilder } from "../src/services/readModelService.js";
import { readModelServiceBuilderSQL } from "../src/services/readModelServiceSQL.js";
import { config } from "../src/config/config.js";

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

export const { delegations, agreements, eservices, tenants } =
  readModelRepository;

const delegationReadModelServiceSQL =
  delegationReadModelServiceBuilder(readModelDB);
const catalogReadModelServiceSQL = catalogReadModelServiceBuilder(readModelDB);
const tenantReadModelServiceSQL = tenantReadModelServiceBuilder(readModelDB);
const agreementReadModelServiceSQL =
  agreementReadModelServiceBuilder(readModelDB);

const oldReadModelService = readModelServiceBuilder(readModelRepository);
const readModelServiceSQL = readModelServiceBuilderSQL({
  readModelDB,
  delegationReadModelServiceSQL,
  catalogReadModelServiceSQL,
  tenantReadModelServiceSQL,
  agreementReadModelServiceSQL,
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
afterAll(() => {
  vi.useRealTimers();
});

vi.spyOn(puppeteer, "launch").mockImplementation(
  async () => testBrowserInstance
);

export const pdfGenerator = await initPDFGenerator();

export const delegationService = delegationServiceBuilder(
  readModelService,
  postgresDB,
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
  await writeInReadmodel(delegation, delegations);

  await delegationReadModelServiceSQL.upsertDelegation(delegation, 0);
};

export const addOneTenant = async (tenant: Tenant): Promise<void> => {
  await writeInReadmodel(toReadModelTenant(tenant), tenants);

  await tenantReadModelServiceSQL.upsertTenant(tenant, 0);
};
export const addOneEservice = async (eservice: EService): Promise<void> => {
  await writeInReadmodel(toReadModelEService(eservice), eservices);

  await catalogReadModelServiceSQL.upsertEService(eservice, 0);
};

export const addOneAgreement = async (agreement: Agreement): Promise<void> => {
  await writeInReadmodel(toReadModelAgreement(agreement), agreements);

  await agreementReadModelServiceSQL.upsertAgreement(agreement, 0);
};
