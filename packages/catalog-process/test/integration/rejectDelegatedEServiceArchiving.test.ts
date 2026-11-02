/* eslint-disable @typescript-eslint/no-floating-promises */
import {
  decodeProtobufPayload,
  getMockDelegation,
  getMockTenant,
  getMockContext,
  getMockAuthData,
  getMockEService,
  getMockDescriptor,
  getMockDocument,
  randomArrayItem,
} from "pagopa-interop-commons-test";
import {
  Descriptor,
  descriptorState,
  EService,
  toEServiceV2,
  Tenant,
  delegationState,
  delegationKind,
  tenantKind,
  TenantKind,
  DelegatedEServiceArchivingRequest,
  EServiceArchivingRequestRejectedByDelegatorV2,
} from "pagopa-interop-models";
import { beforeAll, vi, afterAll, expect, describe, it } from "vitest";

import {
  eServiceNotFound,
  noActiveDelegationFound,
  noDelegatedArchivingRequestFound,
  delegatedArchivingRequestNotActive,
} from "../../src/model/domain/errors.js";
import {
  addOneEService,
  catalogService,
  readLastEserviceEvent,
  addOneTenant,
  addOneDelegation,
} from "../integrationUtils.js";

describe("reject delegated EService archiving request", () => {
  const mockEService: EService = { ...getMockEService(), personalData: false };
  const mockDescriptor = getMockDescriptor();
  const mockDocument = getMockDocument();
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
  const disallowedDelegationStates = Object.values(delegationState).filter(
    (ds) => ds !== delegationState.active
  );
  const mockRejectionReason = {
    rejectionReason: "Not needed",
  };

  beforeAll(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date());
  });
  afterAll(() => {
    vi.useRealTimers();
  });

  it("should write on event-store a rejection of EService archiving request", async () => {
    const mockEServiceArchivingRequest: DelegatedEServiceArchivingRequest = {
      gracePeriodDays: 60,
      requestedAt: new Date(),
      requesterId: mockDelegateTenant.id,
      archivingReason: "Mock archiving reason",
    };
    const descriptor: Descriptor = {
      ...mockDescriptor,
      state: descriptorState.published,
    };
    const eservice: EService = {
      ...mockEService,
      producerId: producer.id,
      descriptors: [descriptor],
      delegatedArchivingRequest: [mockEServiceArchivingRequest],
    };

    const mockDelegation = getMockDelegation({
      kind: delegationKind.delegatedProducer,
      eserviceId: eservice.id,
      delegateId: mockDelegateTenant.id,
      state: delegationState.active,
    });

    await addOneTenant(producer);
    await addOneTenant(mockDelegateTenant);
    await addOneDelegation(mockDelegation);
    await addOneEService(eservice);
    const rejectDelegatedEServiceArchivingResponse =
      await catalogService.rejectDelegatedEServiceArchiving(
        eservice.id,
        mockRejectionReason,
        getMockContext({ authData: getMockAuthData(producer.id) })
      );

    const writtenEvent = await readLastEserviceEvent(eservice.id);
    expect(writtenEvent).toMatchObject({
      stream_id: eservice.id,
      version: "1",
      type: "EServiceArchivingRequestRejectedByDelegator",
      event_version: 2,
    });
    const writtenPayload = decodeProtobufPayload({
      messageType: EServiceArchivingRequestRejectedByDelegatorV2,
      payload: writtenEvent.data,
    });

    const expectedRejectedRequest: DelegatedEServiceArchivingRequest = {
      ...mockEServiceArchivingRequest,
      rejectedAt: new Date(),
      rejectionReason: mockRejectionReason.rejectionReason,
    };

    const expectedEservice = {
      ...eservice,
      delegatedArchivingRequest: [expectedRejectedRequest],
    };
    expect(rejectDelegatedEServiceArchivingResponse).toEqual({
      data: expectedEservice,
      metadata: { version: parseInt(writtenEvent.version, 10) },
    });
    expect(writtenPayload).toEqual({
      eservice: toEServiceV2(expectedEservice),
    });
  });

  it("should throw eServiceNotFound if the eService doesn't exist", async () => {
    await expect(
      catalogService.rejectDelegatedEServiceArchiving(
        mockEService.id,
        mockRejectionReason,
        getMockContext({ authData: getMockAuthData(mockEService.producerId) })
      )
    ).rejects.toThrow(eServiceNotFound(mockEService.id));
  });

  it("should throw noDelegatedArchivingRequestFound if archiving request doesn't exist", async () => {
    const eservice: EService = {
      ...mockEService,
      descriptors: [],
    };
    await addOneEService(eservice);
    expect(
      catalogService.rejectDelegatedEServiceArchiving(
        eservice.id,
        mockRejectionReason,
        getMockContext({ authData: getMockAuthData(eservice.producerId) })
      )
    ).rejects.toThrow(noDelegatedArchivingRequestFound(eservice.id));
  });

  it.each(disallowedDelegationStates)(
    "Should throw noActiveDelegationFound when delegation has state %s",
    async (state) => {
      const descriptor: Descriptor = {
        ...mockDescriptor,
        state: descriptorState.published,
        interface: mockDocument,
      };

      const mockEServiceArchivingRequest: DelegatedEServiceArchivingRequest = {
        gracePeriodDays: 60,
        requestedAt: new Date(),
        requesterId: mockDelegateTenant.id,
        archivingReason: "Mock archiving reason",
      };

      const eservice: EService = {
        ...mockEService,
        producerId: producer.id,
        descriptors: [descriptor],
        delegatedArchivingRequest: [mockEServiceArchivingRequest],
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

      const expectedError = noActiveDelegationFound(eservice.id);

      await expect(
        catalogService.rejectDelegatedEServiceArchiving(
          eservice.id,
          mockRejectionReason,
          getMockContext({ authData: getMockAuthData(producer.id) })
        )
      ).rejects.toThrow(expectedError);
    }
  );

  it("should throw delegatedArchivingRequestNotActive if eservice has no active requests", async () => {
    const descriptor: Descriptor = {
      ...mockDescriptor,
      state: descriptorState.published,
      interface: mockDocument,
    };

    const mockEServiceAcceptedArchivingRequest: DelegatedEServiceArchivingRequest =
      {
        gracePeriodDays: 60,
        requestedAt: new Date(),
        requesterId: mockDelegateTenant.id,
        archivingReason: "Mock archiving reason",
        acceptedAt: new Date(),
      };

    const mockEServiceRejectedArchivingRequest: DelegatedEServiceArchivingRequest =
      {
        gracePeriodDays: 60,
        requestedAt: new Date(),
        requesterId: mockDelegateTenant.id,
        archivingReason: "Mock archiving reason",
        rejectedAt: new Date(),
        rejectionReason: "Not needed",
      };

    const eservice: EService = {
      ...mockEService,
      producerId: producer.id,
      descriptors: [descriptor],
      delegatedArchivingRequest: [
        mockEServiceAcceptedArchivingRequest,
        mockEServiceRejectedArchivingRequest,
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

    const expectedError = delegatedArchivingRequestNotActive(eservice.id);

    expect(
      catalogService.rejectDelegatedEServiceArchiving(
        eservice.id,
        mockRejectionReason,
        getMockContext({ authData: getMockAuthData(producer.id) })
      )
    ).rejects.toThrow(expectedError);
  });
});
