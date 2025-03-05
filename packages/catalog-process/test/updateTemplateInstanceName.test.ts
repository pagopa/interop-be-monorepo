import { genericLogger } from "pagopa-interop-commons";
import { decodeProtobufPayload } from "pagopa-interop-commons-test/index.js";
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
  getMockAuthData,
  readLastEserviceEvent,
  getMockDocument,
  getMockDescriptor,
  getMockEService,
} from "./utils.js";

describe("updateTemplateInstanceName", () => {
  it("should write on event-store for the internal update of the eService name without instanceId", async () => {
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

    await catalogService.updateTemplateInstanceName(eservice.id, updatedName, {
      authData: getMockAuthData(eservice.producerId),
      correlationId: generateId(),
      serviceName: "",
      logger: genericLogger,
    });

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

  it("should write on event-store for the internal update of the eService name with instanceId", async () => {
    const descriptor: Descriptor = {
      ...getMockDescriptor(descriptorState.published),
      interface: getMockDocument(),
    };

    const eservice: EService = {
      ...getMockEService(),
      descriptors: [descriptor],
      templateRef: { id: generateId(), instanceId: "test" },
    };

    await addOneEService(eservice);

    const updatedName = "eservice new name";

    await catalogService.updateTemplateInstanceName(eservice.id, updatedName, {
      authData: getMockAuthData(eservice.producerId),
      correlationId: generateId(),
      serviceName: "",
      logger: genericLogger,
    });

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
      templateRef: { id: generateId(), instanceId: "test" },
      name: `${updatedName} test`,
    };

    await addOneEService(eservice);

    await catalogService.updateTemplateInstanceName(eservice.id, updatedName, {
      authData: getMockAuthData(eservice.producerId),
      correlationId: generateId(),
      serviceName: "",
      logger: genericLogger,
    });

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
      catalogService.updateTemplateInstanceName(
        eservice.id,
        "eservice new name",
        {
          authData: getMockAuthData(eservice.producerId),
          correlationId: generateId(),
          serviceName: "",
          logger: genericLogger,
        }
      )
    ).rejects.toThrowError(eServiceNotFound(eservice.id));
  });
  it("should throw eServiceNameDuplicate is there is another eservice with the same name by the same producer", async () => {
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
      catalogService.updateTemplateInstanceName(eservice.id, updatedName, {
        authData: getMockAuthData(eservice.producerId),
        correlationId: generateId(),
        serviceName: "",
        logger: genericLogger,
      })
    ).rejects.toThrowError(eServiceNameDuplicate(duplicateName));
  });
});
