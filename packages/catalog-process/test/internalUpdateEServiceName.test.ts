import { genericLogger } from "pagopa-interop-commons";
import { decodeProtobufPayload } from "pagopa-interop-commons-test/index.js";
import {
  Descriptor,
  descriptorState,
  EService,
  toEServiceV2,
  generateId,
  EServiceNameUpdatedV2,
  TenantId,
} from "pagopa-interop-models";
import { expect, describe, it } from "vitest";
import {
  eServiceNotFound,
  eServiceDuplicate,
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

describe("internalUpdateEServiceName", () => {
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

    await catalogService.internalUpdateEServiceName(eservice.id, updatedName, {
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
      type: "EServiceNameUpdated",
      event_version: 2,
    });

    const writtenPayload = decodeProtobufPayload({
      messageType: EServiceNameUpdatedV2,
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
      instanceId: "test",
    };

    await addOneEService(eservice);

    const updatedName = "eservice new name";

    await catalogService.internalUpdateEServiceName(eservice.id, updatedName, {
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
      type: "EServiceNameUpdated",
      event_version: 2,
    });

    const writtenPayload = decodeProtobufPayload({
      messageType: EServiceNameUpdatedV2,
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
      instanceId: "test",
      name: updatedName,
    };

    await addOneEService(eservice);

    await catalogService.internalUpdateEServiceName(eservice.id, updatedName, {
      authData: getMockAuthData(eservice.producerId),
      correlationId: generateId(),
      serviceName: "",
      logger: genericLogger,
    });

    const writtenEvent = await readLastEserviceEvent(eservice.id);
    expect(writtenEvent).not.toMatchObject({
      stream_id: eservice.id,
      version: "1",
      type: "EServiceNameUpdated",
      event_version: 2,
    });
  });
  it("should throw eServiceNotFound if the eservice doesn't exist", async () => {
    const eservice = getMockEService();
    await expect(
      catalogService.internalUpdateEServiceName(
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
  it("should throw eserviceDuplicate is there is another eservice with the same name by the same producer", async () => {
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
      catalogService.internalUpdateEServiceName(eservice.id, updatedName, {
        authData: getMockAuthData(eservice.producerId),
        correlationId: generateId(),
        serviceName: "",
        logger: genericLogger,
      })
    ).rejects.toThrowError(eServiceDuplicate(duplicateName));
  });
});
