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
import { eServiceNotFound } from "../../src/model/domain/errors.js";

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

    const returnedEService = await catalogService.updateSignalHubFlag(
      eservice.id,
      newSignalhubFlagValue,
      getMockContext({ authData: getMockAuthData(eservice.producerId) })
    );

    const updatedEservice: EService = {
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

    expect(writtenPayload.eservice).toEqual(toEServiceV2(updatedEservice));
    expect(writtenPayload.eservice).toEqual(toEServiceV2(returnedEService));
  });

  it("should write on event-store for the update of the E-service signalhub flag (true->false)", async () => {
    const descriptor: Descriptor = {
      ...getMockDescriptor(descriptorState.published),
      interface: getMockDocument(),
    };

    const eservice: EService = {
      ...getMockEService(),
      descriptors: [descriptor],
    };

    await addOneEService(eservice);
    const newSignalhubFlagValue = false;

    const returnedEService = await catalogService.updateSignalHubFlag(
      eservice.id,
      newSignalhubFlagValue,
      getMockContext({ authData: getMockAuthData(eservice.producerId) })
    );

    const updatedEservice: EService = {
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

    expect(writtenPayload.eservice).toEqual(toEServiceV2(updatedEservice));
    expect(writtenPayload.eservice).toEqual(toEServiceV2(returnedEService));
  });

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

    const returnedEService = await catalogService.updateSignalHubFlag(
      eservice.id,
      newSignalhubFlagValue,
      getMockContext({ authData: getMockAuthData(delegation.delegateId) })
    );

    const updatedEService: EService = {
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

    expect(writtenPayload.eservice).toEqual(toEServiceV2(updatedEService));
    expect(writtenPayload.eservice).toEqual(toEServiceV2(returnedEService));
  });

  it.each([true, false])(
    "should throw eServiceNotFound if the eservice doesn't exist (with signalhub flag set to %s)",
    async (signalhubFlag) => {
      const eservice = getMockEService();
      expect(
        catalogService.updateSignalHubFlag(
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
        catalogService.updateSignalHubFlag(
          eservice.id,
          signalhubFlag,
          getMockContext({})
        )
      ).rejects.toThrowError(operationForbidden);
    }
  );
});
