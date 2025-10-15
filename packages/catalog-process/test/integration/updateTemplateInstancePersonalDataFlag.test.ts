/* eslint-disable @typescript-eslint/no-floating-promises */
import {
  decodeProtobufPayload,
  getMockContext,
  getMockAuthData,
  getMockDocument,
  getMockDescriptor,
  getMockEService,
} from "pagopa-interop-commons-test";
import {
  Descriptor,
  descriptorState,
  EService,
  toEServiceV2,
  EServicePersonalDataFlagUpdatedByTemplateUpdateV2,
} from "pagopa-interop-models";
import { expect, describe, it } from "vitest";
import { eServiceNotFound } from "../../src/model/domain/errors.js";
import {
  addOneEService,
  catalogService,
  readLastEserviceEvent,
} from "../integrationUtils.js";

describe("internalUpdateTemplateInstancePersonalDataFlag", () => {
  it("should write on event-store for the internal update of the eService personalData flag", async () => {
    const descriptor: Descriptor = {
      ...getMockDescriptor(descriptorState.published),
      interface: getMockDocument(),
    };
    const eservice: EService = {
      ...getMockEService(),
      descriptors: [descriptor],
    };
    await addOneEService(eservice);

    const updatedPersonalDataFlag = true;

    await catalogService.internalUpdateTemplateInstancePersonalDataFlag(
      eservice.id,
      updatedPersonalDataFlag,
      getMockContext({ authData: getMockAuthData(eservice.producerId) })
    );

    const updatedEService: EService = {
      ...eservice,
      personalData: updatedPersonalDataFlag,
    };

    const writtenEvent = await readLastEserviceEvent(eservice.id);
    expect(writtenEvent).toMatchObject({
      stream_id: eservice.id,
      version: "1",
      type: "EServicePersonalDataFlagUpdatedByTemplateUpdate",
      event_version: 2,
    });
    const writtenPayload = decodeProtobufPayload({
      messageType: EServicePersonalDataFlagUpdatedByTemplateUpdateV2,
      payload: writtenEvent.data,
    });

    expect(writtenPayload.eservice).toEqual(toEServiceV2(updatedEService));
  });

  it("should throw eServiceNotFound if the eservice doesn't exist", async () => {
    const eservice = getMockEService();

    expect(
      catalogService.internalUpdateTemplateInstancePersonalDataFlag(
        eservice.id,
        true,
        getMockContext({ authData: getMockAuthData(eservice.producerId) })
      )
    ).rejects.toThrowError(eServiceNotFound(eservice.id));
  });
});
