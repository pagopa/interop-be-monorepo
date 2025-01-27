import { genericLogger } from "pagopa-interop-commons";
import {
  getMockEService,
  getMockTenant,
  getRandomAuthData,
} from "pagopa-interop-commons-test";
import { generateId, TenantId } from "pagopa-interop-models";
import { describe, expect, it, vi } from "vitest";
import { differentEServiceProducer } from "../src/model/domain/errors.js";
import { addOneEservice, addOneTenant, delegationService } from "./utils.js";

describe("create producer delegation", () => {
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
      delegationService.createProducerDelegation(
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
      const eservice = getMockEService({
        eserviceId: generateId<EServiceId>(),
        producerId: delegatorId,
        isDelegable: true,
      });
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
        delegationService.createProducerDelegation(
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
    const eservice = getMockEService({
      producerId: delegatorId,
      isDelegable: true,
    });

    await addOneTenant(delegator);
    await addOneEservice(eservice);

    await expect(
      delegationService.createProducerDelegation(
        {
          delegateId,
          eserviceId: eservice.id,
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

    const delegate = {
      ...getMockTenant(),
      features: [
        {
          type: "DelegatedProducer" as const,
          availabilityTimestamp: new Date(),
        },
      ],
    };
    const eservice = getMockEService({
      producerId: delegatorId,
      isDelegable: true,
    });
    await addOneTenant(delegate);
    await addOneEservice(eservice);

    await expect(
      delegationService.createProducerDelegation(
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
          correlationId: generateId(),
          serviceName: "DelegationServiceTest",
        }
      )
    ).rejects.toThrowError(delegatorAndDelegateSameIdError());
  });

  it("should throw a originNotCompliant error if delegator has externalId origin not compliant", async () => {
    const delegatorId = generateId<TenantId>();
    const authData = getRandomAuthData(delegatorId);
    const delegator = {
      ...getMockTenant(delegatorId),
      externalId: {
        origin: "UNKNOWN_ORIGIN",
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
    const eservice = getMockEService({
      producerId: delegatorId,
      isDelegable: true,
    });

    await addOneTenant(delegate);
    await addOneTenant(delegator);
    await addOneEservice(eservice);

    await expect(
      delegationService.createProducerDelegation(
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
    ).rejects.toThrowError(originNotCompliant(delegator, "Delegator"));
  });

  it("should throw a originNotCompliant error if delegate has externalId origin not compliant", async () => {
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
        origin: "UNKNOWN_ORIGIN",
        value: "test",
      },
      features: [
        {
          type: "DelegatedProducer" as const,
          availabilityTimestamp: new Date(),
        },
      ],
    };
    const eservice = getMockEService({
      producerId: delegatorId,
      isDelegable: true,
    });

    await addOneTenant(delegate);
    await addOneTenant(delegator);
    await addOneEservice(eservice);

    await expect(
      delegationService.createProducerDelegation(
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

    await addOneTenant(delegate);
    await addOneTenant(delegator);

    await expect(
      delegationService.createProducerDelegation(
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
    const eservice = getMockEService({
      producerId: delegatorId,
      isDelegable: true,
    });

    await addOneTenant(delegate);
    await addOneTenant(delegator);
    await addOneEservice(eservice);

    await expect(
      delegationService.createProducerDelegation(
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
      tenantNotAllowedToDelegation(
        delegate.id,
        delegationKind.delegatedProducer
      )
    );
  });
});
