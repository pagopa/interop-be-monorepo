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
  decodeProtobufPayload,
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
  GracePeriodDays,
  toEServiceV2,
  EServiceArchivingRequestedByDelegateV2,
  operationForbidden,
} from "pagopa-interop-models";
import { match } from "ts-pattern";
import { expect, describe, it, vi, beforeEach, afterEach } from "vitest";

import {
  delegatedArchivingRequestAlreadyInProgress,
  eserviceWithoutValidDescriptors,
  gracePeriodDaysLowerThanDescriptor,
  noDelegationForArchivingRequest,
  notValidEServiceState,
} from "../../src/model/domain/errors.js";
import {
  addOneDelegation,
  addOneEService,
  addOneTenant,
  catalogService,
  readLastEserviceEvent,
} from "../integrationUtils.js";

describe("schedule archiving of an EService with delegation", () => {
  const mockEService = getMockEService();
  const mockDescriptor = getMockDescriptor();
  const mockDocument = getMockDocument();
  const mockArchivingReason = "Test reason";
  const mockGracePeriodDays: GracePeriodDays = 30;
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

  const addDaysToFixedDate = (days: GracePeriodDays): Date => {
    const newDate = new Date(fixedDate);
    newDate.setDate(newDate.getDate() + days + 1);
    return newDate;
  };

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

  it("should write on event-store for the request of an archival process for an EService", async () => {
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

    vi.useFakeTimers();
    vi.setSystemTime(fixedDate);

    const scheduleEServiceArchivingResponse =
      await catalogService.submitDelegatedEServiceArchiving(
        eservice.id,
        {
          archivingReason: mockArchivingReason,
          gracePeriodDays: mockGracePeriodDays,
        },
        getMockContext({ authData: getMockAuthData(mockDelegateTenant.id) })
      );

    const writtenEvent = await readLastEserviceEvent(eservice.id);
    expect(writtenEvent.stream_id).toBe(eservice.id);
    expect(writtenEvent.version).toBe("1");
    expect(writtenEvent.type).toBe("EServiceArchivingRequestedByDelegate");
    expect(writtenEvent.event_version).toBe(2);
    const writtenPayload = decodeProtobufPayload({
      messageType: EServiceArchivingRequestedByDelegateV2,
      payload: writtenEvent.data,
    });

    const expectedEService: EService = {
      ...eservice,
      delegatedArchivingRequest: [expectedArchivingRequest],
    };

    expect(writtenPayload.eservice).toEqual(toEServiceV2(expectedEService));
    expect(scheduleEServiceArchivingResponse).toEqual({
      data: expectedEService,
      metadata: { version: parseInt(writtenEvent.version, 10) },
    });
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

  it("Should throw operationForbidden when the producer requests the archiving", async () => {
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

    const expectedError = operationForbidden;

    await expect(
      catalogService.submitDelegatedEServiceArchiving(
        eservice.id,
        {
          archivingReason: mockArchivingReason,
          gracePeriodDays: mockGracePeriodDays,
        },
        getMockContext({ authData: getMockAuthData(producer.id) })
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
    vi.useFakeTimers();
    vi.setSystemTime(fixedDate);

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
        archivableOn: addDaysToFixedDate(120),
        scope: "Descriptor",
        gracePeriodDays: 120,
        startedAt: fixedDate,
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
      addDaysToFixedDate(mockGracePeriodDays),
      archivingDescriptor.archivingSchedule!.archivableOn
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
    vi.useFakeTimers();
    vi.setSystemTime(fixedDate);

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
          requestedAt: fixedDate,
          requesterId: mockDelegateTenant.id,
          gracePeriodDays: 120,
        },
      ],
    };
    const expectedArchivingDate = addDaysToFixedDate(120);

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
      addDaysToFixedDate(mockGracePeriodDays),
      expectedArchivingDate
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
