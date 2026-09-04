/* eslint-disable @typescript-eslint/no-floating-promises */
import { catalogApi } from "pagopa-interop-api-clients";
import {
  decodeProtobufPayload,
  getMockContextInternal,
  getMockEService,
  getMockDescriptor,
  getMockDocument,
} from "pagopa-interop-commons-test";
import {
  DelegatedDescriptorArchivingRequest,
  DelegatedEServiceArchivingRequest,
  Descriptor,
  descriptorState,
  EService,
  EServiceArchivingRequestCanceledByRevokedDelegationV2,
  EServiceDescriptorArchivingRequestCanceledByRevokedDelegationV2,
  toEServiceV2,
} from "pagopa-interop-models";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import {
  eServiceDescriptorNotFound,
  eServiceNotFound,
} from "../../src/model/domain/errors.js";
import {
  addOneEService,
  catalogService,
  readLastEserviceEvent,
} from "../integrationUtils.js";

describe("internal archive delegated archiving request", () => {
  const mockEService = getMockEService();
  const mockDescriptor = getMockDescriptor();
  const mockDocument = getMockDocument();

  const mockSeed: catalogApi.InternalArchiveDelegatedArchivingRequestSeed = {};

  beforeAll(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date());
  });
  afterAll(() => {
    vi.useRealTimers();
  });

  it("should reject the pending descriptor-level request when descriptorId is provided", async () => {
    const pendingRequest: DelegatedDescriptorArchivingRequest = {
      requestedAt: new Date(),
      requesterId: mockEService.producerId,
      gracePeriodDays: 60,
    };
    const descriptor: Descriptor = {
      ...mockDescriptor,
      interface: mockDocument,
      state: descriptorState.published,
      delegatedArchivingRequest: [pendingRequest],
    };
    const eservice: EService = {
      ...mockEService,
      descriptors: [descriptor],
    };
    await addOneEService(eservice);

    await catalogService.internalArchiveDelegatedArchivingRequest(
      eservice.id,
      { ...mockSeed, descriptorId: descriptor.id },
      getMockContextInternal({})
    );

    const writtenEvent = await readLastEserviceEvent(eservice.id);
    expect(writtenEvent).toMatchObject({
      stream_id: eservice.id,
      version: "1",
      type: "EServiceDescriptorArchivingRequestCanceledByRevokedDelegation",
      event_version: 2,
    });

    const writtenPayload = decodeProtobufPayload({
      messageType:
        EServiceDescriptorArchivingRequestCanceledByRevokedDelegationV2,
      payload: writtenEvent.data,
    });

    const expectedEservice = {
      ...eservice,
      descriptors: [
        {
          ...descriptor,
          delegatedArchivingRequest: [],
        },
      ],
    };

    expect(writtenPayload).toEqual({
      descriptorId: descriptor.id,
      eservice: toEServiceV2(expectedEservice),
    });
  });

  it("should reject the pending eService-level request when descriptorId is not provided", async () => {
    const pendingRequest: DelegatedEServiceArchivingRequest = {
      requestedAt: new Date(),
      requesterId: mockEService.producerId,
      gracePeriodDays: 60,
      archivingReason: "Mock archiving reason",
    };
    const eservice: EService = {
      ...mockEService,
      descriptors: [mockDescriptor],
      delegatedArchivingRequest: [pendingRequest],
    };
    await addOneEService(eservice);

    await catalogService.internalArchiveDelegatedArchivingRequest(
      eservice.id,
      mockSeed,
      getMockContextInternal({})
    );

    const writtenEvent = await readLastEserviceEvent(eservice.id);
    expect(writtenEvent).toMatchObject({
      stream_id: eservice.id,
      version: "1",
      type: "EServiceArchivingRequestCanceledByRevokedDelegation",
      event_version: 2,
    });

    const writtenPayload = decodeProtobufPayload({
      messageType: EServiceArchivingRequestCanceledByRevokedDelegationV2,
      payload: writtenEvent.data,
    });

    const expectedEservice = {
      ...eservice,
      delegatedArchivingRequest: undefined,
    };

    expect(writtenPayload).toEqual({
      eservice: toEServiceV2(expectedEservice),
    });
  });

  it("should be a no-op when descriptorId is provided but no active request exists on the descriptor", async () => {
    const acceptedRequest: DelegatedDescriptorArchivingRequest = {
      requestedAt: new Date(),
      requesterId: mockEService.producerId,
      gracePeriodDays: 60,
      acceptedAt: new Date(),
    };
    const descriptor: Descriptor = {
      ...mockDescriptor,
      interface: mockDocument,
      state: descriptorState.archiving,
      delegatedArchivingRequest: [acceptedRequest],
    };
    const eservice: EService = {
      ...mockEService,
      descriptors: [descriptor],
    };
    await addOneEService(eservice);

    await catalogService.internalArchiveDelegatedArchivingRequest(
      eservice.id,
      { ...mockSeed, descriptorId: descriptor.id },
      getMockContextInternal({})
    );

    const writtenEvent = await readLastEserviceEvent(eservice.id);
    expect(writtenEvent).toMatchObject({
      stream_id: eservice.id,
      version: "0",
      type: "EServiceAdded",
    });
  });

  it("should be a no-op when descriptorId is not provided and no active request exists on the eService", async () => {
    const rejectedRequest: DelegatedEServiceArchivingRequest = {
      requestedAt: new Date(),
      requesterId: mockEService.producerId,
      gracePeriodDays: 60,
      archivingReason: "Mock archiving reason",
      rejectedAt: new Date(),
      rejectionReason: "already rejected",
    };
    const eservice: EService = {
      ...mockEService,
      descriptors: [mockDescriptor],
      delegatedArchivingRequest: [rejectedRequest],
    };
    await addOneEService(eservice);

    await catalogService.internalArchiveDelegatedArchivingRequest(
      eservice.id,
      mockSeed,
      getMockContextInternal({})
    );

    const writtenEvent = await readLastEserviceEvent(eservice.id);
    expect(writtenEvent).toMatchObject({
      stream_id: eservice.id,
      version: "0",
      type: "EServiceAdded",
    });
  });

  it("should throw eServiceNotFound if the eservice doesn't exist", async () => {
    await expect(
      catalogService.internalArchiveDelegatedArchivingRequest(
        mockEService.id,
        mockSeed,
        getMockContextInternal({})
      )
    ).rejects.toThrowError(eServiceNotFound(mockEService.id));
  });

  it("should throw eServiceDescriptorNotFound if the descriptor doesn't exist", async () => {
    const eservice: EService = {
      ...mockEService,
      descriptors: [],
    };
    await addOneEService(eservice);

    await expect(
      catalogService.internalArchiveDelegatedArchivingRequest(
        eservice.id,
        { ...mockSeed, descriptorId: mockDescriptor.id },
        getMockContextInternal({})
      )
    ).rejects.toThrowError(
      eServiceDescriptorNotFound(eservice.id, mockDescriptor.id)
    );
  });
});
