import { fail } from "assert";
import { genericLogger } from "pagopa-interop-commons";
import {
  decodeProtobufPayload,
  getMockDelegation,
  getMockEService,
  getMockTenant,
  getRandomAuthData,
  randomArrayItem,
} from "pagopa-interop-commons-test";
import {
  Delegation,
  DelegationId,
  delegationKind,
  delegationState,
  ProducerDelegationSubmittedV2,
  EServiceId,
  generateId,
  TenantId,
  toDelegationV2,
} from "pagopa-interop-models";
import { describe, expect, it, vi } from "vitest";
import {
  delegationAlreadyExists,
  delegatorAndDelegateSameIdError,
  differentEServiceProducer,
  eserviceNotFound,
  originNotCompliant,
  tenantNotAllowedToDelegation,
  tenantNotFound,
} from "../src/model/domain/errors.js";

import {
  activeDelegationStates,
  inactiveDelegationStates,
} from "../src/services/validators.js";
import {
  addOneDelegation,
  addOneEservice,
  addOneTenant,
  delegationProducerService,
  readLastDelegationEvent,
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

  const lastDelegationEvent = await readLastDelegationEvent(
    actualDelegation.id
  );

  if (!lastDelegationEvent) {
    fail("Creation fails: delegation not found in event-store");
  }

  const actualDelegationData = decodeProtobufPayload({
    messageType: ProducerDelegationSubmittedV2,
    payload: lastDelegationEvent.data,
  });

  expect(actualDelegation).toMatchObject(expectedDelegation);
  expect(actualDelegationData.delegation).toEqual(
    toDelegationV2(expectedDelegation)
  );
};

