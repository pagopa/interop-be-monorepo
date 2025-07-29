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
  toEServiceV2,
  operationForbidden,
  delegationState,
  DescriptorRejectionReason,
  EServiceDescriptorRejectedByDelegatorV2,
  delegationKind,
} from "pagopa-interop-models";
import { beforeAll, vi, afterAll, expect, describe, it } from "vitest";
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

describe("reject descriptor", () => {
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
  it("should write on event-store for the rejection of a waiting for approval descriptor", async () => {
    const descriptor: Descriptor = {
      ...mockDescriptor,
      state: descriptorState.waitingForApproval,
    };
    const eservice: EService = {
      ...mockEService,
      descriptors: [descriptor],
    };
    await addOneEService(eservice);

    const newRejectionReason: DescriptorRejectionReason = {
      rejectionReason: "testing",
      rejectedAt: new Date(),
    };

    const rejectDelegatedEServiceDescriptor =
      await catalogService.rejectDelegatedEServiceDescriptor(
        eservice.id,
        descriptor.id,
        { rejectionReason: newRejectionReason.rejectionReason },
        getMockContext({ authData: getMockAuthData(eservice.producerId) })
      );

    const writtenEvent = await readLastEserviceEvent(eservice.id);
    expect(writtenEvent).toMatchObject({
      stream_id: eservice.id,
      version: "1",
      type: "EServiceDescriptorRejectedByDelegator",
      event_version: 2,
    });
    const writtenPayload = decodeProtobufPayload({
      messageType: EServiceDescriptorRejectedByDelegatorV2,
      payload: writtenEvent.data,
    });

    const expectedEservice = {
      ...eservice,
      descriptors: [
        {
          ...descriptor,
          state: descriptorState.draft,
          rejectionReasons: [newRejectionReason],
        },
      ],
    };
    expect(rejectDelegatedEServiceDescriptor).toEqual({
      data: expectedEservice,
      metadata: { version: parseInt(writtenEvent.version, 10) },
    });
    expect(writtenPayload.descriptorId).toEqual(descriptor.id);
    expect(writtenPayload.eservice).toEqual(toEServiceV2(expectedEservice));
  });

  it("should throw eServiceNotFound if the eService doesn't exist", async () => {
    await expect(
      catalogService.rejectDelegatedEServiceDescriptor(
        mockEService.id,
        mockDescriptor.id,
        { rejectionReason: "test" },
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
      catalogService.rejectDelegatedEServiceDescriptor(
        eservice.id,
        mockDescriptor.id,
        { rejectionReason: "test" },
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
      catalogService.rejectDelegatedEServiceDescriptor(
        eservice.id,
        descriptor.id,

        { rejectionReason: "test" },
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
      catalogService.rejectDelegatedEServiceDescriptor(
        eservice.id,
        descriptor.id,

        { rejectionReason: "test" },
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
        catalogService.rejectDelegatedEServiceDescriptor(
          eservice.id,
          descriptor.id,

          { rejectionReason: "test" },
          getMockContext({ authData: getMockAuthData(eservice.producerId) })
        )
      ).rejects.toThrowError(notValidDescriptorState(descriptor.id, state));
    }
  );
});
