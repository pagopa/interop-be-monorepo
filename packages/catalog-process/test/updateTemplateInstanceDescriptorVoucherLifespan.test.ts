/* eslint-disable @typescript-eslint/no-floating-promises */
import {
  decodeProtobufPayload,
  getMockContext,
  getRandomAuthData,
} from "pagopa-interop-commons-test/index.js";
import {
  Descriptor,
  EService,
  EServiceDescriptorQuotasUpdatedByTemplateUpdateV2,
  toEServiceV2,
} from "pagopa-interop-models";
import { expect, describe, it } from "vitest";
import {
  eServiceNotFound,
  eServiceDescriptorNotFound,
} from "../src/model/domain/errors.js";
import {
  addOneEService,
  catalogService,
  getMockDescriptor,
  getMockDocument,
  getMockEService,
  readLastEserviceEvent,
} from "./utils.js";

describe("update descriptor", () => {
  const mockEService = getMockEService();
  const mockDescriptor = getMockDescriptor();
  const mockDocument = getMockDocument();
  it("should write on event-store for the internal update of a descriptor voucher lifespan", async () => {
    const descriptor: Descriptor = {
      ...mockDescriptor,
      interface: mockDocument,
      publishedAt: new Date(),
    };
    const eservice: EService = {
      ...mockEService,
      descriptors: [descriptor],
    };
    await addOneEService(eservice);

    const updatedEService: EService = {
      ...eservice,
      descriptors: [
        {
          ...descriptor,
          voucherLifespan: 1000,
        },
      ],
    };
    await catalogService.internalUpdateTemplateInstanceDescriptorVoucherLifespan(
      eservice.id,
      descriptor.id,
      1000,
      getMockContext({ authData: getRandomAuthData(eservice.producerId) })
    );
    const writtenEvent = await readLastEserviceEvent(eservice.id);
    expect(writtenEvent).toMatchObject({
      stream_id: eservice.id,
      version: "1",
      type: "EServiceDescriptorQuotasUpdatedByTemplateUpdate",
      event_version: 2,
    });
    const writtenPayload = decodeProtobufPayload({
      messageType: EServiceDescriptorQuotasUpdatedByTemplateUpdateV2,
      payload: writtenEvent.data,
    });
    expect(writtenPayload.eservice).toEqual(toEServiceV2(updatedEService));
  });

  it("should not write on event-store for the internal update if the e-service descriptor already has the new voucher lifespan value", async () => {
    const descriptor: Descriptor = {
      ...mockDescriptor,
      interface: mockDocument,
      publishedAt: new Date(),
      voucherLifespan: 1000,
    };
    const eservice: EService = {
      ...mockEService,
      descriptors: [descriptor],
    };
    await addOneEService(eservice);

    await catalogService.internalUpdateTemplateInstanceDescriptorVoucherLifespan(
      eservice.id,
      descriptor.id,
      1000,
      getMockContext({ authData: getRandomAuthData(eservice.producerId) })
    );
    const writtenEvent = await readLastEserviceEvent(eservice.id);
    expect(writtenEvent).not.toMatchObject({
      stream_id: eservice.id,
      version: "1",
      type: "EServiceDescriptorQuotasUpdatedByTemplateUpdate",
      event_version: 2,
    });
  });

  it("should throw eServiceNotFound if the eservice doesn't exist", () => {
    expect(
      catalogService.internalUpdateTemplateInstanceDescriptorVoucherLifespan(
        mockEService.id,
        mockDescriptor.id,
        1000,
        getMockContext({ authData: getRandomAuthData(mockEService.producerId) })
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
      catalogService.internalUpdateTemplateInstanceDescriptorVoucherLifespan(
        mockEService.id,
        mockDescriptor.id,
        1000,
        getMockContext({ authData: getRandomAuthData(mockEService.producerId) })
      )
    ).rejects.toThrowError(
      eServiceDescriptorNotFound(eservice.id, mockDescriptor.id)
    );
  });
});
