/* eslint-disable @typescript-eslint/no-floating-promises */
import {
  decodeProtobufPayload,
  getMockContext,
  getMockDelegation,
  getMockAuthData,
  getMockDocument,
  getMockDescriptor,
  getMockEService,
  readEventByStreamIdAndVersion,
} from "pagopa-interop-commons-test";
import {
  Descriptor,
  descriptorState,
  EService,
  toEServiceV2,
  operationForbidden,
  delegationState,
  delegationKind,
  EServiceIsConsumerDelegableEnabledV2,
  EServiceIsClientAccessDelegableEnabledV2,
  EServiceIsConsumerDelegableDisabledV2,
  EServiceIsClientAccessDelegableDisabledV2,
} from "pagopa-interop-models";
import { expect, describe, it } from "vitest";
import {
  eserviceWithoutValidDescriptors,
  eServiceNotFound,
  invalidDelegationFlags,
} from "../../src/model/domain/errors.js";
import {
  addOneEService,
  catalogService,
  postgresDB,
  readLastEserviceEvent,
  addOneDelegation,
} from "../integrationUtils.js";

describe("update eService flags", () => {
  it("should write on event-store for the update of the eService isConsumerDelegable flag (false -> true)", async () => {
    const descriptor: Descriptor = {
      ...getMockDescriptor(descriptorState.published),
      interface: getMockDocument(),
    };
    const eservice: EService = {
      ...getMockEService(),
      descriptors: [descriptor],
      isConsumerDelegable: false,
    };
    await addOneEService(eservice);

    const returnedEService = await catalogService.updateEServiceDelegationFlags(
      eservice.id,
      {
        isConsumerDelegable: true,
        isClientAccessDelegable: false,
      },
      getMockContext({ authData: getMockAuthData(eservice.producerId) })
    );

    const expectedEService: EService = {
      ...eservice,
      isConsumerDelegable: true,
      isClientAccessDelegable: false,
    };

    const writtenEvent = await readLastEserviceEvent(eservice.id);
    expect(writtenEvent).toMatchObject({
      stream_id: eservice.id,
      version: "1",
      type: "EServiceIsConsumerDelegableEnabled",
      event_version: 2,
    });
    const writtenPayload = decodeProtobufPayload({
      messageType: EServiceIsConsumerDelegableEnabledV2,
      payload: writtenEvent.data,
    });

    expect(writtenPayload).toEqual({
      eservice: toEServiceV2(expectedEService),
    });
    expect(returnedEService).toEqual({
      data: expectedEService,
      metadata: { version: 1 },
    });
  });
  it("should write on event-store for the update of the eService isConsumerDelegable flag (true -> false)", async () => {
    const descriptor: Descriptor = {
      ...getMockDescriptor(descriptorState.published),
      interface: getMockDocument(),
    };
    const eservice: EService = {
      ...getMockEService(),
      descriptors: [descriptor],
      isConsumerDelegable: true,
    };
    await addOneEService(eservice);

    const returnedEService = await catalogService.updateEServiceDelegationFlags(
      eservice.id,
      {
        isConsumerDelegable: false,
        isClientAccessDelegable: false,
      },
      getMockContext({ authData: getMockAuthData(eservice.producerId) })
    );

    const expectedEService: EService = {
      ...eservice,
      isConsumerDelegable: false,
      isClientAccessDelegable: false,
    };

    const writtenEvent = await readLastEserviceEvent(eservice.id);
    expect(writtenEvent).toMatchObject({
      stream_id: eservice.id,
      version: "1",
      type: "EServiceIsConsumerDelegableDisabled",
      event_version: 2,
    });
    const writtenPayload = decodeProtobufPayload({
      messageType: EServiceIsConsumerDelegableDisabledV2,
      payload: writtenEvent.data,
    });

    expect(writtenPayload).toEqual({
      eservice: toEServiceV2(expectedEService),
    });
    expect(returnedEService).toEqual({
      data: expectedEService,
      metadata: { version: 1 },
    });
  });
  it("should write on event-store for the update of the eService isClientAccessDelegable flag (false -> true)", async () => {
    const descriptor: Descriptor = {
      ...getMockDescriptor(descriptorState.published),
      interface: getMockDocument(),
    };
    const eservice: EService = {
      ...getMockEService(),
      descriptors: [descriptor],
      isConsumerDelegable: true,
      isClientAccessDelegable: false,
    };
    await addOneEService(eservice);

    const returnedEService = await catalogService.updateEServiceDelegationFlags(
      eservice.id,
      {
        isConsumerDelegable: true,
        isClientAccessDelegable: true,
      },
      getMockContext({ authData: getMockAuthData(eservice.producerId) })
    );

    const expectedEService: EService = {
      ...eservice,
      isConsumerDelegable: true,
      isClientAccessDelegable: true,
    };

    const writtenEvent = await readLastEserviceEvent(eservice.id);
    expect(writtenEvent).toMatchObject({
      stream_id: eservice.id,
      version: "1",
      type: "EServiceIsClientAccessDelegableEnabled",
      event_version: 2,
    });
    const writtenPayload = decodeProtobufPayload({
      messageType: EServiceIsClientAccessDelegableEnabledV2,
      payload: writtenEvent.data,
    });

    expect(writtenPayload).toEqual({
      eservice: toEServiceV2(expectedEService),
    });
    expect(returnedEService).toEqual({
      data: expectedEService,
      metadata: { version: 1 },
    });
  });
  it("should write on event-store for the update of the eService isClientAccessDelegable flag (true -> false)", async () => {
    const descriptor: Descriptor = {
      ...getMockDescriptor(descriptorState.published),
      interface: getMockDocument(),
    };
    const eservice: EService = {
      ...getMockEService(),
      descriptors: [descriptor],
      isConsumerDelegable: true,
      isClientAccessDelegable: true,
    };
    await addOneEService(eservice);

    const returnedEService = await catalogService.updateEServiceDelegationFlags(
      eservice.id,
      {
        isConsumerDelegable: true,
        isClientAccessDelegable: false,
      },
      getMockContext({ authData: getMockAuthData(eservice.producerId) })
    );

    const expectedEService: EService = {
      ...eservice,
      isConsumerDelegable: true,
      isClientAccessDelegable: false,
    };

    const writtenEvent = await readLastEserviceEvent(eservice.id);
    expect(writtenEvent).toMatchObject({
      stream_id: eservice.id,
      version: "1",
      type: "EServiceIsClientAccessDelegableDisabled",
      event_version: 2,
    });
    const writtenPayload = decodeProtobufPayload({
      messageType: EServiceIsClientAccessDelegableDisabledV2,
      payload: writtenEvent.data,
    });

    expect(writtenPayload).toEqual({
      eservice: toEServiceV2(expectedEService),
    });
    expect(returnedEService).toEqual({
      data: expectedEService,
      metadata: { version: 1 },
    });
  });
  it("should write TWO events on event-store when both flags are updated simultaneously (false, false -> true, true)", async () => {
    const descriptor: Descriptor = {
      ...getMockDescriptor(descriptorState.published),
      interface: getMockDocument(),
    };
    const eservice: EService = {
      ...getMockEService(),
      descriptors: [descriptor],
      isConsumerDelegable: false,
      isClientAccessDelegable: false,
    };
    await addOneEService(eservice);

    const returnedEService = await catalogService.updateEServiceDelegationFlags(
      eservice.id,
      {
        isConsumerDelegable: true,
        isClientAccessDelegable: true,
      },
      getMockContext({ authData: getMockAuthData(eservice.producerId) })
    );

    const expectedEService: EService = {
      ...eservice,
      isConsumerDelegable: true,
      isClientAccessDelegable: true,
    };

    const firstEvent = await readEventByStreamIdAndVersion(
      eservice.id,
      1,
      "catalog",
      postgresDB
    );
    expect(firstEvent).toMatchObject({
      stream_id: eservice.id,
      version: "1",
      type: "EServiceIsConsumerDelegableEnabled",
      event_version: 2,
    });
    const firstPayload = decodeProtobufPayload({
      messageType: EServiceIsConsumerDelegableEnabledV2,
      payload: firstEvent.data,
    });
    expect(firstPayload).toEqual({
      eservice: toEServiceV2(expectedEService),
    });

    const secondEvent = await readLastEserviceEvent(eservice.id);
    expect(secondEvent).toMatchObject({
      stream_id: eservice.id,
      version: "2",
      type: "EServiceIsClientAccessDelegableEnabled",
      event_version: 2,
    });
    const secondPayload = decodeProtobufPayload({
      messageType: EServiceIsClientAccessDelegableEnabledV2,
      payload: secondEvent.data,
    });
    expect(secondPayload).toEqual({
      eservice: toEServiceV2(expectedEService),
    });

    expect(returnedEService).toEqual({
      data: expectedEService,
      metadata: { version: 2 },
    });
  });
  it("should write TWO events on event-store when disabling consumer delegable while client access was enabled (true, true -> false, false)", async () => {
    const descriptor: Descriptor = {
      ...getMockDescriptor(descriptorState.published),
      interface: getMockDocument(),
    };
    const eservice: EService = {
      ...getMockEService(),
      descriptors: [descriptor],
      isConsumerDelegable: true,
      isClientAccessDelegable: true,
    };
    await addOneEService(eservice);

    const returnedEService = await catalogService.updateEServiceDelegationFlags(
      eservice.id,
      {
        isConsumerDelegable: false,
        isClientAccessDelegable: false,
      },
      getMockContext({ authData: getMockAuthData(eservice.producerId) })
    );

    const expectedEService: EService = {
      ...eservice,
      isConsumerDelegable: false,
      isClientAccessDelegable: false,
    };

    const firstEvent = await readEventByStreamIdAndVersion(
      eservice.id,
      1,
      "catalog",
      postgresDB
    );
    expect(firstEvent).toMatchObject({
      stream_id: eservice.id,
      version: "1",
      type: "EServiceIsConsumerDelegableDisabled",
      event_version: 2,
    });
    const firstPayload = decodeProtobufPayload({
      messageType: EServiceIsConsumerDelegableDisabledV2,
      payload: firstEvent.data,
    });
    expect(firstPayload).toEqual({
      eservice: toEServiceV2(expectedEService),
    });

    const secondEvent = await readLastEserviceEvent(eservice.id);
    expect(secondEvent).toMatchObject({
      stream_id: eservice.id,
      version: "2",
      type: "EServiceIsClientAccessDelegableDisabled",
      event_version: 2,
    });
    const secondPayload = decodeProtobufPayload({
      messageType: EServiceIsClientAccessDelegableDisabledV2,
      payload: secondEvent.data,
    });
    expect(secondPayload).toEqual({
      eservice: toEServiceV2(expectedEService),
    });

    expect(returnedEService).toEqual({
      data: expectedEService,
      metadata: { version: 2 },
    });
  });
  it("should allow the delegate producer to update delegation flags (delegate happy path)", async () => {
    const descriptor: Descriptor = {
      ...getMockDescriptor(descriptorState.published),
      interface: getMockDocument(),
    };
    const eservice: EService = {
      ...getMockEService(),
      descriptors: [descriptor],
      isConsumerDelegable: false,
    };
    const delegation = getMockDelegation({
      kind: delegationKind.delegatedProducer,
      eserviceId: eservice.id,
      state: delegationState.active,
    });

    await addOneEService(eservice);
    await addOneDelegation(delegation);

    const returnedEService = await catalogService.updateEServiceDelegationFlags(
      eservice.id,
      {
        isConsumerDelegable: true,
        isClientAccessDelegable: false,
      },
      getMockContext({ authData: getMockAuthData(delegation.delegateId) })
    );

    const expectedEService: EService = {
      ...eservice,
      isConsumerDelegable: true,
      isClientAccessDelegable: false,
    };

    const writtenEvent = await readLastEserviceEvent(eservice.id);
    expect(writtenEvent).toMatchObject({
      stream_id: eservice.id,
      version: "1",
      type: "EServiceIsConsumerDelegableEnabled",
      event_version: 2,
    });
    const writtenPayload = decodeProtobufPayload({
      messageType: EServiceIsConsumerDelegableEnabledV2,
      payload: writtenEvent.data,
    });
    expect(writtenPayload).toEqual({
      eservice: toEServiceV2(expectedEService),
    });
    expect(returnedEService).toEqual({
      data: expectedEService,
      metadata: { version: 1 },
    });
  });
  it("should not produce any event when delegation flags are unchanged (idempotency)", async () => {
    const descriptor: Descriptor = {
      ...getMockDescriptor(descriptorState.published),
      interface: getMockDocument(),
    };
    const eservice: EService = {
      ...getMockEService(),
      descriptors: [descriptor],
      isConsumerDelegable: true,
      isClientAccessDelegable: false,
    };
    await addOneEService(eservice);

    const returnedEService = await catalogService.updateEServiceDelegationFlags(
      eservice.id,
      {
        isConsumerDelegable: true,
        isClientAccessDelegable: false,
      },
      getMockContext({ authData: getMockAuthData(eservice.producerId) })
    );

    const writtenEvent = await readLastEserviceEvent(eservice.id);
    // The only event should be the initial EServiceAdded from addOneEService (version 0)
    expect(writtenEvent).toMatchObject({
      stream_id: eservice.id,
      version: "0",
      type: "EServiceAdded",
    });

    expect(returnedEService).toEqual({
      data: eservice,
      metadata: { version: 0 },
    });
  });
  it("should throw eServiceNotFound if the eservice doesn't exist", async () => {
    const eservice = getMockEService();

    expect(
      catalogService.updateEServiceDelegationFlags(
        eservice.id,
        {
          isConsumerDelegable: true,
          isClientAccessDelegable: false,
        },
        getMockContext({ authData: getMockAuthData(eservice.producerId) })
      )
    ).rejects.toThrowError(eServiceNotFound(eservice.id));
  });
  it("should throw operationForbidden if the requester is not the producer", async () => {
    const eservice = getMockEService();
    await addOneEService(eservice);

    expect(
      catalogService.updateEServiceDelegationFlags(
        eservice.id,
        {
          isConsumerDelegable: true,
          isClientAccessDelegable: false,
        },
        getMockContext({})
      )
    ).rejects.toThrowError(operationForbidden);
  });
  it("should throw operationForbidden if the requester if the given e-service has been delegated and caller is not the delegate", async () => {
    const eservice = getMockEService();
    const delegation = getMockDelegation({
      kind: delegationKind.delegatedProducer,
      eserviceId: eservice.id,
      state: delegationState.active,
    });

    await addOneEService(eservice);
    await addOneDelegation(delegation);

    expect(
      catalogService.updateEServiceDelegationFlags(
        eservice.id,
        {
          isConsumerDelegable: true,
          isClientAccessDelegable: false,
        },
        getMockContext({ authData: getMockAuthData(eservice.producerId) })
      )
    ).rejects.toThrowError(operationForbidden);
  });
  it("should throw eserviceWithoutValidDescriptors if the eservice doesn't have any descriptors", async () => {
    const eservice = getMockEService();
    await addOneEService(eservice);

    expect(
      catalogService.updateEServiceDelegationFlags(
        eservice.id,
        {
          isConsumerDelegable: true,
          isClientAccessDelegable: false,
        },
        getMockContext({ authData: getMockAuthData(eservice.producerId) })
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
        catalogService.updateEServiceDelegationFlags(
          eservice.id,
          {
            isConsumerDelegable: true,
            isClientAccessDelegable: false,
          },
          getMockContext({ authData: getMockAuthData(eservice.producerId) })
        )
      ).rejects.toThrowError(eserviceWithoutValidDescriptors(eservice.id));
    }
  );
  it("should throw invalidDelegationFlags if the isConsumerDelegable is false and isClientAccessDelegable is true", async () => {
    const descriptor: Descriptor = {
      ...getMockDescriptor(descriptorState.published),
      interface: getMockDocument(),
    };
    const eservice: EService = {
      ...getMockEService(),
      descriptors: [descriptor],
      isConsumerDelegable: false,
    };
    await addOneEService(eservice);

    expect(
      catalogService.updateEServiceDelegationFlags(
        eservice.id,
        {
          isConsumerDelegable: false,
          isClientAccessDelegable: true,
        },
        getMockContext({ authData: getMockAuthData(eservice.producerId) })
      )
    ).rejects.toThrowError(invalidDelegationFlags(false, true));
  });
});
