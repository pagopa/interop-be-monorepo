import { genericLogger } from "pagopa-interop-commons";
import {
  getMockAgreement,
  getMockEService,
  getMockTenant,
  getRandomAuthData,
} from "pagopa-interop-commons-test";
import {
  delegationState,
  EServiceId,
  generateId,
  TenantId,
} from "pagopa-interop-models";
import { describe, expect, it } from "vitest";
import {
  delegationRelatedAgreementExists,
  eserviceNotDelegable,
} from "../src/model/domain/errors.js";
import { config } from "../src/config/config.js";
import {
  addOneAgreement,
  addOneEservice,
  addOneTenant,
  delegationService,
} from "./utils.js";

describe("create consumer delegation", () => {
  config.delegationsAllowedOrigins = ["IPA", "TEST"];

  it.each(config.delegationsAllowedOrigins)(
    "should create a delegation if it does not exist (origin: %s)",
    async (origin) => {
      const currentExecutionTime = new Date();
      vi.useFakeTimers();
      vi.setSystemTime(currentExecutionTime);

      const delegatorId = generateId<TenantId>();
      const authData = getRandomAuthData(delegatorId);
      const delegator = {
        ...getMockTenant(delegatorId),
        externalId: {
          origin,
          value: "test",
        },
      };

      const delegate = {
        ...getMockTenant(),
        features: [
          {
            type: "DelegatedConsumer" as const,
            availabilityTimestamp: currentExecutionTime,
          },
        ],
      };
      const eservice = getMockEService({
        eserviceId: generateId<EServiceId>(),
        producerId: delegatorId,
        isDelegable: true,
      });

      await addOneTenant(delegator);
      await addOneTenant(delegate);
      await addOneEservice(eservice);

      const actualDelegation = await delegationService.createConsumerDelegation(
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
        kind: delegationKind.delegatedConsumer,
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

  it.each(inactiveDelegationStates)(
    "should create a new delegation if the same delegation exists and is in state %s",
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
            type: "DelegatedConsumer" as const,
            availabilityTimestamp: currentExecutionTime,
          },
        ],
      };
      const eservice = getMockEService({
        eserviceId: generateId<EServiceId>(),
        producerId: delegatorId,
        isDelegable: true,
      });

      const existentDelegation = {
        ...getMockDelegation({
          kind: delegationKind.delegatedConsumer,
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

      const actualDelegation = await delegationService.createConsumerDelegation(
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
        kind: delegationKind.delegatedConsumer,
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
      expect(actualDelegation.id).not.toEqual(existentDelegation.id);

      vi.useRealTimers();
    }
  );

  it.each(activeDelegationStates)(
    "should throw a delegationAlreadyExists error when a consumer Delegation in state %s already exists with same delegator, delegate and eservice",
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
            type: "DelegatedConsumer" as const,
            availabilityTimestamp: new Date(),
          },
        ],
      };
      const eservice = getMockEService({
        eserviceId: generateId<EServiceId>(),
        producerId: delegatorId,
        isDelegable: true,
      });
      const existientActiveDelegation = {
        ...getMockDelegation({
          kind: delegationKind.delegatedConsumer,
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
      await addOneDelegation(existientActiveDelegation);
      // Add existent inactive delegation for the same delegator, delegate and eservice
      await addOneDelegation({
        ...existientActiveDelegation,
        id: generateId<DelegationId>(),
        state: randomArrayItem(inactiveDelegationStates),
      });

      // Add another generic delegation
      await addOneDelegation(
        getMockDelegation({
          kind: delegationKind.delegatedConsumer,
        })
      );

      // Add another delegation with same delegator
      await addOneDelegation(
        getMockDelegation({
          kind: delegationKind.delegatedConsumer,
          delegatorId,
        })
      );

      // Add another delegation with same delegate
      await addOneDelegation(
        getMockDelegation({
          kind: delegationKind.delegatedConsumer,
          delegateId: delegate.id,
        })
      );

      // Add another delegation for the same eservice
      await addOneDelegation(
        getMockDelegation({
          kind: delegationKind.delegatedConsumer,
          eserviceId: eservice.id,
        })
      );

      await expect(
        delegationService.createConsumerDelegation(
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
          existientActiveDelegation.eserviceId,
          delegationKind.delegatedConsumer
        )
      );
    }
  );

  it("should throw a tenantNotFound error if delegated tenant does not exist", async () => {
    const delegatorId = generateId<TenantId>();
    const authData = getRandomAuthData(delegatorId);
    const delegator = {
      ...getMockTenant(delegatorId),
      externalId: {
        origin: "IPA",
        value: "test",
      },
    };
    const delegateId = generateId<TenantId>();
    const eservice = getMockEService();

    await addOneTenant(delegator);
    await addOneEservice(eservice);

    await expect(
      delegationService.createConsumerDelegation(
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
          type: "DelegatedConsumer" as const,
          availabilityTimestamp: new Date(),
        },
      ],
    };
    const eservice = getMockEService();

    await addOneTenant(delegate);
    await addOneEservice(eservice);

    await expect(
      delegationService.createConsumerDelegation(
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
      delegationService.createConsumerDelegation(
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
          type: "DelegatedConsumer" as const,
          availabilityTimestamp: new Date(),
        },
      ],
    };

    const eservice = getMockEService({
      producerId: delegatorId,
      isDelegable: true,
    });

    await addOneTenant(delegator);
    await addOneTenant(delegate);
    await addOneEservice(eservice);

    await expect(
      delegationService.createConsumerDelegation(
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
          type: "DelegatedConsumer" as const,
          availabilityTimestamp: new Date(),
        },
      ],
    };
    const eservice = getMockEService({
      producerId: delegatorId,
      isDelegable: true,
    });

    await addOneTenant(delegator);
    await addOneTenant(delegate);
    await addOneEservice(eservice);

    await expect(
      delegationService.createConsumerDelegation(
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
          type: "DelegatedConsumer" as const,
          availabilityTimestamp: new Date(),
        },
      ],
    };
    const eserviceId = generateId<EServiceId>();

    await addOneTenant(delegator);
    await addOneTenant(delegate);

    await expect(
      delegationService.createConsumerDelegation(
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

  it("should throw a tenantNotAllowedToDelegation error if delegate tenant has no DelegatedConsumer feature", async () => {
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
      delegationService.createConsumerDelegation(
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
        delegationKind.delegatedConsumer
      )
    );
  });

  it("should throw an eserviceNotDelegable error if Eservice is not delegable", async () => {
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
          type: "DelegatedConsumer" as const,
          availabilityTimestamp: new Date(),
        },
      ],
    };

    const eservice = getMockEService({
      producerId: delegatorId,
      isDelegable: false,
    });

    await addOneTenant(delegator);
    await addOneTenant(delegate);
    await addOneEservice(eservice);

    await expect(
      delegationService.createConsumerDelegation(
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
    ).rejects.toThrowError(eserviceNotDelegable(eservice.id));
  });

  it("should throw a delegationRelatedAgreementExists error if an agreement exists", async () => {
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
          type: "DelegatedConsumer" as const,
          availabilityTimestamp: new Date(),
        },
      ],
    };

    const eservice = getMockEService({
      producerId: delegatorId,
      isDelegable: true,
    });

    const activeAgreement = getMockAgreement(
      eservice.id,
      delegator.id,
      delegationState.active
    );

    await addOneTenant(delegator);
    await addOneTenant(delegate);
    await addOneEservice(eservice);
    await addOneAgreement(activeAgreement);

    await expect(
      delegationService.createConsumerDelegation(
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
      delegationRelatedAgreementExists(
        activeAgreement.id,
        eservice.id,
        delegator.id
      )
    );
  });
});
