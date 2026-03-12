/* eslint-disable @typescript-eslint/no-non-null-assertion */
/* eslint-disable @typescript-eslint/no-floating-promises */
import {
  decodeProtobufPayload,
  getMockContext,
  getMockDelegation,
  getMockAuthData,
  getMockEService,
  getMockDescriptor,
  getMockDocument,
} from "pagopa-interop-commons-test";
import {
  Descriptor,
  descriptorState,
  EService,
  EServiceDescriptorSuspendedV2,
  toEServiceV2,
  operationForbidden,
  delegationState,
  delegationKind,
} from "pagopa-interop-models";
import { expect, describe, it } from "vitest";
import {
  eServiceNotFound,
  eServiceDescriptorNotFound,
  notValidDescriptorState,
} from "../../src/model/domain/errors.js";
import {
  addOneEService,
  catalogService,
  readLastEserviceEvent,
  addOneDelegation,
} from "../integrationUtils.js";

describe("suspend descriptor", () => {
  const mockEService = getMockEService();
  const mockDescriptor = getMockDescriptor();
  const mockDocument = getMockDocument();
  it("should write on event-store for the suspension of a descriptor", async () => {
    const descriptor: Descriptor = {
      ...mockDescriptor,
      interface: mockDocument,
      state: descriptorState.published,
    };
    const eservice: EService = {
      ...mockEService,
      descriptors: [descriptor],
    };
    await addOneEService(eservice);
    const suspendDescriptorResponse = await catalogService.suspendDescriptor(
      eservice.id,
      descriptor.id,
      getMockContext({ authData: getMockAuthData(eservice.producerId) })
    );

    const writtenEvent = await readLastEserviceEvent(eservice.id);
    expect(writtenEvent.stream_id).toBe(eservice.id);
    expect(writtenEvent.version).toBe("1");
    expect(writtenEvent.type).toBe("EServiceDescriptorSuspended");
    expect(writtenEvent.event_version).toBe(2);
    const writtenPayload = decodeProtobufPayload({
      messageType: EServiceDescriptorSuspendedV2,
      payload: writtenEvent.data,
    });

    const expectedEservice = {
      ...eservice,
      descriptors: [
        {
          ...descriptor,
          state: descriptorState.suspended,
          suspendedAt: new Date(
            Number(writtenPayload.eservice!.descriptors[0]!.suspendedAt)
          ),
        },
      ],
    };
    expect(suspendDescriptorResponse).toEqual({
      data: expectedEservice,
      metadata: { version: parseInt(writtenEvent.version, 10) },
    });
    expect(writtenPayload.descriptorId).toEqual(descriptor.id);
    expect(writtenPayload.eservice).toEqual(toEServiceV2(expectedEservice));
  });
  it("should write on event-store for the suspension of a descriptor (delegate)", async () => {
    const descriptor: Descriptor = {
      ...mockDescriptor,
      interface: mockDocument,
      state: descriptorState.published,
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

    const suspendDescriptorResponse = await catalogService.suspendDescriptor(
      eservice.id,
      descriptor.id,
      getMockContext({ authData: getMockAuthData(delegation.delegateId) })
    );

    const writtenEvent = await readLastEserviceEvent(eservice.id);
    expect(writtenEvent.stream_id).toBe(eservice.id);
    expect(writtenEvent.version).toBe("1");
    expect(writtenEvent.type).toBe("EServiceDescriptorSuspended");
    expect(writtenEvent.event_version).toBe(2);
    const writtenPayload = decodeProtobufPayload({
      messageType: EServiceDescriptorSuspendedV2,
      payload: writtenEvent.data,
    });

    const expectedEservice = {
      ...eservice,
      descriptors: [
        {
          ...descriptor,
          state: descriptorState.suspended,
          suspendedAt: new Date(
            Number(writtenPayload.eservice!.descriptors[0]!.suspendedAt)
          ),
        },
      ],
    };
    expect(suspendDescriptorResponse).toEqual({
      data: expectedEservice,
      metadata: { version: parseInt(writtenEvent.version, 10) },
    });
    expect(writtenPayload.descriptorId).toEqual(descriptor.id);
    expect(writtenPayload.eservice).toEqual(toEServiceV2(expectedEservice));
  });

  it("should throw eServiceNotFound if the eservice doesn't exist", () => {
    expect(
      catalogService.suspendDescriptor(
        mockEService.id,
        mockDescriptor.id,
        getMockContext({ authData: getMockAuthData(mockEService.producerId) })
      )
    ).rejects.toThrowError(eServiceNotFound(mockEService.id));
  });

  it("should throw operationForbidden if the requester is not the producer", async () => {
    const descriptor: Descriptor = {
      ...mockDescriptor,
      interface: mockDocument,
      state: descriptorState.published,
    };
    const eservice: EService = {
      ...mockEService,
      descriptors: [descriptor],
    };
    await addOneEService(eservice);
    expect(
      catalogService.suspendDescriptor(
        eservice.id,
        descriptor.id,
        getMockContext({})
      )
    ).rejects.toThrowError(operationForbidden);
  });

  it("should throw operationForbidden if the requester if the given e-service has been delegated and caller is not the delegate", async () => {
    const descriptor: Descriptor = {
      ...mockDescriptor,
      interface: mockDocument,
      state: descriptorState.published,
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
      catalogService.suspendDescriptor(
        eservice.id,
        descriptor.id,
        getMockContext({ authData: getMockAuthData(eservice.producerId) })
      )
    ).rejects.toThrowError(operationForbidden);
  });

  it("should throw eServiceDescriptorNotFound if the descriptor doesn't exist", async () => {
    const eservice: EService = {
      ...mockEService,
      descriptors: [],
    };
    await addOneEService(eservice);

    expect(
      catalogService.suspendDescriptor(
        eservice.id,
        mockDescriptor.id,
        getMockContext({ authData: getMockAuthData(mockEService.producerId) })
      )
    ).rejects.toThrowError(
      eServiceDescriptorNotFound(eservice.id, mockDescriptor.id)
    );
  });

  it.each([
    descriptorState.draft,
    descriptorState.waitingForApproval,
    descriptorState.suspended,
    descriptorState.archived,
  ])(
    "should throw notValidDescriptorState if the descriptor is in %s state",
    async (state) => {
      const descriptor: Descriptor = {
        ...mockDescriptor,
        state,
      };
      const eservice: EService = {
        ...mockEService,
        descriptors: [descriptor],
      };
      await addOneEService(eservice);
      expect(
        catalogService.suspendDescriptor(
          eservice.id,
          descriptor.id,
          getMockContext({ authData: getMockAuthData(eservice.producerId) })
        )
      ).rejects.toThrowError(notValidDescriptorState(descriptor.id, state));
    }
  );
});