describe("create producer delegation", () => {
  it("should create a delegation if it does not exist", async () => {
    const currentExecutionTime = new Date();
    vi.useFakeTimers();
    vi.setSystemTime(currentExecutionTime);

    const delegatorId = generateId<TenantId>();
    const authData = getRandomAuthData(delegatorId);
    const delegator = {
      ...getMockTenant(delegatorId),
      externalId: {
        origin: "IPA",
        value: "test",
      },
    };

    const delegate = {
      ...getMockTenant(),
      features: [
        {
          type: "DelegatedProducer" as const,
          availabilityTimestamp: currentExecutionTime,
        },
      ],
    };
    const eservice = getMockEService(generateId<EServiceId>(), delegatorId);

    await addOneTenant(delegator);
    await addOneTenant(delegate);
    await addOneEservice(eservice);

    const actualDelegation =
      await delegationProducerService.createProducerDelegation(
        {
          delegateId: delegate.id,
          eserviceId: eservice.id,
        },
        {
          authData,
          logger: genericLogger,
          correlationId: generateId(),
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
          who: authData.userId,
          when: currentExecutionTime,
        },
      },
    };

    await expectedDelegationCreation(actualDelegation, expectedDelegation);
    vi.useRealTimers();
  });

  it.each(inactiveDelegationStates)(
    "should create a delegation the same delegation exists and is in state %s",
    async (inactiveDelegationState) => {
      const currentExecutionTime = new Date();
      vi.useFakeTimers();
      vi.setSystemTime(currentExecutionTime);

      const delegatorId = generateId<TenantId>();
      const authData = getRandomAuthData(delegatorId);
      const delegator = {
        ...getMockTenant(delegatorId),
        externalId: {
          origin: "IPA",
          value: "test",
        },
      };

      const delegate = {
        ...getMockTenant(),
        features: [
          {
            type: "DelegatedProducer" as const,
            availabilityTimestamp: currentExecutionTime,
          },
        ],
      };
      const eservice = getMockEService(generateId<EServiceId>(), delegatorId);

      const existentDelegation = {
        ...getMockDelegation({
          kind: delegationKind.delegatedProducer,
          id: generateId<DelegationId>(),
          delegatorId,
          delegateId: delegate.id,
          eserviceId: eservice.id,
        }),
        state: inactiveDelegationState,
      };

      await addOneTenant(delegator);
      await addOneTenant(delegate);
      await addOneEservice(eservice);
      await addOneDelegation(existentDelegation);

      const actualDelegation =
        await delegationProducerService.createProducerDelegation(
          {
            delegateId: delegate.id,
            eserviceId: eservice.id,
          },
          {
            authData,
            logger: genericLogger,
            correlationId: generateId(),
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
            who: authData.userId,
            when: currentExecutionTime,
          },
        },
      };

      await expectedDelegationCreation(actualDelegation, expectedDelegation);
      vi.useRealTimers();
    }
  );

  it("should throw a differentEServiceProducer error if requester is not Eservice producer", async () => {
    const currentExecutionTime = new Date();
    vi.useFakeTimers();
    vi.setSystemTime(currentExecutionTime);

    const delegatorId = generateId<TenantId>();
    const authData = getRandomAuthData(delegatorId);
    const delegator = {
      ...getMockTenant(delegatorId),
      externalId: {
        origin: "IPA",
        value: "test",
      },
    };

    const delegate = {
      ...getMockTenant(),
      features: [
        {
          type: "DelegatedProducer" as const,
          availabilityTimestamp: currentExecutionTime,
        },
      ],
    };
    const eservice = getMockEService();

    await addOneTenant(delegator);
    await addOneTenant(delegate);
    await addOneEservice(eservice);

    await expect(
      delegationProducerService.createProducerDelegation(
        {
          delegateId: delegate.id,
          eserviceId: eservice.id,
        },
        {
          authData,
          logger: genericLogger,
          correlationId: generateId(),
          serviceName: "DelegationServiceTest",
        }
      )
    ).rejects.toThrowError(differentEServiceProducer(delegatorId));

    vi.useRealTimers();
  });

  it.each(activeDelegationStates)(
    "should throw a delegationAlreadyExists error when a producer Delegation in state %s already exists with same delegator, delegate and eservice",
    async (activeDelegationState) => {
      const delegatorId = generateId<TenantId>();
      const authData = getRandomAuthData(delegatorId);
      const delegator = {
        ...getMockTenant(delegatorId),
        externalId: {
          origin: "IPA",
          value: "test",
        },
      };

      const delegate = {
        ...getMockTenant(),
        features: [
          {
            type: "DelegatedProducer" as const,
            availabilityTimestamp: new Date(),
          },
        ],
      };
      const eservice = getMockEService(generateId<EServiceId>(), delegatorId);
      const existentActiveDelegation = {
        ...getMockDelegation({
          kind: delegationKind.delegatedProducer,
          id: generateId<DelegationId>(),
          delegatorId,
          delegateId: delegate.id,
          eserviceId: eservice.id,
        }),
        state: activeDelegationState,
      };

      await addOneTenant(delegate);
      await addOneTenant(delegator);
      await addOneEservice(eservice);
      // Add existent active delegation for the same delegator, delegate and eservice
      await addOneDelegation(existentActiveDelegation);
      // Add existent inactive delegation for the same delegator, delegate and eservice
      await addOneDelegation({
        ...existentActiveDelegation,
        id: generateId<DelegationId>(),
        state: randomArrayItem(inactiveDelegationStates),
      });

      // Add another generic delegation
      await addOneDelegation(
        getMockDelegation({ kind: delegationKind.delegatedProducer })
      );

      // Add another delegation with same delegator
      await addOneDelegation(
        getMockDelegation({
          kind: delegationKind.delegatedProducer,
          delegatorId,
        })
      );

      // Add another delegation with same delegate
      await addOneDelegation(
        getMockDelegation({
          kind: delegationKind.delegatedProducer,
          delegateId: delegate.id,
        })
      );

      // Add another delegation for the same eservice
      await addOneDelegation(
        getMockDelegation({
          kind: delegationKind.delegatedProducer,
          eserviceId: eservice.id,
        })
      );

      await expect(
        delegationProducerService.createProducerDelegation(
          {
            delegateId: delegate.id,
            eserviceId: eservice.id,
          },
          {
            authData,
            logger: genericLogger,
            correlationId: generateId(),
            serviceName: "DelegationServiceTest",
          }
        )
      ).rejects.toThrowError(
        delegationAlreadyExists(
          delegatorId,
          existentActiveDelegation.eserviceId,
          delegationKind.delegatedProducer
        )
      );
    }
  );

  it("should throw a tenantNotFound error if delegated tenant does not exist", async () => {
    const delegatorId = generateId<TenantId>();
    const authData = getRandomAuthData(delegatorId);
    const delegator = getMockTenant(delegatorId);

    const delegateId = generateId<TenantId>();

    await addOneTenant(delegator);

    await expect(
      delegationProducerService.createProducerDelegation(
        {
          delegateId,
          eserviceId: generateId<EServiceId>(),
        },
        {
          authData,
          logger: genericLogger,
          correlationId: generateId(),
          serviceName: "DelegationServiceTest",
        }
      )
    ).rejects.toThrowError(tenantNotFound(delegateId));
  });

  it("should throw a tenantNotFound error if delegator tenant does not exist", async () => {
    const delegatorId = generateId<TenantId>();
    const authData = getRandomAuthData(delegatorId);

    const delegateId = generateId<TenantId>();
    const delegate = {
      ...getMockTenant(),
      features: [
        {
          type: "DelegatedProducer" as const,
          availabilityTimestamp: new Date(),
        },
      ],
    };

    await addOneTenant(delegate);

    await expect(
      delegationProducerService.createProducerDelegation(
        {
          delegateId,
          eserviceId: generateId<EServiceId>(),
        },
        {
          authData,
          logger: genericLogger,
          correlationId: generateId(),
          serviceName: "DelegationServiceTest",
        }
      )
    ).rejects.toThrowError(tenantNotFound(delegatorId));
  });

  it("should throw an invalidDelegatorAndDelegateAreSame error if delegatorId and delegateId is the same", async () => {
    const sameTenantId = generateId<TenantId>();
    const authData = getRandomAuthData(sameTenantId);

    await expect(
      delegationProducerService.createProducerDelegation(
        {
          delegateId: sameTenantId,
          eserviceId: generateId<EServiceId>(),
        },
        {
          authData,
          logger: genericLogger,
          correlationId: generateId(),
          serviceName: "DelegationServiceTest",
        }
      )
    ).rejects.toThrowError(delegatorAndDelegateSameIdError());
  });

  it("should throw a originNotCompliant error if delegator has externalId origin different from IPA", async () => {
    const delegatorId = generateId<TenantId>();
    const authData = getRandomAuthData(delegatorId);
    const delegator = {
      ...getMockTenant(delegatorId),
      externalId: {
        origin: "NOT_IPA",
        value: "test",
      },
    };

    const delegate = {
      ...getMockTenant(),
      features: [
        {
          type: "DelegatedProducer" as const,
          availabilityTimestamp: new Date(),
        },
      ],
    };

    await addOneTenant(delegate);
    await addOneTenant(delegator);

    await expect(
      delegationProducerService.createProducerDelegation(
        {
          delegateId: delegate.id,
          eserviceId: generateId<EServiceId>(),
        },
        {
          authData,
          logger: genericLogger,
          correlationId: generateId(),
          serviceName: "DelegationServiceTest",
        }
      )
    ).rejects.toThrowError(originNotCompliant(delegator, "Delegator"));
  });

  it("should throw a originNotCompliant error if delegate has externalId origin different from IPA", async () => {
    const delegatorId = generateId<TenantId>();
    const authData = getRandomAuthData(delegatorId);
    const delegator = {
      ...getMockTenant(delegatorId),
      externalId: {
        origin: "IPA",
        value: "test",
      },
    };

    const delegate = {
      ...getMockTenant(),
      externalId: {
        origin: "NOT_IPA",
        value: "test",
      },
      features: [
        {
          type: "DelegatedProducer" as const,
          availabilityTimestamp: new Date(),
        },
      ],
    };

    await addOneTenant(delegate);
    await addOneTenant(delegator);

    await expect(
      delegationProducerService.createProducerDelegation(
        {
          delegateId: delegate.id,
          eserviceId: generateId<EServiceId>(),
        },
        {
          authData,
          logger: genericLogger,
          correlationId: generateId(),
          serviceName: "DelegationServiceTest",
        }
      )
    ).rejects.toThrowError(originNotCompliant(delegate, "Delegate"));
  });

  it("should throw an eserviceNotFound error if Eservice does not exist", async () => {
    const delegatorId = generateId<TenantId>();
    const authData = getRandomAuthData(delegatorId);
    const delegator = {
      ...getMockTenant(delegatorId),
      externalId: {
        origin: "IPA",
        value: "test",
      },
    };

    const delegate = {
      ...getMockTenant(),
      features: [
        {
          type: "DelegatedProducer" as const,
          availabilityTimestamp: new Date(),
        },
      ],
    };
    const eserviceId = generateId<EServiceId>();
    const delegation = getMockDelegation({
      kind: delegationKind.delegatedProducer,
      id: generateId<DelegationId>(),
      delegatorId,
      delegateId: delegate.id,
    });

    await addOneTenant(delegate);
    await addOneTenant(delegator);
    await addOneDelegation(delegation);

    await expect(
      delegationProducerService.createProducerDelegation(
        {
          delegateId: delegate.id,
          eserviceId,
        },
        {
          authData,
          logger: genericLogger,
          correlationId: generateId(),
          serviceName: "DelegationServiceTest",
        }
      )
    ).rejects.toThrowError(eserviceNotFound(eserviceId));
  });

  it("should throw a tenantNotAllowedToDelegation error if delegate tenant has no DelegatedProducer feature", async () => {
    const delegatorId = generateId<TenantId>();
    const authData = getRandomAuthData(delegatorId);
    const delegator = {
      ...getMockTenant(delegatorId),
      externalId: {
        origin: "IPA",
        value: "test",
      },
    };

    const delegate = getMockTenant();

    await addOneTenant(delegate);
    await addOneTenant(delegator);

    await expect(
      delegationProducerService.createProducerDelegation(
        {
          delegateId: delegate.id,
          eserviceId: generateId<EServiceId>(),
        },
        {
          authData,
          logger: genericLogger,
          correlationId: generateId(),
          serviceName: "DelegationServiceTest",
        }
      )
    ).rejects.toThrowError(
      tenantNotAllowedToDelegation(
        delegate.id,
        delegationKind.delegatedProducer
      )
    );
  });
});
