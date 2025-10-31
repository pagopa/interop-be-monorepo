/* eslint-disable @typescript-eslint/no-floating-promises */
import {
  decodeProtobufPayload,
  getMockContext,
  getMockAuthData,
  getMockDocument,
  getMockDescriptor,
  getMockEService,
  getMockDelegation,
} from "pagopa-interop-commons-test";
import {
  Descriptor,
  descriptorState,
  EService,
  toEServiceV2,
  EServiceSignalHubEnabledV2,
  EServiceSignalHubDisabledV2,
  operationForbidden,
  delegationState,
  delegationKind,
} from "pagopa-interop-models";
import { expect, describe, it } from "vitest";
import {
  addOneDelegation,
  addOneEService,
  catalogService,
  readLastEserviceEvent,
} from "../integrationUtils.js";
import {
  eServiceNotFound,
  eserviceWithoutValidDescriptors,
} from "../../src/model/domain/errors.js";

describe("update E-service signalhub flag for an already created E-service", async () => {
  it("should write on event-store for the update of the E-service signalhub flag (false->true)", async () => {
    const descriptor: Descriptor = {
      ...getMockDescriptor(descriptorState.published),
      interface: getMockDocument(),
    };

    const eservice: EService = {
      ...getMockEService(),
      descriptors: [descriptor],
    };

    await addOneEService(eservice);
    const newSignalhubFlagValue = true;

    const updateSignalHubReturn =
      await catalogService.updateEServiceSignalHubFlag(
        eservice.id,
        newSignalhubFlagValue,
        getMockContext({ authData: getMockAuthData(eservice.producerId) })
      );

    const expectedEService: EService = {
      ...eservice,
      isSignalHubEnabled: newSignalhubFlagValue,
    };
    const writtenEvent = await readLastEserviceEvent(eservice.id);
    expect(writtenEvent).toMatchObject({
      stream_id: eservice.id,
      version: "1",
      type: "EServiceSignalHubEnabled",
      event_version: 2,
    });

    const writtenPayload = decodeProtobufPayload({
      messageType: EServiceSignalHubEnabledV2,
      payload: writtenEvent.data,
    });

    expect(writtenPayload).toEqual({
      eservice: toEServiceV2(expectedEService),
    });
    expect(updateSignalHubReturn).toEqual({
      data: expectedEService,
      metadata: { version: 1 },
    });
  });

  it("should write on event-store for the update of the E-service signalhub flag (true->false)", async () => {
    const descriptor: Descriptor = {
      ...getMockDescriptor(descriptorState.published),
      interface: getMockDocument(),
    };

    const eservice: EService = {
      ...getMockEService(),
      descriptors: [descriptor],
      isSignalHubEnabled: true,
    };

    await addOneEService(eservice);
    const newSignalhubFlagValue = false;

    const updateSignalHubReturn =
      await catalogService.updateEServiceSignalHubFlag(
        eservice.id,
        newSignalhubFlagValue,
        getMockContext({ authData: getMockAuthData(eservice.producerId) })
      );

    const expectedEService: EService = {
      ...eservice,
      isSignalHubEnabled: newSignalhubFlagValue,
    };
    const writtenEvent = await readLastEserviceEvent(eservice.id);
    expect(writtenEvent).toMatchObject({
      stream_id: eservice.id,
      version: "1",
      type: "EServiceSignalHubDisabled",
      event_version: 2,
    });

    const writtenPayload = decodeProtobufPayload({
      messageType: EServiceSignalHubDisabledV2,
      payload: writtenEvent.data,
    });

    expect(writtenPayload).toEqual({
      eservice: toEServiceV2(expectedEService),
    });
    expect(updateSignalHubReturn).toEqual({
      data: expectedEService,
      metadata: { version: 1 },
    });
  });

  it.each([
    [true, true],
    [false, false],
  ])(
    "should NOT write on event-store for the update of the E-service signalhub flag (%s -> %s)",
    async (oldSignalhubFlagValue, newSignalhubFlagValue) => {
      const descriptor: Descriptor = {
        ...getMockDescriptor(descriptorState.published),
        interface: getMockDocument(),
      };

      const eservice: EService = {
        ...getMockEService(),
        descriptors: [descriptor],
        isSignalHubEnabled: oldSignalhubFlagValue,
      };

      await addOneEService(eservice);

      const updateSignalHubReturn =
        await catalogService.updateEServiceSignalHubFlag(
          eservice.id,
          newSignalhubFlagValue,
          getMockContext({ authData: getMockAuthData(eservice.producerId) })
        );

      const writtenEvent = await readLastEserviceEvent(eservice.id);

      expect(writtenEvent).not.toMatchObject({
        stream_id: eservice.id,
        version: "1",
        type: "EServiceSignalHubEnabled",
        event_version: 2,
      });

      expect(writtenEvent).not.toMatchObject({
        stream_id: eservice.id,
        version: "1",
        type: "EServiceSignalHubDisabled",
        event_version: 2,
      });

      expect(updateSignalHubReturn).toEqual({
        data: eservice,
        metadata: { version: 0 },
      });
    }
  );

  it("should write on event-store for the update of the E-service signalhub flag (false->true) (delegate)", async () => {
    const descriptor: Descriptor = {
      ...getMockDescriptor(descriptorState.published),
      interface: getMockDocument(),
    };

    const eservice: EService = {
      ...getMockEService(),
      descriptors: [descriptor],
    };

    const delegation = getMockDelegation({
      kind: delegationKind.delegatedProducer,
      eserviceId: eservice.id,
      state: delegationState.active,
    });

    await addOneEService(eservice);
    await addOneDelegation(delegation);
    const newSignalhubFlagValue = true;

    const updateSignalHubReturn =
      await catalogService.updateEServiceSignalHubFlag(
        eservice.id,
        newSignalhubFlagValue,
        getMockContext({ authData: getMockAuthData(delegation.delegateId) })
      );

    const expectedEService: EService = {
      ...eservice,
      isSignalHubEnabled: newSignalhubFlagValue,
    };

    const writtenEvent = await readLastEserviceEvent(eservice.id);
    expect(writtenEvent).toMatchObject({
      stream_id: eservice.id,
      version: "1",
      type: "EServiceSignalHubEnabled",
      event_version: 2,
    });

    const writtenPayload = decodeProtobufPayload({
      messageType: EServiceSignalHubEnabledV2,
      payload: writtenEvent.data,
    });

    expect(writtenPayload).toEqual({
      eservice: toEServiceV2(expectedEService),
    });
    expect(updateSignalHubReturn).toEqual({
      data: expectedEService,
      metadata: { version: 1 },
    });
  });

  it.each([true, false])(
    "should throw eServiceNotFound if the eservice doesn't exist (with signalhub flag set to %s)",
    async (signalhubFlag) => {
      const eservice = getMockEService();
      expect(
        catalogService.updateEServiceSignalHubFlag(
          eservice.id,
          signalhubFlag,
          getMockContext({ authData: getMockAuthData(eservice.producerId) })
        )
      ).rejects.toThrowError(eServiceNotFound(eservice.id));
    }
  );

  it.each([true, false])(
    "should throw operationForbidden if the requester is not the producer (with signalhub flag set to %s)",
    async (signalhubFlag) => {
      const eservice = getMockEService();
      await addOneEService(eservice);
      expect(
        catalogService.updateEServiceSignalHubFlag(
          eservice.id,
          signalhubFlag,
          getMockContext({})
        )
      ).rejects.toThrowError(operationForbidden);
    }
  );

  it.each([true, false])(
    "should throw eserviceWithoutValidDescriptors if the eservice doesn't have any descriptors (with signalhub flag set to %s)",
    async (signalhubFlag) => {
      const eservice: EService = {
        ...getMockEService(),
        isSignalHubEnabled: signalhubFlag,
      };

      await addOneEService(eservice);
      expect(
        catalogService.updateEServiceSignalHubFlag(
          eservice.id,
          signalhubFlag,
          getMockContext({ authData: getMockAuthData(eservice.producerId) })
        )
      ).rejects.toThrowError(eserviceWithoutValidDescriptors(eservice.id));
    }
  );
});
