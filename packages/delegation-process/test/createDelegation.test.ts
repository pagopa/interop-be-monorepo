import { fail } from "assert";
import { randomUUID } from "crypto";
import { genericLogger } from "pagopa-interop-commons";
import {
  decodeProtobufPayload,
  getMockDelegationProducer,
  getMockEService,
  getMockTenant,
  getRandomAuthData,
  randomArrayItem,
} from "pagopa-interop-commons-test";
import {
  Delegation,
  DelegationId,
  delegationKind,
  DelegationState,
  delegationState,
  DelegationSubmittedV2,
  EServiceId,
  generateId,
  TenantId,
  toDelegationV2,
} from "pagopa-interop-models";
import { describe, expect, it, vi } from "vitest";
import {
  delegationAlreadyExists,
  delegatorAndDelegateSameIdError,
  eserviceNotFound,
  invalidExternalOriginError,
  tenantNotFound,
} from "../src/model/domain/errors.js";

import { delegationNotActivableStates } from "../src/services/validators.js";
import {
  addOneDelegation,
  addOneEservice,
  addOneTenant,
  delegationService,
  getRandomValidDelegationStatus,
  readLastAgreementEvent,
} from "./utils.js";

/**
 * Validates the creation of a delegation by comparing the actual delegation
 * with the expected delegation. It ensures that the delegation IDs are defined
 * and equal, and verifies that the last delegation event matches the expected
 * delegation data.
 *
 * @param actualDelegation - The actual delegation object to be validated,
 * typically a response from an API.
 * @param expectedDelegation - The expected delegation object to compare against.
 * @returns A promise that resolves to void.
 * @throws Will fail if the delegation is not found in the event store.
 */
const expectedDelegationCreation = async (
  actualDelegation: Delegation,
  expectedDelegation: Delegation
): Promise<void> => {
  expect(actualDelegation.id).toBeDefined();
  expect(expectedDelegation.id).toBeDefined();
  expect(actualDelegation.id).toEqual(expectedDelegation.id);

  const lastDelegationEvent = await readLastAgreementEvent(actualDelegation.id);

  if (!lastDelegationEvent) {
    fail("Creation fails: delegation not found in event-store");
  }

  const actualDelegationData = decodeProtobufPayload({
    messageType: DelegationSubmittedV2,
    payload: lastDelegationEvent.data,
  });

  expect(actualDelegation).toMatchObject(expectedDelegation);
  expect(actualDelegationData.delegation).toEqual(
    toDelegationV2(expectedDelegation)
  );
};

