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
  GracePeriodDays,
  toEServiceV2,
  operationForbidden,
  generateId,
  TenantId,
  DelegatedEServiceArchivingRequest,
  EServiceArchivingRequestCanceledByDelegateV2,
} from "pagopa-interop-models";
import { match } from "ts-pattern";
import { expect, describe, it, vi, beforeEach, afterEach } from "vitest";

import {
  delegatedArchiveRequestForIncorrectDelegateProducer,
  noDelegatedArchivingRequestFound,
  noDelegationForArchivingRequest,
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
  const mockArchivingReason = "Test reason";
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

  const disallowedDelegationStates = Object.values(delegationState).filter(
    (ds) => ds !== delegationState.active
  );

  beforeEach(() => {
    vi.useRealTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("should write on event-store for the cancelation of an archival request for an E-service", async () => {
    const descriptor: Descriptor = {
      ...mockDescriptor,
      state: descriptorState.deprecated,
    };

    const eservice: EService = {
      ...mockEService,
      producerId: producer.id,
      descriptors: [descriptor, mockLatestDescriptor],
      delegatedArchivingRequest: [expectedArchivingRequest],
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
      await catalogService.cancelDelegatedEServiceArchiving(
        eservice.id,
        getMockContext({ authData: getMockAuthData(mockDelegateTenant.id) })
      );

    const writtenEvent = await readLastEserviceEvent(eservice.id);
    expect(writtenEvent.stream_id).toBe(eservice.id);
    expect(writtenEvent.version).toBe("1");
    expect(writtenEvent.type).toBe(
      "EServiceArchivingRequestCanceledByDelegate"
    );
    expect(writtenEvent.event_version).toBe(2);
    const writtenPayload = decodeProtobufPayload({
      messageType: EServiceArchivingRequestCanceledByDelegateV2,
      payload: writtenEvent.data,
    });

    const expectedDescriptor: Descriptor = {
      ...descriptor,
    };

    const expectedEService: EService = {
      ...eservice,
      descriptors: [expectedDescriptor, mockLatestDescriptor],
      delegatedArchivingRequest: undefined,
    };

    expect(writtenPayload.eservice).toEqual(toEServiceV2(expectedEService));
    expect(scheduleEServiceArchivingResponse).toEqual({
      data: expectedEService,
      metadata: { version: parseInt(writtenEvent.version, 10) },
    });
  });

  it("Should remove the existing archiving request for an E-Service", async () => {
    const existingArchivingRequest = getExistingArchivingRequest("pending");
    const descriptor: Descriptor = {
      ...mockDescriptor,
      state: descriptorState.deprecated,
    };

    const eservice: EService = {
      ...mockEService,
      producerId: producer.id,
      descriptors: [descriptor, mockLatestDescriptor],
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
      await catalogService.cancelDelegatedEServiceArchiving(
        eservice.id,
        getMockContext({ authData: getMockAuthData(mockDelegateTenant.id) })
      );
    const receivedEservice = requestScheduleEServiceArchivingResponse.data;
    expect(receivedEservice?.delegatedArchivingRequest).toBeUndefined();
  });

  it.each(["accepted", "rejected"])(
    "Should remove only the pending archiving request for eservice and keep the previous %s requests",
    async (archivingRequestType) => {
      const existingArchivingRequest = getExistingArchivingRequest(
        archivingRequestType as ArchivingRequestType
      );

      const pendingArchivingRequest = getExistingArchivingRequest("pending");

      const descriptor: Descriptor = {
        ...mockDescriptor,
        state: descriptorState.deprecated,
      };

      const eservice: EService = {
        ...mockEService,
        producerId: producer.id,
        descriptors: [descriptor, mockLatestDescriptor],
        delegatedArchivingRequest: [
          existingArchivingRequest,
          pendingArchivingRequest,
        ],
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
        await catalogService.cancelDelegatedEServiceArchiving(
          eservice.id,
          getMockContext({ authData: getMockAuthData(mockDelegateTenant.id) })
        );
      const receivedEservice = requestScheduleEServiceArchivingResponse.data;

      expect(receivedEservice?.delegatedArchivingRequest).toBeDefined();
      expect(receivedEservice?.delegatedArchivingRequest?.length).toBe(1);
      const archivingRequests =
        receivedEservice?.delegatedArchivingRequest ?? [];
      expect(archivingRequests.at(0)).toEqual(existingArchivingRequest);
    }
  );

  it("Should throw noDelegatedArchivingRequestFound if there is no active archiving request", async () => {
    const descriptor: Descriptor = {
      ...mockDescriptor,
      state: descriptorState.deprecated,
    };

    const eservice: EService = {
      ...mockEService,
      producerId: producer.id,
      descriptors: [descriptor, mockLatestDescriptor],
      delegatedArchivingRequest: undefined,
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

    const expectedError = noDelegatedArchivingRequestFound(eservice.id);

    await expect(
      catalogService.cancelDelegatedEServiceArchiving(
        eservice.id,
        getMockContext({ authData: getMockAuthData(mockDelegateTenant.id) })
      )
    ).rejects.toThrow(expectedError);
  });

  it("Should throw noDelegationForArchivingRequest when there is no delegation", async () => {
    const existingArchivingRequest = getExistingArchivingRequest("pending");
    const descriptor: Descriptor = {
      ...mockDescriptor,
      state: descriptorState.deprecated,
    };

    const eservice: EService = {
      ...mockEService,
      producerId: producer.id,
      descriptors: [descriptor, mockLatestDescriptor],
      delegatedArchivingRequest: [existingArchivingRequest],
    };

    await addOneTenant(producer);
    await addOneTenant(mockDelegateTenant);
    await addOneEService(eservice);

    const expectedError = noDelegationForArchivingRequest(eservice.id);

    await expect(
      catalogService.cancelDelegatedEServiceArchiving(
        eservice.id,
        getMockContext({ authData: getMockAuthData(mockDelegateTenant.id) })
      )
    ).rejects.toThrow(expectedError);
  });

  it("Should throw operationForbidden when the producer requests the archiving", async () => {
    const existingArchivingRequest = getExistingArchivingRequest("pending");
    const descriptor: Descriptor = {
      ...mockDescriptor,
      state: descriptorState.deprecated,
    };

    const eservice: EService = {
      ...mockEService,
      producerId: producer.id,
      descriptors: [descriptor, mockLatestDescriptor],
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

    const expectedError = operationForbidden;

    await expect(
      catalogService.cancelDelegatedEServiceArchiving(
        eservice.id,
        getMockContext({ authData: getMockAuthData(producer.id) })
      )
    ).rejects.toThrow(expectedError);
  });

  it.each(disallowedDelegationStates)(
    "Should throw noDelegationForArchivingRequest when delegation has state %s",
    async (state) => {
      const existingArchivingRequest = getExistingArchivingRequest("pending");
      const descriptor: Descriptor = {
        ...mockDescriptor,
        state: descriptorState.deprecated,
      };

      const eservice: EService = {
        ...mockEService,
        producerId: producer.id,
        descriptors: [descriptor, mockLatestDescriptor],
        delegatedArchivingRequest: [existingArchivingRequest],
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
        catalogService.cancelDelegatedEServiceArchiving(
          eservice.id,
          getMockContext({ authData: getMockAuthData(mockDelegateTenant.id) })
        )
      ).rejects.toThrow(expectedError);
    }
  );

  it("Should throw delegatedArchiveRequestForIncorrectDelegateProducer", async () => {
    const existingArchivingRequest = {
      ...getExistingArchivingRequest("pending"),
      requesterId: generateId<TenantId>(),
    };
    const descriptor: Descriptor = {
      ...mockDescriptor,
      state: descriptorState.deprecated,
    };

    const eservice: EService = {
      ...mockEService,
      producerId: producer.id,
      descriptors: [descriptor, mockLatestDescriptor],
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

    const expectedError = delegatedArchiveRequestForIncorrectDelegateProducer(
      eservice.id
    );

    await expect(
      catalogService.cancelDelegatedEServiceArchiving(
        eservice.id,
        getMockContext({ authData: getMockAuthData(mockDelegateTenant.id) })
      )
    ).rejects.toThrow(expectedError);
  });
});
