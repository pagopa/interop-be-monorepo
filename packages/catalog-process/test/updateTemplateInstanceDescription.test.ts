/* eslint-disable @typescript-eslint/no-floating-promises */
import {
  decodeProtobufPayload,
  getMockContext,
  getMockAuthData,
} from "pagopa-interop-commons-test/index.js";
import {
  Descriptor,
  descriptorState,
  EService,
  toEServiceV2,
  EServiceDescriptionUpdatedByTemplateUpdateV2,
} from "pagopa-interop-models";
import { expect, describe, it } from "vitest";
import { eServiceNotFound } from "../src/model/domain/errors.js";
import {
  addOneEService,
  catalogService,
  readLastEserviceEvent,
  getMockDocument,
  getMockDescriptor,
  getMockEService,
} from "./utils.js";

describe("internalupdateTemplateInstanceDescription", () => {
  it("should write on event-store for the internal update of the eService description", async () => {
    const descriptor: Descriptor = {
      ...getMockDescriptor(descriptorState.published),
      interface: getMockDocument(),
    };
    const eservice: EService = {
      ...getMockEService(),
      descriptors: [descriptor],
    };
    await addOneEService(eservice);

    const updatedDescription = "eservice new description";

    await catalogService.internalUpdateTemplateInstanceDescription(
      eservice.id,
      updatedDescription,
      getMockContext({ authData: getMockAuthData(eservice.producerId) })
    );

    const updatedEService: EService = {
      ...eservice,
      description: updatedDescription,
    };

    const writtenEvent = await readLastEserviceEvent(eservice.id);
    expect(writtenEvent).toMatchObject({
      stream_id: eservice.id,
      version: "1",
      type: "EServiceDescriptionUpdatedByTemplateUpdate",
      event_version: 2,
    });
    const writtenPayload = decodeProtobufPayload({
      messageType: EServiceDescriptionUpdatedByTemplateUpdateV2,
      payload: writtenEvent.data,
    });

    expect(writtenPayload.eservice).toEqual(toEServiceV2(updatedEService));
  });

  it("should throw eServiceNotFound if the eservice doesn't exist", async () => {
    const eservice = getMockEService();

    expect(
      catalogService.internalUpdateTemplateInstanceDescription(
        eservice.id,
        "eservice new description",
        getMockContext({ authData: getMockAuthData(eservice.producerId) })
      )
    ).rejects.toThrowError(eServiceNotFound(eservice.id));
  });
});