describe("create delegation", () => {
  it("should create a delegation if not exists", async () => {
    const currentExecutionTime = new Date();
    vi.useFakeTimers();
    vi.setSystemTime(currentExecutionTime);

    const delegatorId = generateId<TenantId>();
    const authData = getRandomAuthData(delegatorId);
    const delegator = {
      ...getMockTenant(delegatorId),
      externalId: {
        origin: "IPA",
        value: "anythings",
      },
    };

    const delegate = getMockTenant();
    const eservice = getMockEService();

    await addOneTenant(delegator);
    await addOneTenant(delegate);
    await addOneEservice(eservice);

    const actualDelegation = await delegationService.createProducerDelegation(
      {
        delegateId: delegate.id,
        eserviceId: eservice.id,
      },
      {
        authData,
        logger: genericLogger,
        correlationId: randomUUID(),
        serviceName: "DelegationServiceTest",
      }
    );

    const expectedDelegation: Delegation = {
      id: actualDelegation.id,
      delegatorId,
      delegateId: delegate.id,
      eserviceId: eservice.id,
      kind: delegationKind.delegatedProducer,
      state: delegationState.waitingForApproval,
      createdAt: currentExecutionTime,
      submittedAt: currentExecutionTime,
      stamps: {
        submission: {
          who: delegatorId,
          when: currentExecutionTime,
        },
      },
    };

    await expectedDelegationCreation(actualDelegation, expectedDelegation);
    vi.useRealTimers();
  });

  it("should create a delegation if already exists the same delegation in status Rejected or Revoked", async () => {
    const currentExecutionTime = new Date();
    vi.useFakeTimers();
    vi.setSystemTime(currentExecutionTime);

    const delegatorId = generateId<TenantId>();
    const authData = getRandomAuthData(delegatorId);
    const delegator = {
      ...getMockTenant(delegatorId),
      externalId: {
        origin: "IPA",
        value: "anythings",
      },
    };

    const delegate = getMockTenant();
    const eservice = getMockEService();

    const existentDelegation = {
      ...getMockDelegationProducer(
        generateId<DelegationId>(),
        delegatorId,
        delegate.id,
        eservice.id
      ),
      state: randomArrayItem(delegationNotActivableStates),
    };

    await addOneTenant(delegator);
    await addOneTenant(delegate);
    await addOneEservice(eservice);
    await addOneDelegation(existentDelegation);

    const actualDelegation = await delegationService.createProducerDelegation(
      {
        delegateId: delegate.id,
        eserviceId: eservice.id,
      },
      {
        authData,
        logger: genericLogger,
        correlationId: randomUUID(),
        serviceName: "DelegationServiceTest",
      }
    );

    const expectedDelegation: Delegation = {
      id: actualDelegation.id,
      delegatorId,
      delegateId: delegate.id,
      eserviceId: eservice.id,
      kind: delegationKind.delegatedProducer,
      state: delegationState.waitingForApproval,
      createdAt: currentExecutionTime,
      submittedAt: currentExecutionTime,
      stamps: {
        submission: {
          who: delegatorId,
          when: currentExecutionTime,
        },
      },
    };

    await expectedDelegationCreation(actualDelegation, expectedDelegation);
    vi.useRealTimers();
  });

  it("should throw an delegationAlreadyExists error when Delegation for eservice producer already exists with for same delegator, delegate and eserivce ", async () => {
    const delegatorId = generateId<TenantId>();
    const authData = getRandomAuthData(delegatorId);
    const delegator = {
      ...getMockTenant(delegatorId),
      externalId: {
        origin: "IPA",
        value: "anythings",
      },
    };

    const delegate = getMockTenant();
    const eservice = getMockEService();
    const delegation = {
      ...getMockDelegationProducer(
        generateId<DelegationId>(),
        delegatorId,
        delegate.id,
        eservice.id
      ),
      state: getRandomValidDelegationStatus(),
    };
    // eslint-disable-next-line no-console
    console.log(`Delegation created with state ${delegation.state}`);

    await addOneTenant(delegate);
    await addOneTenant(delegator);
    await addOneEservice(eservice);
    await addOneDelegation(delegation);

    await expect(
      delegationService.createProducerDelegation(
        {
          delegateId: delegate.id,
          eserviceId: eservice.id,
        },
        {
          authData,
          logger: genericLogger,
          correlationId: randomUUID(),
          serviceName: "DelegationServiceTest",
        }
      )
    ).rejects.toThrowError(
      delegationAlreadyExists(
        delegatorId,
        delegate.id,
        delegation.eserviceId,
        delegationKind.delegatedProducer,
        delegation.id
      )
    );
  });

  it("should throw an tenantNotFound error if delegated tenant not exists", async () => {
    const delegatorId = generateId<TenantId>();
    const authData = getRandomAuthData(delegatorId);
    const delegator = getMockTenant(delegatorId);

    const delegateId = generateId<TenantId>();

    await addOneTenant(delegator);

    await expect(
      delegationService.createProducerDelegation(
        {
          delegateId,
          eserviceId: generateId<EServiceId>(),
        },
        {
          authData,
          logger: genericLogger,
          correlationId: randomUUID(),
          serviceName: "DelegationServiceTest",
        }
      )
    ).rejects.toThrowError(tenantNotFound(delegateId));
  });

  it("should throw an tenantNotFound error if delegator tenant not exists", async () => {
    const delegatorId = generateId<TenantId>();
    const authData = getRandomAuthData(delegatorId);

    const delegateId = generateId<TenantId>();
    const delegate = getMockTenant(delegateId);

    await addOneTenant(delegate);

    await expect(
      delegationService.createProducerDelegation(
        {
          delegateId,
          eserviceId: generateId<EServiceId>(),
        },
        {
          authData,
          logger: genericLogger,
          correlationId: randomUUID(),
          serviceName: "DelegationServiceTest",
        }
      )
    ).rejects.toThrowError(tenantNotFound(delegatorId));
  });

  it("should throw an invalidDelegatorAndDelegateAreSame error if delegatorId and delegateId is the same", async () => {
    const sameTenantId = generateId<TenantId>();
    const authData = getRandomAuthData(sameTenantId);

    await expect(
      delegationService.createProducerDelegation(
        {
          delegateId: sameTenantId,
          eserviceId: generateId<EServiceId>(),
        },
        {
          authData,
          logger: genericLogger,
          correlationId: randomUUID(),
          serviceName: "DelegationServiceTest",
        }
      )
    ).rejects.toThrowError(delegatorAndDelegateSameIdError());
  });

  it("should throw an invalidExternalOriginError error if delegator has externalId origin different from IPA", async () => {
    const delegatorId = generateId<TenantId>();
    const authData = getRandomAuthData(delegatorId);
    const delegator = {
      ...getMockTenant(delegatorId),
      externalId: {
        origin: "NOT_IPA",
        value: "anythings",
      },
    };

    const delegate = getMockTenant();

    await addOneTenant(delegate);
    await addOneTenant(delegator);

    await expect(
      delegationService.createProducerDelegation(
        {
          delegateId: delegate.id,
          eserviceId: generateId<EServiceId>(),
        },
        {
          authData,
          logger: genericLogger,
          correlationId: randomUUID(),
          serviceName: "DelegationServiceTest",
        }
      )
    ).rejects.toThrowError(
      invalidExternalOriginError(delegator.externalId.origin)
    );
  });

  it("should throw an eserviceNotFound error if Eservice not exists", async () => {
    const delegatorId = generateId<TenantId>();
    const authData = getRandomAuthData(delegatorId);
    const delegator = {
      ...getMockTenant(delegatorId),
      externalId: {
        origin: "IPA",
        value: "anythings",
      },
    };

    const delegate = getMockTenant();
    const eserviceId = generateId<EServiceId>();
    const delegation = getMockDelegationProducer(
      generateId<DelegationId>(),
      delegatorId,
      delegate.id
    );

    await addOneTenant(delegate);
    await addOneTenant(delegator);
    await addOneDelegation(delegation);

    await expect(
      delegationService.createProducerDelegation(
        {
          delegateId: delegate.id,
          eserviceId,
        },
        {
          authData,
          logger: genericLogger,
          correlationId: randomUUID(),
          serviceName: "DelegationServiceTest",
        }
      )
    ).rejects.toThrowError(eserviceNotFound(eserviceId));
  });
});
