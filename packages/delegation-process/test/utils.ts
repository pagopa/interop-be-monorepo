/* eslint-disable functional/no-let */
import {
  randomArrayItem,
  ReadEvent,
  readLastEventByStreamId,
  setupTestContainersVitest,
  StoredEvent,
  writeInEventstore,
  writeInReadmodel,
} from "pagopa-interop-commons-test/index.js";
import {
  Delegation,
  DelegationEvent,
  DelegationId,
  DelegationState,
  delegationState,
  EService,
  Tenant,
  toDelegationV2,
  toReadModelEService,
  toReadModelTenant,
} from "pagopa-interop-models";
import { afterAll, afterEach, inject, vi } from "vitest";
import {
  initPDFGenerator,
  launchPuppeteerBrowser,
} from "pagopa-interop-commons";
import puppeteer, { Browser } from "puppeteer";
import { delegationProducerServiceBuilder } from "../src/services/delegationProducerService.js";
import { delegationServiceBuilder } from "../src/services/delegationService.js";
import { readModelServiceBuilder } from "../src/services/readModelService.js";
import { delegationNotActivableStates } from "../src/services/validators.js";

export const getRandomValidDelegationStatus = (): DelegationState =>
  randomArrayItem(
    Object.values(delegationState).filter(
      (s) => !delegationNotActivableStates.includes(s)
    )
  );

export const { cleanup, readModelRepository, postgresDB, fileManager } =
  await setupTestContainersVitest(
    inject("readModelConfig"),
    inject("eventStoreConfig"),
    inject("fileManagerConfig")
  );
afterEach(cleanup);

export const delegations = readModelRepository.delegations;
export const eservices = readModelRepository.eservices;
export const tenants = readModelRepository.tenants;

export const readModelService = readModelServiceBuilder(readModelRepository);

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

export const delegationProducerService = delegationProducerServiceBuilder(
  postgresDB,
  readModelService,
  pdfGenerator,
  fileManager
);

export const delegationService = delegationServiceBuilder(readModelService);

export const writeDelegationInEventstore = async (
  delegation: Delegation
): Promise<void> => {
  const delegationEvent: DelegationEvent = {
    type: "DelegationSubmitted",
    event_version: 2,
    data: { delegation: toDelegationV2(delegation) },
  };
  const eventToWrite: StoredEvent<DelegationEvent> = {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    stream_id: delegationEvent.data.delegation!.id,
    version: 0,
    event: delegationEvent,
  };

  await writeInEventstore(eventToWrite, "delegation", postgresDB);
};

export const readLastDelegationEvent = async (
  delegationId: DelegationId
): Promise<ReadEvent<DelegationEvent>> =>
  await readLastEventByStreamId(delegationId, "delegation", postgresDB);

export const addOneDelegation = async (
  delegation: Delegation
): Promise<void> => {
  await writeInReadmodel(delegation, delegations);
  await writeDelegationInEventstore(delegation);
};

export const addOneTenant = async (tenant: Tenant): Promise<void> => {
  await writeInReadmodel(toReadModelTenant(tenant), tenants);
};
export const addOneEservice = async (eservice: EService): Promise<void> => {
  await writeInReadmodel(toReadModelEService(eservice), eservices);
};

export function areBuffersSimilar(
  buffer1: Buffer,
  buffer2: Buffer,
  threshold = 0.99
): boolean {
  if (buffer1.length !== buffer2.length) {
    return false;
  }

  let matchingBytes = 0;

  for (let i = 0; i < buffer1.length; i++) {
    if (buffer1[i] === buffer2[i]) {
      matchingBytes++;
    }
  }

  const similarity = matchingBytes / buffer1.length;
  return similarity >= threshold;
}
