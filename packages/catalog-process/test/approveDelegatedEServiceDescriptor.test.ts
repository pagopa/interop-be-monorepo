/* eslint-disable @typescript-eslint/no-floating-promises */
import {
  decodeProtobufPayload,
  getMockTenant,
  getMockDelegation,
  getMockContext,
  getMockAuthData,
} from "pagopa-interop-commons-test";
import {
  Descriptor,
  descriptorState,
  EService,
  toEServiceV2,
  Tenant,
  generateId,
  operationForbidden,
  delegationState,
  EServiceDescriptorApprovedByDelegatorV2,
  delegationKind,
} from "pagopa-interop-models";
import { beforeAll, vi, afterAll, expect, describe, it } from "vitest";
import {
  eServiceNotFound,
  eServiceDescriptorNotFound,
  notValidDescriptorState,
} from "../src/model/domain/errors.js";
import {
  addOneEService,
  catalogService,
  readLastEserviceEvent,
  addOneTenant,
  addOneAgreement,
  getMockEService,
  getMockDescriptor,
  getMockDocument,
  getMockAgreement,
  addOneDelegation,
} from "./utils.js";

describe("publish descriptor", () => {
  const mockEService = getMockEService();
  const mockDescriptor = getMockDescriptor();
  const mockDocument = getMockDocument();
  beforeAll(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date());
  });
  afterAll(() => {
    vi.useRealTimers();
  });
  it("should write on event-store for the publication of a waiting for approval descriptor", async () => {
    const descriptor: Descriptor = {
      ...mockDescriptor,
      state: descriptorState.waitingForApproval,
      interface: mockDocument,
    };
    const eservice: EService = {
      ...mockEService,
      descriptors: [descriptor],
    };
    await addOneEService(eservice);
    await catalogService.approveDelegatedEServiceDescriptor(
      eservice.id,
      descriptor.id,
      getMockContext({ authData: getMockAuthData(eservice.producerId) })
    );

    const writtenEvent = await readLastEserviceEvent(eservice.id);
    expect(writtenEvent).toMatchObject({
      stream_id: eservice.id,
      version: "1",
      type: "EServiceDescriptorApprovedByDelegator",
      event_version: 2,
    });
    const writtenPayload = decodeProtobufPayload({
      messageType: EServiceDescriptorApprovedByDelegatorV2,
      payload: writtenEvent.data,
    });

    const expectedEservice = toEServiceV2({
      ...eservice,
      descriptors: [
        {
          ...descriptor,
          publishedAt: new Date(),
          state: descriptorState.published,
        },
      ],
    });

    expect(writtenPayload.descriptorId).toEqual(descriptor.id);
    expect(writtenPayload.eservice).toEqual(expectedEservice);
  });

  it("should also archive the previously published descriptor", async () => {
    const descriptor1: Descriptor = {
      ...mockDescriptor,
      id: generateId(),
      state: descriptorState.published,
      publishedAt: new Date(),
      interface: mockDocument,
    };
    const descriptor2: Descriptor = {
      ...mockDescriptor,
      id: generateId(),
      state: descriptorState.waitingForApproval,
      interface: mockDocument,
    };
    const eservice: EService = {
      ...mockEService,
      descriptors: [descriptor1, descriptor2],
    };
    await addOneEService(eservice);
    await catalogService.approveDelegatedEServiceDescriptor(
      eservice.id,
      descriptor2.id,
      getMockContext({ authData: getMockAuthData(eservice.producerId) })
    );
    const writtenEvent = await readLastEserviceEvent(eservice.id);

    expect(writtenEvent).toMatchObject({
      stream_id: eservice.id,
      version: "1",
      type: "EServiceDescriptorApprovedByDelegator",
      event_version: 2,
    });

    const writtenPayload = decodeProtobufPayload({
      messageType: EServiceDescriptorApprovedByDelegatorV2,
      payload: writtenEvent.data,
    });

    const updatedDescriptor1: Descriptor = {
      ...descriptor1,
      archivedAt: new Date(),
      state: descriptorState.archived,
    };
    const updatedDescriptor2: Descriptor = {
      ...descriptor2,
      publishedAt: new Date(),
      state: descriptorState.published,
    };

    const expectedEservice: EService = {
      ...eservice,
      descriptors: [updatedDescriptor1, updatedDescriptor2],
    };
    expect(writtenPayload).toEqual({
      eservice: toEServiceV2(expectedEservice),
      descriptorId: descriptor2.id,
    });
  });

  it("should also write deprecate the previously published descriptor if there was a valid agreement", async () => {
    const descriptor1: Descriptor = {
      ...mockDescriptor,
      id: generateId(),
      state: descriptorState.published,
      publishedAt: new Date(),
      interface: mockDocument,
    };
    const descriptor2: Descriptor = {
      ...mockDescriptor,
      id: generateId(),
      state: descriptorState.waitingForApproval,
      interface: mockDocument,
    };
    const eservice: EService = {
      ...mockEService,
      descriptors: [descriptor1, descriptor2],
    };
    await addOneEService(eservice);
    const tenant: Tenant = {
      ...getMockTenant(),
    };
    await addOneTenant(tenant);
    const agreement = getMockAgreement({
      eserviceId: eservice.id,
      descriptorId: descriptor1.id,
      producerId: eservice.producerId,
      consumerId: tenant.id,
    });
    await addOneAgreement(agreement);
    await catalogService.approveDelegatedEServiceDescriptor(
      eservice.id,
      descriptor2.id,
      getMockContext({ authData: getMockAuthData(eservice.producerId) })
    );
    const writtenEvent = await readLastEserviceEvent(eservice.id);

    expect(writtenEvent).toMatchObject({
      stream_id: eservice.id,
      version: "1",
      type: "EServiceDescriptorApprovedByDelegator",
      event_version: 2,
    });
    const writtenPayload = decodeProtobufPayload({
      messageType: EServiceDescriptorApprovedByDelegatorV2,
      payload: writtenEvent.data,
    });

    const updatedDescriptor1: Descriptor = {
      ...descriptor1,
      deprecatedAt: new Date(),
      state: descriptorState.deprecated,
    };
    const updatedDescriptor2: Descriptor = {
      ...descriptor2,
      publishedAt: new Date(),
      state: descriptorState.published,
    };

    const expectedEservice: EService = {
      ...eservice,
      descriptors: [updatedDescriptor1, updatedDescriptor2],
    };
    expect(writtenPayload).toEqual({
      eservice: toEServiceV2(expectedEservice),
      descriptorId: descriptor2.id,
    });
  });

  it("should throw eServiceNotFound if the eService doesn't exist", async () => {
    await expect(
      catalogService.approveDelegatedEServiceDescriptor(
        mockEService.id,
        mockDescriptor.id,
        getMockContext({ authData: getMockAuthData(mockEService.producerId) })
      )
    ).rejects.toThrowError(eServiceNotFound(mockEService.id));
  });

  it("should throw eServiceDescriptorNotFound if the descriptor doesn't exist", async () => {
    const eservice: EService = {
      ...mockEService,
      descriptors: [],
    };
    await addOneEService(eservice);
    expect(
      catalogService.approveDelegatedEServiceDescriptor(
        eservice.id,
        mockDescriptor.id,
        getMockContext({ authData: getMockAuthData(eservice.producerId) })
      )
    ).rejects.toThrowError(
      eServiceDescriptorNotFound(eservice.id, mockDescriptor.id)
    );
  });

  it("should throw operationForbidden if the requester is not the producer", async () => {
    const descriptor: Descriptor = {
      ...mockDescriptor,
      state: descriptorState.draft,
    };
    const eservice: EService = {
      ...mockEService,
      descriptors: [descriptor],
    };
    await addOneEService(eservice);
    expect(
      catalogService.approveDelegatedEServiceDescriptor(
        eservice.id,
        descriptor.id,
        getMockContext({})
      )
    ).rejects.toThrowError(operationForbidden);
  });

  it("should throw operationForbidden if the requester is the delegate", async () => {
    const descriptor: Descriptor = {
      ...mockDescriptor,
      state: descriptorState.draft,
    };
    const eservice: EService = {
      ...mockEService,
      descriptors: [descriptor],
    };
    const delegation = getMockDelegation({
      kind: delegationKind.delegatedProducer,
      eserviceId: eservice.id,
      state: delegationState.active,
    });

    await addOneEService(eservice);
    await addOneDelegation(delegation);

    expect(
      catalogService.approveDelegatedEServiceDescriptor(
        eservice.id,
        descriptor.id,
        getMockContext({ authData: getMockAuthData(delegation.delegateId) })
      )
    ).rejects.toThrowError(operationForbidden);
  });

  it.each(
    Object.values(descriptorState).filter(
      (s) => s !== descriptorState.waitingForApproval
    )
  )(
    "should throw notValidDescriptorState if the descriptor is in %s state",
    async (state) => {
      const descriptor: Descriptor = {
        ...mockDescriptor,
        interface: mockDocument,
        state,
      };
      const eservice: EService = {
        ...mockEService,
        descriptors: [descriptor],
      };
      await addOneEService(eservice);
      expect(
        catalogService.approveDelegatedEServiceDescriptor(
          eservice.id,
          descriptor.id,
          getMockContext({ authData: getMockAuthData(eservice.producerId) })
        )
      ).rejects.toThrowError(notValidDescriptorState(descriptor.id, state));
    }
  );
});
