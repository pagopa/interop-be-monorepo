import {
  decodeProtobufPayload,
  getMockContext,
  getMockAuthData,
} from "pagopa-interop-commons-test";
import {
  Descriptor,
  descriptorState,
  EService,
  toEServiceV2,
  generateId,
  EServiceNameUpdatedByTemplateUpdateV2,
  TenantId,
} from "pagopa-interop-models";
import { expect, describe, it } from "vitest";
import {
  eServiceNotFound,
  eServiceNameDuplicate,
} from "../src/model/domain/errors.js";
import {
  addOneEService,
  catalogService,
  readLastEserviceEvent,
  getMockDocument,
  getMockDescriptor,
  getMockEService,
} from "./utils.js";

describe("updateTemplateInstanceName", () => {
  it("should write on event-store for the internal update of the eService name without instanceLabel", async () => {
    const descriptor: Descriptor = {
      ...getMockDescriptor(descriptorState.published),
      interface: getMockDocument(),
    };

    const eservice: EService = {
      ...getMockEService(),
      descriptors: [descriptor],
    };

    await addOneEService(eservice);

    const updatedName = "eservice new name";

    await catalogService.internalUpdateTemplateInstanceName(
      eservice.id,
      updatedName,
      getMockContext({ authData: getMockAuthData(eservice.producerId) })
    );

    const updatedEService: EService = {
      ...eservice,
      name: updatedName,
    };

    const writtenEvent = await readLastEserviceEvent(eservice.id);
    expect(writtenEvent).toMatchObject({
      stream_id: eservice.id,
      version: "1",
      type: "EServiceNameUpdatedByTemplateUpdate",
      event_version: 2,
    });

    const writtenPayload = decodeProtobufPayload({
      messageType: EServiceNameUpdatedByTemplateUpdateV2,
      payload: writtenEvent.data,
    });

    expect(writtenPayload.eservice).toEqual(toEServiceV2(updatedEService));
  });

  it("should write on event-store for the internal update of the eService name with instanceLabel", async () => {
    const descriptor: Descriptor = {
      ...getMockDescriptor(descriptorState.published),
      interface: getMockDocument(),
    };

    const eservice: EService = {
      ...getMockEService(),
      descriptors: [descriptor],
      templateRef: { id: generateId(), instanceLabel: "test" },
    };

    await addOneEService(eservice);

    const updatedName = "eservice new name";

    await catalogService.internalUpdateTemplateInstanceName(
      eservice.id,
      updatedName,
      getMockContext({ authData: getMockAuthData(eservice.producerId) })
    );

    const updatedEService: EService = {
      ...eservice,
      name: `${updatedName} test`,
    };

    const writtenEvent = await readLastEserviceEvent(eservice.id);
    expect(writtenEvent).toMatchObject({
      stream_id: eservice.id,
      version: "1",
      type: "EServiceNameUpdatedByTemplateUpdate",
      event_version: 2,
    });

    const writtenPayload = decodeProtobufPayload({
      messageType: EServiceNameUpdatedByTemplateUpdateV2,
      payload: writtenEvent.data,
    });

    expect(writtenPayload.eservice).toEqual(toEServiceV2(updatedEService));
  });

  it("should not write on event-store if the e-service already has the new name", async () => {
    const descriptor: Descriptor = {
      ...getMockDescriptor(descriptorState.published),
      interface: getMockDocument(),
    };

    const updatedName = "eservice new name";

    const eservice: EService = {
      ...getMockEService(),
      descriptors: [descriptor],
      templateRef: { id: generateId(), instanceLabel: "test" },
      name: `${updatedName} test`,
    };

    await addOneEService(eservice);

    await catalogService.internalUpdateTemplateInstanceName(
      eservice.id,
      updatedName,
      getMockContext({ authData: getMockAuthData(eservice.producerId) })
    );

    const writtenEvent = await readLastEserviceEvent(eservice.id);
    expect(writtenEvent).not.toMatchObject({
      stream_id: eservice.id,
      version: "1",
      type: "EServiceNameUpdatedByTemplateUpdate",
      event_version: 2,
    });
  });
  it("should throw eServiceNotFound if the eservice doesn't exist", async () => {
    const eservice = getMockEService();
    await expect(
      catalogService.internalUpdateTemplateInstanceName(
        eservice.id,
        "eservice new name",
        getMockContext({ authData: getMockAuthData(eservice.producerId) })
      )
    ).rejects.toThrowError(eServiceNotFound(eservice.id));
  });
  it("should throw eServiceNameDuplicate if there is another eservice with the same name by the same producer", async () => {
    const producerId = generateId<TenantId>();
    const descriptor: Descriptor = {
      ...getMockDescriptor(descriptorState.published),
      interface: getMockDocument(),
    };
    const eservice: EService = {
      ...getMockEService(),
      producerId,
      descriptors: [descriptor],
    };

    const duplicateName = "eservice duplciate name";

    const eserviceWithSameName: EService = {
      ...getMockEService(),
      producerId,
      name: duplicateName,
    };
    await addOneEService(eservice);

    await addOneEService(eserviceWithSameName);

    const updatedName = duplicateName;
    await expect(
      catalogService.internalUpdateTemplateInstanceName(
        eservice.id,
        updatedName,
        getMockContext({ authData: getMockAuthData(eservice.producerId) })
      )
    ).rejects.toThrowError(eServiceNameDuplicate(duplicateName));
  });
});
