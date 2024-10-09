import {
  setupTestContainersVitest,
  writeInReadmodel,
} from "pagopa-interop-commons-test/index.js";
import {
  Delegation,
  DelegationState,
  EServiceId,
  TenantId,
  generateId,
} from "pagopa-interop-models";
import { afterEach, inject } from "vitest";
import { delegationProducerServiceBuilder } from "../src/services/delegationProducerService.js";
import { readModelServiceBuilder } from "../src/services/readModelService.js";

export const { cleanup, readModelRepository } = await setupTestContainersVitest(
  inject("readModelConfig")
);
afterEach(cleanup);

export const delegations = readModelRepository.delegations;

export const readModelService = readModelServiceBuilder(readModelRepository);

export const delegationService =
  delegationProducerServiceBuilder(readModelService);

export const getMockDelegation = ({
  delegatorId,
  delegateId,
  eserviceId,
  state,
}: {
  delegatorId?: TenantId;
  delegateId?: TenantId;
  eserviceId?: EServiceId;
  state?: DelegationState;
} = {}): Delegation => ({
  id: generateId(),
  delegatorId: delegatorId ?? generateId(),
  delegateId: delegateId ?? generateId(),
  eserviceId: eserviceId ?? generateId(),
  createdAt: new Date(),
  submittedAt: new Date(),
  state: state ?? "WaitingForApproval",
  kind: "DelegatedConsumer",
  contract: {
    id: generateId(),
    name: "Contract Name",
    prettyName: "Pretty Contract Name",
    contentType: "application/pdf",
    path: "/contracts/contract-id-789.pdf",
    createdAt: new Date(),
  },
  stamps: {
    submission: {
      who: generateId(),
      when: new Date(),
    },
  },
});

export const addOneDelegation = async (
  delegation: Delegation
): Promise<void> => {
  await writeInReadmodel(delegation, delegations);
};
