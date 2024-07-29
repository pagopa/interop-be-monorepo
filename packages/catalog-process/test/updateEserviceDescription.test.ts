/* eslint-disable @typescript-eslint/no-floating-promises */
import { genericLogger } from "pagopa-interop-commons";
import { decodeProtobufPayload } from "pagopa-interop-commons-test/index.js";
import {
  Descriptor,
  descriptorState,
  EService,
  toEServiceV2,
  operationForbidden,
  EServiceDescriptionUpdatedV2,
} from "pagopa-interop-models";
import { expect, describe, it } from "vitest";
import {
  eserviceWithoutValidDescriptors,
  eServiceNotFound,
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

describe("update eService description", () => {
  it("should write on event-store for the update of the eService description", async () => {
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
    const returnedEService = await catalogService.updateEServiceDescription(
      eservice.id,
      updatedDescription,
      {
        authData: getMockAuthData(eservice.producerId),
        correlationId: "",
        serviceName: "",
        logger: genericLogger,
      }
    );

    const updatedEService: EService = {
      ...eservice,
      description: updatedDescription,
    };

    const writtenEvent = await readLastEserviceEvent(eservice.id);
    expect(writtenEvent).toMatchObject({
      stream_id: eservice.id,
      version: "1",
      type: "EServiceDescriptionUpdated",
      event_version: 2,
    });
    const writtenPayload = decodeProtobufPayload({
      messageType: EServiceDescriptionUpdatedV2,
      payload: writtenEvent.data,
    });

    expect(writtenPayload.eservice).toEqual(toEServiceV2(updatedEService));
    expect(writtenPayload.eservice).toEqual(toEServiceV2(returnedEService));
  });
  it("should throw eServiceNotFound if the eservice doesn't exist", async () => {
    const eservice = getMockEService();

    expect(
      catalogService.updateEServiceDescription(
        eservice.id,
        "eservice new description",
        {
          authData: getMockAuthData(eservice.producerId),
          correlationId: "",
          serviceName: "",
          logger: genericLogger,
        }
      )
    ).rejects.toThrowError(eServiceNotFound(eservice.id));
  });

  it("should throw operationForbidden if the requester is not the producer", async () => {
    const eservice = getMockEService();
    await addOneEService(eservice);

    expect(
      catalogService.updateEServiceDescription(
        eservice.id,
        "eservice new description",
        {
          authData: getMockAuthData(),
          correlationId: "",
          serviceName: "",
          logger: genericLogger,
        }
      )
    ).rejects.toThrowError(operationForbidden);
  });
  it("shoudl throw eserviceWithoutValidDescriptors if the eservice doesn't have any descriptors", async () => {
    const eservice = getMockEService();
    await addOneEService(eservice);

    expect(
      catalogService.updateEServiceDescription(
        eservice.id,
        "eservice new description",
        {
          authData: getMockAuthData(eservice.producerId),
          correlationId: "",
          serviceName: "",
          logger: genericLogger,
        }
      )
    ).rejects.toThrowError(eserviceWithoutValidDescriptors(eservice.id));
  });
  it.each([descriptorState.draft, descriptorState.archived])(
    "should throw eserviceWithoutValidDescriptors if the eservice doesn't have valid descriptors (Descriptor with state %s)",
    async (state) => {
      const descriptor: Descriptor = {
        ...getMockDescriptor(state),
        interface: getMockDocument(),
      };
      const eservice: EService = {
        ...getMockEService(),
        descriptors: [descriptor],
      };
      await addOneEService(eservice);

      expect(
        catalogService.updateEServiceDescription(
          eservice.id,
          "eservice new description",
          {
            authData: getMockAuthData(eservice.producerId),
            correlationId: "",
            serviceName: "",
            logger: genericLogger,
          }
        )
      ).rejects.toThrowError(eserviceWithoutValidDescriptors(eservice.id));
    }
  );
});
