/* eslint-disable @typescript-eslint/no-floating-promises */
import {
  decodeProtobufPayload,
  getMockContext,
  getMockDelegation,
  getMockAuthData,
} from "pagopa-interop-commons-test";
import {
  Descriptor,
  descriptorState,
  EService,
  toEServiceV2,
  operationForbidden,
  generateId,
  EServiceNameUpdatedV2,
  TenantId,
  delegationKind,
  delegationState,
  EServiceTemplateId,
  unsafeBrandId,
} from "pagopa-interop-models";
import { expect, describe, it } from "vitest";
import {
  eserviceWithoutValidDescriptors,
  eServiceNotFound,
  eServiceNameDuplicate,
  templateInstanceNotAllowed,
} from "../src/model/domain/errors.js";
import {
  addOneEService,
  catalogService,
  readLastEserviceEvent,
  getMockDocument,
  getMockDescriptor,
  getMockEService,
  addOneDelegation,
} from "./utils.js";
describe("update eService name on published eservice", () => {
  it("should write on event-store for the update of the eService name", async () => {
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
    const returnedEService = await catalogService.updateEServiceName(
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
      type: "EServiceNameUpdated",
      event_version: 2,
    });
    const writtenPayload = decodeProtobufPayload({
      messageType: EServiceNameUpdatedV2,
      payload: writtenEvent.data,
    });
    expect(writtenPayload.eservice).toEqual(toEServiceV2(updatedEService));
    expect(writtenPayload.eservice).toEqual(toEServiceV2(returnedEService));
  });
  it("should write on event-store for the update of the eService name (delegate)", async () => {
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
    const updatedName = "eservice new name";
    const returnedEService = await catalogService.updateEServiceName(
      eservice.id,
      updatedName,
      getMockContext({ authData: getMockAuthData(delegation.delegateId) })
    );
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
    expect(writtenPayload.eservice).toEqual(toEServiceV2(returnedEService));
  });
  it("should throw eServiceNotFound if the eservice doesn't exist", async () => {
    const eservice = getMockEService();
    expect(
      catalogService.updateEServiceName(
        eservice.id,
        "eservice new name",
        getMockContext({ authData: getMockAuthData(eservice.producerId) })
      )
    ).rejects.toThrowError(eServiceNotFound(eservice.id));
  });
  it("should throw operationForbidden if the requester is not the producer", async () => {
    const eservice = getMockEService();
    await addOneEService(eservice);
    expect(
      catalogService.updateEServiceName(
        eservice.id,
        "eservice new name",
        getMockContext({})
      )
    ).rejects.toThrowError(operationForbidden);
  });
  it("should throw operationForbidden if the given e-service has been delegated and the requester is not the delegate", async () => {
    const eservice = getMockEService();
    const delegation = getMockDelegation({
      kind: delegationKind.delegatedProducer,
      eserviceId: eservice.id,
      state: delegationState.active,
    });
    await addOneEService(eservice);
    await addOneDelegation(delegation);
    expect(
      catalogService.updateEServiceName(
        eservice.id,
        "eservice new name",
        getMockContext({ authData: getMockAuthData(eservice.producerId) })
      )
    ).rejects.toThrowError(operationForbidden);
  });
  it("should throw eserviceWithoutValidDescriptors if the eservice doesn't have any descriptors", async () => {
    const eservice = getMockEService();
    await addOneEService(eservice);
    expect(
      catalogService.updateEServiceName(
        eservice.id,
        "eservice new name",
        getMockContext({ authData: getMockAuthData(eservice.producerId) })
      )
    ).rejects.toThrowError(eserviceWithoutValidDescriptors(eservice.id));
  });
  it.each([descriptorState.draft, descriptorState.archived])(
    "should throw eserviceWithoutValidDescriptors if the eservice has only draft or archived descriptors",
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
        catalogService.updateEServiceName(
          eservice.id,
          "eservice new name",
          getMockContext({ authData: getMockAuthData(eservice.producerId) })
        )
      ).rejects.toThrowError(eserviceWithoutValidDescriptors(eservice.id));
    }
  );
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
    expect(
      catalogService.updateEServiceName(
        eservice.id,
        updatedName,
        getMockContext({ authData: getMockAuthData(eservice.producerId) })
      )
    ).rejects.toThrowError(eServiceNameDuplicate(duplicateName));
  });
  it("should throw templateInstanceNotAllowed if the templateId is defined", async () => {
    const templateId = unsafeBrandId<EServiceTemplateId>(generateId());
    const descriptor: Descriptor = {
      ...getMockDescriptor(descriptorState.published),
      interface: getMockDocument(),
    };
    const eService: EService = {
      ...getMockEService(),
      descriptors: [descriptor],
      templateRef: { id: templateId },
    };
    await addOneEService(eService);
    expect(
      catalogService.updateEServiceName(
        eService.id,
        "eservice new name",
        getMockContext({ authData: getMockAuthData(eService.producerId) })
      )
    ).rejects.toThrowError(templateInstanceNotAllowed(eService.id, templateId));
  });
});
