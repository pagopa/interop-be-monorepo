/* eslint-disable @typescript-eslint/no-non-null-assertion */
/* eslint-disable @typescript-eslint/no-floating-promises */
import {
  getMockContext,
  getMockAuthData,
  getMockDelegation,
  getMockEService,
  getMockDescriptor,
  getMockDocument,
  getMockTenant,
  randomArrayItem,
} from "pagopa-interop-commons-test";
import {
  Descriptor,
  descriptorState,
  delegationKind,
  delegationState,
  EService,
  Tenant,
  tenantKind,
  TenantKind,
  DelegatedEServiceArchivingRequest,
  DescriptorState,
} from "pagopa-interop-models";
import { expect, describe, it, vi, beforeEach, afterEach } from "vitest";
import {
  addOneDelegation,
  addOneEService,
  addOneTenant,
  catalogService,
} from "../integrationUtils.js";
import { match } from "ts-pattern";
import {
  delegatedArchivingRequestAlreadyInProgress,
  eserviceWithoutValidDescriptors,
  gracePeriodDaysLowerThanDescriptor,
  gracePeriodDaysNotValid,
  noDelegationForArchivingRequest,
  notValidEServiceState,
} from "../../src/model/domain/errors.js";
import { config } from "../../src/config/config.js";

describe("schedule archiving of an EService with delegation", () => {
  const mockEService = getMockEService();
  const mockDescriptor = getMockDescriptor();
  const mockDocument = getMockDocument();
  const mockArchivingReason = "Test reason";
  const mockGracePeriodDays = 30;
  const producerTenantKind: TenantKind = randomArrayItem(
    Object.values(tenantKind)
  );
  const producer: Tenant = {
    ...getMockTenant(),
    kind: producerTenantKind,
  };
  const mockDelegateTenant = {
    ...getMockTenant(),
    kind: producerTenantKind,
  };

  const fixedDate = new Date("2026-07-08T16:47:59");

  const expectedArchivingRequest: DelegatedEServiceArchivingRequest = {
    gracePeriodDays: mockGracePeriodDays,
    requestedAt: fixedDate,
    requesterId: mockDelegateTenant.id,
    archivingReason: mockArchivingReason,
  };

  const rejectedArchivingRequest: DelegatedEServiceArchivingRequest = {
    gracePeriodDays: mockGracePeriodDays,
    requestedAt: new Date("2026-07-06T16:47:59"),
    rejectedAt: new Date("2026-07-07T16:47:59"),
    requesterId: mockDelegateTenant.id,
    archivingReason: mockArchivingReason,
    rejectionReason: "Mock rejection reason",
  };

  const acceptedArchivingRequest: DelegatedEServiceArchivingRequest = {
    gracePeriodDays: mockGracePeriodDays,
    requestedAt: new Date("2026-07-06T16:47:59"),
    acceptedAt: new Date("2026-07-07T16:47:59"),
    requesterId: mockDelegateTenant.id,
    archivingReason: mockArchivingReason,
  };

  type ArchivingRequestType = "rejected" | "accepted" | "pending";
  const getExistingArchivingRequest = (
    reqType: ArchivingRequestType
  ): DelegatedEServiceArchivingRequest =>
    match(reqType)
      .with("accepted", () => acceptedArchivingRequest)
      .with("rejected", () => rejectedArchivingRequest)
      .with("pending", () => expectedArchivingRequest)
      .exhaustive();

  const allowedStates: DescriptorState[] = [
    descriptorState.published,
    descriptorState.suspended,
  ];

  const disallowedDraftStates: DescriptorState[] = [
    descriptorState.draft,
    descriptorState.waitingForApproval,
  ];

  const disallowedActiveStates = Object.values(descriptorState).filter(
    (s) => !allowedStates.includes(s) && !disallowedDraftStates.includes(s)
  );

  const disallowedDelegationStates = Object.values(delegationState).filter(
    (ds) => ds !== delegationState.active
  );

  beforeEach(() => {
    vi.useRealTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it.each(allowedStates)(
    "Should create a new archiving request for eservice with descriptor in state %s",
    async (state) => {
      const descriptor: Descriptor = {
        ...mockDescriptor,
        state,
        interface: mockDocument,
      };

      const eservice: EService = {
        ...mockEService,
        producerId: producer.id,
        descriptors: [descriptor],
      };

      const mockDelegation = getMockDelegation({
        kind: delegationKind.delegatedProducer,
        eserviceId: eservice.id,
        delegateId: mockDelegateTenant.id,
        state: delegationState.active,
      });

      await addOneTenant(producer);
      await addOneTenant(mockDelegateTenant);
      await addOneEService(eservice);
      await addOneDelegation(mockDelegation);

      vi.useFakeTimers();
      vi.setSystemTime(fixedDate);

      const requestScheduleEServiceArchivingResponse =
        await catalogService.submitDelegatedEServiceArchiving(
          eservice.id,
          {
            archivingReason: mockArchivingReason,
            gracePeriodDays: mockGracePeriodDays,
          },
          getMockContext({ authData: getMockAuthData(mockDelegateTenant.id) })
        );
      const receivedEservice = requestScheduleEServiceArchivingResponse.data;

      expect(receivedEservice.delegatedArchivingRequest).toBeDefined();
      expect(receivedEservice.delegatedArchivingRequest?.length).toBe(1);
      const archivingRequests =
        receivedEservice.delegatedArchivingRequest ?? [];

      expect(archivingRequests.at(-1)).toEqual(expectedArchivingRequest);
    }
  );

  it.each(["accepted", "rejected"])(
    "Should create a new archiving request for eservice and keep the previous %s requests",
    async (archivingRequestType) => {
      const existingArchivingRequest = getExistingArchivingRequest(
        archivingRequestType as ArchivingRequestType
      );

      const descriptor: Descriptor = {
        ...mockDescriptor,
        state: descriptorState.published,
        interface: mockDocument,
      };

      const eservice: EService = {
        ...mockEService,
        producerId: producer.id,
        descriptors: [descriptor],
        delegatedArchivingRequest: [existingArchivingRequest],
      };

      const mockDelegation = getMockDelegation({
        kind: delegationKind.delegatedProducer,
        eserviceId: eservice.id,
        delegateId: mockDelegateTenant.id,
        state: delegationState.active,
      });

      await addOneTenant(producer);
      await addOneTenant(mockDelegateTenant);
      await addOneEService(eservice);
      await addOneDelegation(mockDelegation);

      vi.useFakeTimers();
      vi.setSystemTime(fixedDate);

      const requestScheduleEServiceArchivingResponse =
        await catalogService.submitDelegatedEServiceArchiving(
          eservice.id,
          {
            archivingReason: mockArchivingReason,
            gracePeriodDays: mockGracePeriodDays,
          },
          getMockContext({ authData: getMockAuthData(mockDelegateTenant.id) })
        );
      const receivedEservice = requestScheduleEServiceArchivingResponse.data;

      expect(receivedEservice.delegatedArchivingRequest).toBeDefined();
      expect(receivedEservice.delegatedArchivingRequest?.length).toBe(2);
      const archivingRequests =
        receivedEservice.delegatedArchivingRequest ?? [];

      expect(archivingRequests.at(-1)).toEqual(expectedArchivingRequest);
      expect(archivingRequests.at(0)).toEqual(existingArchivingRequest);
    }
  );

  it("Should throw delegatedArchivingRequestAlreadyInProgress if there is already an active archiving request", async () => {
    const existingArchivingRequest = getExistingArchivingRequest("pending");

    const descriptor: Descriptor = {
      ...mockDescriptor,
      state: descriptorState.published,
      interface: mockDocument,
    };

    const eservice: EService = {
      ...mockEService,
      producerId: producer.id,
      descriptors: [descriptor],
      delegatedArchivingRequest: [existingArchivingRequest],
    };

    const mockDelegation = getMockDelegation({
      kind: delegationKind.delegatedProducer,
      eserviceId: eservice.id,
      delegateId: mockDelegateTenant.id,
      state: delegationState.active,
    });

    await addOneTenant(producer);
    await addOneTenant(mockDelegateTenant);
    await addOneEService(eservice);
    await addOneDelegation(mockDelegation);

    const expectedError = delegatedArchivingRequestAlreadyInProgress(
      eservice.id
    );

    await expect(
      catalogService.submitDelegatedEServiceArchiving(
        eservice.id,
        {
          archivingReason: mockArchivingReason,
          gracePeriodDays: mockGracePeriodDays,
        },
        getMockContext({ authData: getMockAuthData(mockDelegateTenant.id) })
      )
    ).rejects.toThrow(expectedError);
  });

  it.each(disallowedActiveStates)(
    "Should throw notValidEServiceState for eservice with descriptor in state %s",
    async (state) => {
      const descriptor: Descriptor = {
        ...mockDescriptor,
        state,
        interface: mockDocument,
      };

      const eservice: EService = {
        ...mockEService,
        producerId: producer.id,
        descriptors: [descriptor],
      };

      const mockDelegation = getMockDelegation({
        kind: delegationKind.delegatedProducer,
        eserviceId: eservice.id,
        delegateId: mockDelegateTenant.id,
        state: delegationState.active,
      });

      await addOneTenant(producer);
      await addOneTenant(mockDelegateTenant);
      await addOneEService(eservice);
      await addOneDelegation(mockDelegation);

      const expectedError = notValidEServiceState(eservice.id);

      await expect(
        catalogService.submitDelegatedEServiceArchiving(
          eservice.id,
          {
            archivingReason: mockArchivingReason,
            gracePeriodDays: mockGracePeriodDays,
          },
          getMockContext({ authData: getMockAuthData(mockDelegateTenant.id) })
        )
      ).rejects.toThrow(expectedError);
    }
  );

  it.each(disallowedDraftStates)(
    "Should throw eserviceWithoutValidDescriptors for eservice with descriptor in state %s",
    async (state) => {
      const descriptor: Descriptor = {
        ...mockDescriptor,
        state,
        interface: mockDocument,
      };

      const eservice: EService = {
        ...mockEService,
        producerId: producer.id,
        descriptors: [descriptor],
      };

      const mockDelegation = getMockDelegation({
        kind: delegationKind.delegatedProducer,
        eserviceId: eservice.id,
        delegateId: mockDelegateTenant.id,
        state: delegationState.active,
      });

      await addOneTenant(producer);
      await addOneTenant(mockDelegateTenant);
      await addOneEService(eservice);
      await addOneDelegation(mockDelegation);

      const expectedError = eserviceWithoutValidDescriptors(eservice.id);

      await expect(
        catalogService.submitDelegatedEServiceArchiving(
          eservice.id,
          {
            archivingReason: mockArchivingReason,
            gracePeriodDays: mockGracePeriodDays,
          },
          getMockContext({ authData: getMockAuthData(mockDelegateTenant.id) })
        )
      ).rejects.toThrow(expectedError);
    }
  );

  it.each([1066, 1, 0, -1])(
    "Should throw gracePeriodDaysNotValid when gracePeriodDays is %s",
    async (gracePeriodDays) => {
      const descriptor: Descriptor = {
        ...mockDescriptor,
        state: descriptorState.published,
        interface: mockDocument,
      };

      const eservice: EService = {
        ...mockEService,
        producerId: producer.id,
        descriptors: [descriptor],
      };

      const mockDelegation = getMockDelegation({
        kind: delegationKind.delegatedProducer,
        eserviceId: eservice.id,
        delegateId: mockDelegateTenant.id,
        state: delegationState.active,
      });

      await addOneTenant(producer);
      await addOneTenant(mockDelegateTenant);
      await addOneEService(eservice);
      await addOneDelegation(mockDelegation);

      const expectedError = gracePeriodDaysNotValid(
        gracePeriodDays,
        config.gracePeriodArchivingEServiceDays.min,
        config.gracePeriodArchivingEServiceDays.max
      );

      await expect(
        catalogService.submitDelegatedEServiceArchiving(
          eservice.id,
          {
            archivingReason: mockArchivingReason,
            gracePeriodDays,
          },
          getMockContext({ authData: getMockAuthData(mockDelegateTenant.id) })
        )
      ).rejects.toThrow(expectedError);
    }
  );

  it("Should throw noDelegationForArchivingRequest when there is no delegation", async () => {
    const descriptor: Descriptor = {
      ...mockDescriptor,
      state: descriptorState.published,
      interface: mockDocument,
    };

    const eservice: EService = {
      ...mockEService,
      producerId: producer.id,
      descriptors: [descriptor],
    };

    await addOneTenant(producer);
    await addOneTenant(mockDelegateTenant);
    await addOneEService(eservice);

    const expectedError = noDelegationForArchivingRequest(eservice.id);

    await expect(
      catalogService.submitDelegatedEServiceArchiving(
        eservice.id,
        {
          archivingReason: mockArchivingReason,
          gracePeriodDays: mockGracePeriodDays,
        },
        getMockContext({ authData: getMockAuthData(mockDelegateTenant.id) })
      )
    ).rejects.toThrow(expectedError);
  });

  it.each(disallowedDelegationStates)(
    "Should throw noDelegationForArchivingRequest when delegation has state %s",
    async (state) => {
      const descriptor: Descriptor = {
        ...mockDescriptor,
        state: descriptorState.published,
        interface: mockDocument,
      };

      const eservice: EService = {
        ...mockEService,
        producerId: producer.id,
        descriptors: [descriptor],
      };

      const mockDelegation = getMockDelegation({
        kind: delegationKind.delegatedProducer,
        eserviceId: eservice.id,
        delegateId: mockDelegateTenant.id,
        state,
      });

      await addOneTenant(producer);
      await addOneTenant(mockDelegateTenant);
      await addOneEService(eservice);
      await addOneDelegation(mockDelegation);

      const expectedError = noDelegationForArchivingRequest(eservice.id);

      await expect(
        catalogService.submitDelegatedEServiceArchiving(
          eservice.id,
          {
            archivingReason: mockArchivingReason,
            gracePeriodDays: mockGracePeriodDays,
          },
          getMockContext({ authData: getMockAuthData(mockDelegateTenant.id) })
        )
      ).rejects.toThrow(expectedError);
    }
  );

  // new Date("2026-07-08T16:47:59")
  it("Should throw gracePeriodDaysLowerThanDescriptor when there is a descriptor in archiving", async () => {
    const descriptor: Descriptor = {
      ...mockDescriptor,
      version: "2",
      state: descriptorState.published,
      interface: mockDocument,
    };

    const archivingDescriptor: Descriptor = {
      ...getMockDescriptor(),
      interface: getMockDocument(),
      state: descriptorState.archiving,
      archivingSchedule: {
        archivableOn: new Date("2027-07-08T00:00:00"),
        scope: "Descriptor",
        gracePeriodDays: 365,
        startedAt: new Date("2026-07-08T16:47:59"),
      },
    };

    const eservice: EService = {
      ...mockEService,
      producerId: producer.id,
      descriptors: [archivingDescriptor, descriptor],
    };

    const mockDelegation = getMockDelegation({
      kind: delegationKind.delegatedProducer,
      eserviceId: eservice.id,
      delegateId: mockDelegateTenant.id,
      state: delegationState.active,
    });

    await addOneTenant(producer);
    await addOneTenant(mockDelegateTenant);
    await addOneEService(eservice);
    await addOneDelegation(mockDelegation);

    const expectedError = gracePeriodDaysLowerThanDescriptor(
      eservice.id,
      archivingDescriptor.id,
      mockGracePeriodDays,
      365
    );

    await expect(
      catalogService.submitDelegatedEServiceArchiving(
        eservice.id,
        {
          archivingReason: mockArchivingReason,
          gracePeriodDays: mockGracePeriodDays,
        },
        getMockContext({ authData: getMockAuthData(mockDelegateTenant.id) })
      )
    ).rejects.toThrow(expectedError);
  });

  it("Should throw gracePeriodDaysLowerThanDescriptor when there is a descriptor in projected archiving", async () => {
    const descriptor: Descriptor = {
      ...mockDescriptor,
      version: "2",
      state: descriptorState.published,
      interface: mockDocument,
    };

    const archivingDescriptor: Descriptor = {
      ...getMockDescriptor(),
      interface: getMockDocument(),
      state: descriptorState.deprecated,
      delegatedArchivingRequest: [
        {
          requestedAt: new Date("2026-07-08T16:47:59"),
          requesterId: mockDelegateTenant.id,
          gracePeriodDays: 365,
        },
      ],
    };

    const eservice: EService = {
      ...mockEService,
      producerId: producer.id,
      descriptors: [archivingDescriptor, descriptor],
    };

    const mockDelegation = getMockDelegation({
      kind: delegationKind.delegatedProducer,
      eserviceId: eservice.id,
      delegateId: mockDelegateTenant.id,
      state: delegationState.active,
    });

    await addOneTenant(producer);
    await addOneTenant(mockDelegateTenant);
    await addOneEService(eservice);
    await addOneDelegation(mockDelegation);

    const expectedError = gracePeriodDaysLowerThanDescriptor(
      eservice.id,
      archivingDescriptor.id,
      mockGracePeriodDays,
      365
    );

    await expect(
      catalogService.submitDelegatedEServiceArchiving(
        eservice.id,
        {
          archivingReason: mockArchivingReason,
          gracePeriodDays: mockGracePeriodDays,
        },
        getMockContext({ authData: getMockAuthData(mockDelegateTenant.id) })
      )
    ).rejects.toThrow(expectedError);
  });
});
