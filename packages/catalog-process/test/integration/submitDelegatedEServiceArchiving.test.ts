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
} from "pagopa-interop-models";
import { expect, describe, it, vi, beforeEach, afterEach } from "vitest";
import {
  addOneDelegation,
  addOneEService,
  addOneTenant,
  catalogService,
} from "../integrationUtils.js";

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

  const expectedArchivingRequest = {
    gracePeriodDays: mockGracePeriodDays,
    requestedAt: fixedDate,
    requesterId: mockDelegateTenant.id,
    archivingReason: mockArchivingReason,
  };

  beforeEach(() => {
    vi.useRealTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("Should create a new archiving request for eservice", async () => {
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
    const archivingRequests = receivedEservice.delegatedArchivingRequest ?? [];

    expect(archivingRequests.at(-1)).toEqual(expectedArchivingRequest);
  });
});
