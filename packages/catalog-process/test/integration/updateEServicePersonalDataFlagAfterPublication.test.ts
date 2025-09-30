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
  EServicePersonalDataFlagUpdatedAfterPublicationV2,
  operationForbidden,
} from "pagopa-interop-models";
import { expect, describe, it } from "vitest";
import {
  addOneEService,
  catalogService,
  readLastEserviceEvent,
} from "../integrationUtils.js";
import {
  eServiceNotFound,
  eservicePersonalDataFlagCanOnlyBeSetOnce,
  eserviceWithoutValidDescriptors,
} from "../../src/model/domain/errors.js";

describe("update E-service personalData flag for an already created E-service", async () => {
  it("should write on event-store for the update of the E-service personalData flag (undefined -> true)", async () => {
    const descriptor: Descriptor = {
      ...getMockDescriptor(descriptorState.published),
      interface: getMockDocument(),
    };

    const eservice: EService = {
      ...getMockEService(),
      descriptors: [descriptor],
    };

    await addOneEService(eservice);
    const newPersonalDataValue = true;

    const returnedEService =
      await catalogService.updateEServicePersonalDataFlagAfterPublication(
        eservice.id,
        newPersonalDataValue,
        getMockContext({ authData: getMockAuthData(eservice.producerId) })
      );

    const updatedEService: EService = {
      ...eservice,
      personalData: newPersonalDataValue,
    };

    const writtenEvent = await readLastEserviceEvent(eservice.id);
    expect(writtenEvent).toMatchObject({
      stream_id: eservice.id,
      version: "1",
      type: "EServicePersonalDataFlagUpdatedAfterPublication",
      event_version: 2,
    });

    const writtenPayload = decodeProtobufPayload({
      messageType: EServicePersonalDataFlagUpdatedAfterPublicationV2,
      payload: writtenEvent.data,
    });

    expect(writtenPayload.eservice).toEqual(toEServiceV2(updatedEService));
    expect(writtenPayload.eservice).toEqual(toEServiceV2(returnedEService));
  });

  it.each([
    [true, true],
    [false, false],
  ])(
    "should NOT write on event-store for the update of the E-service personalData flag if it was already set (%s -> %s)",
    async (oldPersonalDataValue, newPersonalDataValue) => {
      const descriptor: Descriptor = {
        ...getMockDescriptor(descriptorState.published),
        interface: getMockDocument(),
      };

      const eservice: EService = {
        ...getMockEService(),
        descriptors: [descriptor],
        personalData: oldPersonalDataValue,
      };

      await addOneEService(eservice);

      await expect(
        catalogService.updateEServicePersonalDataFlagAfterPublication(
          eservice.id,
          newPersonalDataValue,
          getMockContext({ authData: getMockAuthData(eservice.producerId) })
        )
      ).rejects.toThrowError(
        eservicePersonalDataFlagCanOnlyBeSetOnce(eservice.id)
      );
    }
  );

  it.each([true, false])(
    "should throw eServiceNotFound if the eservice doesn't exist (with personalData flag set to %s)",
    async (personalDataFlag) => {
      const eservice = getMockEService();
      expect(
        catalogService.updateEServicePersonalDataFlagAfterPublication(
          eservice.id,
          personalDataFlag,
          getMockContext({ authData: getMockAuthData(eservice.producerId) })
        )
      ).rejects.toThrowError(eServiceNotFound(eservice.id));
    }
  );

  it.each([true, false])(
    "should throw operationForbidden if the requester is not the producer (with personalData flag set to %s)",
    async (personalDataFlag) => {
      const eservice = getMockEService();
      await addOneEService(eservice);
      expect(
        catalogService.updateEServicePersonalDataFlagAfterPublication(
          eservice.id,
          personalDataFlag,
          getMockContext({})
        )
      ).rejects.toThrowError(operationForbidden);
    }
  );

  it.each([true, false])(
    "should throw eserviceWithoutValidDescriptors if the eservice doesn't have any descriptors (with personalData flag set to %s)",
    async (personalDataFlag) => {
      const eservice: EService = {
        ...getMockEService(),
        personalData: personalDataFlag,
      };

      await addOneEService(eservice);
      expect(
        catalogService.updateEServicePersonalDataFlagAfterPublication(
          eservice.id,
          personalDataFlag,
          getMockContext({ authData: getMockAuthData(eservice.producerId) })
        )
      ).rejects.toThrowError(eserviceWithoutValidDescriptors(eservice.id));
    }
  );
});
