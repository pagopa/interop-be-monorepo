import {
  Agreement,
  Attribute,
  EService,
  EServiceEvent,
  EServiceId,
  Tenant,
  toEServiceV2,
  toReadModelAttribute,
  toReadModelEService,
  toReadModelTenant,
  toReadModelAgreement,
  Delegation,
} from "pagopa-interop-models";
import {
  ReadEvent,
  StoredEvent,
  readLastEventByStreamId,
  setupTestContainersVitest,
  writeInEventstore,
  writeInReadmodel,
} from "pagopa-interop-commons-test/index.js";
import { inject, afterEach } from "vitest";
import { catalogServiceBuilder } from "../src/services/catalogService.js";
import { readModelServiceBuilder } from "../src/services/readModelService.js";

export const { cleanup, readModelRepository, postgresDB, fileManager } =
  await setupTestContainersVitest(
    inject("readModelConfig"),
    inject("eventStoreConfig"),
    inject("fileManagerConfig")
  );

afterEach(cleanup);

export const agreements = readModelRepository.agreements;
export const eservices = readModelRepository.eservices;
export const tenants = readModelRepository.tenants;
export const attributes = readModelRepository.attributes;
export const delegations = readModelRepository.delegations;

export const readModelService = readModelServiceBuilder(readModelRepository);

export const catalogService = catalogServiceBuilder(
  postgresDB,
  readModelService,
  fileManager
);

export const writeEServiceInEventstore = async (
  eservice: EService
): Promise<void> => {
  const eserviceEvent: EServiceEvent = {
    type: "EServiceAdded",
    event_version: 2,
    data: { eservice: toEServiceV2(eservice) },
  };
  const eventToWrite: StoredEvent<EServiceEvent> = {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    stream_id: eserviceEvent.data.eservice!.id,
    version: 0,
    event: eserviceEvent,
  };

  await writeInEventstore(eventToWrite, "catalog", postgresDB);
};

export const addOneEService = async (eservice: EService): Promise<void> => {
  await writeEServiceInEventstore(eservice);
  await writeInReadmodel(toReadModelEService(eservice), eservices);
};

export const addOneAttribute = async (attribute: Attribute): Promise<void> => {
  await writeInReadmodel(toReadModelAttribute(attribute), attributes);
};

export const addOneTenant = async (tenant: Tenant): Promise<void> => {
  await writeInReadmodel(toReadModelTenant(tenant), tenants);
};

export const addOneAgreement = async (agreement: Agreement): Promise<void> => {
  await writeInReadmodel(toReadModelAgreement(agreement), agreements);
};

export const addOneDelegation = async (
  delegation: Delegation
): Promise<void> => {
  await writeInReadmodel(delegation, delegations);
};

export const readLastEserviceEvent = async (
  eserviceId: EServiceId
): Promise<ReadEvent<EServiceEvent>> =>
  await readLastEventByStreamId(eserviceId, "catalog", postgresDB);
