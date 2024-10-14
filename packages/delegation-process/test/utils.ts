import {
  randomArrayItem,
  ReadEvent,
  readLastEventByStreamId,
  setupTestContainersVitest,
  writeInReadmodel,
} from "pagopa-interop-commons-test/index.js";
import {
  Delegation,
  DelegationEvent,
  DelegationId,
  delegationState,
  EService,
  Tenant,
  toReadModelEService,
  toReadModelTenant,
} from "pagopa-interop-models";
import { afterEach, inject } from "vitest";
import { delegationProducerServiceBuilder } from "../src/services/delegationProducerService.js";
import { readModelServiceBuilder } from "../src/services/readModelService.js";
import { delegationNotActivableStates } from "../src/services/validators.js";

export const getRandomValidDelegationStatus = (): DelegationState =>
  randomArrayItem(
    Object.values(delegationState).filter(
      (s) => !delegationNotActivableStates.includes(s)
    )
  );

export const { cleanup, readModelRepository, postgresDB } =
  await setupTestContainersVitest(
    inject("readModelConfig"),
    inject("eventStoreConfig")
  );
afterEach(cleanup);

export const delegations = readModelRepository.delegations;
export const eservices = readModelRepository.eservices;
export const tenants = readModelRepository.tenants;

export const readModelService = readModelServiceBuilder(readModelRepository);

export const delegationService = delegationProducerServiceBuilder(
  postgresDB,
  readModelService
);

export const readLastAgreementEvent = async (
  delegationId: DelegationId
): Promise<ReadEvent<DelegationEvent>> =>
  await readLastEventByStreamId(delegationId, "delegation", postgresDB);

export const addOneDelegation = async (
  delegation: Delegation
): Promise<void> => {
  await writeInReadmodel(delegation, delegations);
};

export const addOneTenant = async (tenant: Tenant): Promise<void> => {
  await writeInReadmodel(toReadModelTenant(tenant), tenants);
};
export const addOneEservice = async (eservice: EService): Promise<void> => {
  await writeInReadmodel(toReadModelEService(eservice), eservices);
};
