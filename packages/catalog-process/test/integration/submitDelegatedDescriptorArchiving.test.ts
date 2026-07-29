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
  DescriptorState,
  GracePeriodDays,
  DelegatedDescriptorArchivingRequest,
  toEServiceV2,
  EServiceDescriptorArchivingRequestedByDelegateV2,
  operationForbidden,
} from "pagopa-interop-models";
import { match } from "ts-pattern";
import { expect, describe, it, vi, beforeEach, afterEach } from "vitest";

import {
  delegatedArchivingRequestAlreadyInProgress,
  noDelegationForArchivingRequest,
  notValidDescriptorState,
} from "../../src/model/domain/errors.js";
import {
  addOneDelegation,
  addOneEService,
  addOneTenant,
  catalogService,
  readLastEserviceEvent,
} from "../integrationUtils.js";

describe("schedule archiving of an Descriptor with delegation", () => {
  const mockEService = getMockEService();
  const mockDescriptor = {
    ...getMockDescriptor(),
    state: descriptorState.deprecated,
    version: "1",
    interface: getMockDocument(),
  };
  const mockLatestDescriptor = {
    ...getMockDescriptor(),
    state: descriptorState.published,
    version: "2",
    interface: getMockDocument(),
  };
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

  const expectedArchivingRequest: DelegatedDescriptorArchivingRequest = {
    gracePeriodDays: mockGracePeriodDays,
    requestedAt: fixedDate,
    requesterId: mockDelegateTenant.id,
  };

  const rejectedArchivingRequest: DelegatedDescriptorArchivingRequest = {
    gracePeriodDays: mockGracePeriodDays,
    requestedAt: new Date("2026-07-06T16:47:59"),
    rejectedAt: new Date("2026-07-07T16:47:59"),
    requesterId: mockDelegateTenant.id,
    rejectionReason: "Mock rejection reason",
  };

  const acceptedArchivingRequest: DelegatedDescriptorArchivingRequest = {
    gracePeriodDays: mockGracePeriodDays,
    requestedAt: new Date("2026-07-06T16:47:59"),
    acceptedAt: new Date("2026-07-07T16:47:59"),
    requesterId: mockDelegateTenant.id,
  };

  type ArchivingRequestType = "rejected" | "accepted" | "pending";
  const getExistingArchivingRequest = (
    reqType: ArchivingRequestType
  ): DelegatedDescriptorArchivingRequest =>
    match(reqType)
      .with("accepted", () => acceptedArchivingRequest)
      .with("rejected", () => rejectedArchivingRequest)
      .with("pending", () => expectedArchivingRequest)
      .exhaustive();

  const allowedStates: DescriptorState[] = [
    descriptorState.deprecated,
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

  it("should write on event-store for the request of an archival process for a Descriptor", async () => {
    const descriptor: Descriptor = {
      ...mockDescriptor,
      state: descriptorState.deprecated,
    };

    const eservice: EService = {
      ...mockEService,
      producerId: producer.id,
      descriptors: [descriptor, mockLatestDescriptor],
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
      await catalogService.submitDelegatedDescriptorArchiving(
        eservice.id,
        descriptor.id,
        {
          gracePeriodDays: mockGracePeriodDays,
        },
        getMockContext({ authData: getMockAuthData(mockDelegateTenant.id) })
      );

    const writtenEvent = await readLastEserviceEvent(eservice.id);
    expect(writtenEvent.stream_id).toBe(eservice.id);
    expect(writtenEvent.version).toBe("1");
    expect(writtenEvent.type).toBe(
      "EServiceDescriptorArchivingRequestedByDelegate"
    );
    expect(writtenEvent.event_version).toBe(2);
    const writtenPayload = decodeProtobufPayload({
      messageType: EServiceDescriptorArchivingRequestedByDelegateV2,
      payload: writtenEvent.data,
    });

    const expectedDescriptor: Descriptor = {
      ...descriptor,
      delegatedArchivingRequest: [expectedArchivingRequest],
    };

    const expectedEService: EService = {
      ...eservice,
      descriptors: [expectedDescriptor, mockLatestDescriptor],
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
      };

      const eservice: EService = {
        ...mockEService,
        producerId: producer.id,
        descriptors: [descriptor, mockLatestDescriptor],
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
        await catalogService.submitDelegatedDescriptorArchiving(
          eservice.id,
          descriptor.id,
          {
            gracePeriodDays: mockGracePeriodDays,
          },
          getMockContext({ authData: getMockAuthData(mockDelegateTenant.id) })
        );
      const receivedEservice = requestScheduleEServiceArchivingResponse.data;
      const receivedDescriptor = receivedEservice.descriptors.find(
        (d) => d.id === descriptor.id
      );
      expect(receivedDescriptor?.delegatedArchivingRequest).toBeDefined();
      expect(receivedDescriptor?.delegatedArchivingRequest?.length).toBe(1);
      const archivingRequests =
        receivedDescriptor?.delegatedArchivingRequest ?? [];

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
        state: descriptorState.deprecated,
        delegatedArchivingRequest: [existingArchivingRequest],
      };

      const eservice: EService = {
        ...mockEService,
        producerId: producer.id,
        descriptors: [descriptor, mockLatestDescriptor],
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
        await catalogService.submitDelegatedDescriptorArchiving(
          eservice.id,
          descriptor.id,
          {
            gracePeriodDays: mockGracePeriodDays,
          },
          getMockContext({ authData: getMockAuthData(mockDelegateTenant.id) })
        );
      const receivedEservice = requestScheduleEServiceArchivingResponse.data;

      const receivedDescriptor = receivedEservice.descriptors.find(
        (d) => d.id === descriptor.id
      );

      expect(receivedDescriptor?.delegatedArchivingRequest).toBeDefined();
      expect(receivedDescriptor?.delegatedArchivingRequest?.length).toBe(2);
      const archivingRequests =
        receivedDescriptor?.delegatedArchivingRequest ?? [];

      expect(archivingRequests.at(-1)).toEqual(expectedArchivingRequest);
      expect(archivingRequests.at(0)).toEqual(existingArchivingRequest);
    }
  );

  it("Should throw delegatedArchivingRequestAlreadyInProgress if there is already an active archiving request", async () => {
    const existingArchivingRequest = getExistingArchivingRequest("pending");

    const descriptor: Descriptor = {
      ...mockDescriptor,
      state: descriptorState.deprecated,
      delegatedArchivingRequest: [existingArchivingRequest],
    };

    const eservice: EService = {
      ...mockEService,
      producerId: producer.id,
      descriptors: [descriptor, mockLatestDescriptor],
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
      eservice.id,
      descriptor.id
    );

    await expect(
      catalogService.submitDelegatedDescriptorArchiving(
        eservice.id,
        descriptor.id,
        {
          gracePeriodDays: mockGracePeriodDays,
        },
        getMockContext({ authData: getMockAuthData(mockDelegateTenant.id) })
      )
    ).rejects.toThrow(expectedError);
  });

  it.each(disallowedActiveStates)(
    "Should throw notValidDescriptorState for descriptor in state %s",
    async (state) => {
      const descriptor: Descriptor = {
        ...mockDescriptor,
        state,
      };

      const eservice: EService = {
        ...mockEService,
        producerId: producer.id,
        descriptors: [descriptor, mockLatestDescriptor],
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

      const expectedError = notValidDescriptorState(descriptor.id, state);

      await expect(
        catalogService.submitDelegatedDescriptorArchiving(
          eservice.id,
          descriptor.id,
          {
            gracePeriodDays: mockGracePeriodDays,
          },
          getMockContext({ authData: getMockAuthData(mockDelegateTenant.id) })
        )
      ).rejects.toThrow(expectedError);
    }
  );

  it("Should throw notValidDescriptorState for last descriptor in state suspended", async () => {
    const descriptor: Descriptor = {
      ...mockDescriptor,
      state: descriptorState.suspended,
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

    const expectedError = notValidDescriptorState(
      descriptor.id,
      descriptorState.suspended
    );

    await expect(
      catalogService.submitDelegatedDescriptorArchiving(
        eservice.id,
        descriptor.id,
        {
          gracePeriodDays: mockGracePeriodDays,
        },
        getMockContext({ authData: getMockAuthData(mockDelegateTenant.id) })
      )
    ).rejects.toThrow(expectedError);
  });

  it.each(disallowedDraftStates)(
    "Should throw eserviceWithoutValidDescriptors for eservice with descriptor in state %s",
    async (state) => {
      const descriptor: Descriptor = {
        ...mockDescriptor,
        state,
      };

      const eservice: EService = {
        ...mockEService,
        producerId: producer.id,
        descriptors: [descriptor, mockLatestDescriptor],
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

      const expectedError = notValidDescriptorState(descriptor.id, state);

      await expect(
        catalogService.submitDelegatedDescriptorArchiving(
          eservice.id,
          descriptor.id,
          {
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
      state: descriptorState.deprecated,
    };

    const eservice: EService = {
      ...mockEService,
      producerId: producer.id,
      descriptors: [descriptor, mockLatestDescriptor],
    };

    await addOneTenant(producer);
    await addOneTenant(mockDelegateTenant);
    await addOneEService(eservice);

    const expectedError = noDelegationForArchivingRequest(eservice.id);

    await expect(
      catalogService.submitDelegatedDescriptorArchiving(
        eservice.id,
        descriptor.id,
        {
          gracePeriodDays: mockGracePeriodDays,
        },
        getMockContext({ authData: getMockAuthData(mockDelegateTenant.id) })
      )
    ).rejects.toThrow(expectedError);
  });

  it("Should throw operationForbidden when the producer requests the archiving", async () => {
    const descriptor: Descriptor = {
      ...mockDescriptor,
      state: descriptorState.deprecated,
    };

    const eservice: EService = {
      ...mockEService,
      producerId: producer.id,
      descriptors: [descriptor, mockLatestDescriptor],
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
      catalogService.submitDelegatedDescriptorArchiving(
        eservice.id,
        descriptor.id,
        {
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
        state: descriptorState.deprecated,
      };

      const eservice: EService = {
        ...mockEService,
        producerId: producer.id,
        descriptors: [descriptor, mockLatestDescriptor],
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
        catalogService.submitDelegatedDescriptorArchiving(
          eservice.id,
          descriptor.id,
          {
            gracePeriodDays: mockGracePeriodDays,
          },
          getMockContext({ authData: getMockAuthData(mockDelegateTenant.id) })
        )
      ).rejects.toThrow(expectedError);
    }
  );
});
