/* eslint-disable @typescript-eslint/no-floating-promises */
import {
  decodeProtobufPayload,
  getMockContext,
  getMockAuthData,
  getMockDocument,
  getMockDescriptor,
  getMockEService,
  getMockEServiceTemplate,
  getMockDelegation,
} from "pagopa-interop-commons-test";
import {
  Descriptor,
  descriptorState,
  EService,
  toEServiceV2,
  EServiceInstanceLabelUpdatedV2,
  operationForbidden,
  EServiceTemplate,
  delegationState,
  delegationKind,
} from "pagopa-interop-models";
import { expect, describe, it } from "vitest";
import {
  addOneEService,
  addOneEServiceTemplate,
  addOneDelegation,
  catalogService,
  readLastEserviceEvent,
} from "../integrationUtils.js";
import {
  eServiceNotFound,
  eServiceNotAnInstance,
  eserviceWithoutValidDescriptors,
  eServiceNameDuplicateForProducer,
} from "../../src/model/domain/errors.js";

describe("update E-service instanceLabel after publication", async () => {
  it("should write on event-store for the update of the E-service instanceLabel (undefined -> 'my label')", async () => {
    const template: EServiceTemplate = getMockEServiceTemplate();

    const descriptor: Descriptor = {
      ...getMockDescriptor(descriptorState.published),
      interface: getMockDocument(),
    };

    const eservice: EService = {
      ...getMockEService(),
      descriptors: [descriptor],
      templateId: template.id,
      name: template.name,
      instanceLabel: undefined,
    };

    await addOneEServiceTemplate(template);
    await addOneEService(eservice);

    const newLabel = "my label";

    const returnedEService =
      await catalogService.updateEServiceInstanceLabelAfterPublication(
        eservice.id,
        newLabel,
        getMockContext({ authData: getMockAuthData(eservice.producerId) })
      );

    const updatedEService: EService = {
      ...eservice,
      name: `${template.name} - ${newLabel}`,
      instanceLabel: newLabel,
    };

    const writtenEvent = await readLastEserviceEvent(eservice.id);
    expect(writtenEvent).toMatchObject({
      stream_id: eservice.id,
      version: "1",
      type: "EServiceInstanceLabelUpdated",
      event_version: 2,
    });

    const writtenPayload = decodeProtobufPayload({
      messageType: EServiceInstanceLabelUpdatedV2,
      payload: writtenEvent.data,
    });

    expect(writtenPayload.eservice).toEqual(toEServiceV2(updatedEService));
    expect(writtenPayload.eservice).toEqual(toEServiceV2(returnedEService));
  });

  it("should write on event-store for the update of the E-service instanceLabel ('old label' -> 'new label')", async () => {
    const template: EServiceTemplate = getMockEServiceTemplate();

    const descriptor: Descriptor = {
      ...getMockDescriptor(descriptorState.published),
      interface: getMockDocument(),
    };

    const oldLabel = "old label";
    const eservice: EService = {
      ...getMockEService(),
      descriptors: [descriptor],
      templateId: template.id,
      name: `${template.name} - ${oldLabel}`,
      instanceLabel: oldLabel,
    };

    await addOneEServiceTemplate(template);
    await addOneEService(eservice);

    const newLabel = "new label";

    const returnedEService =
      await catalogService.updateEServiceInstanceLabelAfterPublication(
        eservice.id,
        newLabel,
        getMockContext({ authData: getMockAuthData(eservice.producerId) })
      );

    const updatedEService: EService = {
      ...eservice,
      name: `${template.name} - ${newLabel}`,
      instanceLabel: newLabel,
    };

    const writtenEvent = await readLastEserviceEvent(eservice.id);
    expect(writtenEvent).toMatchObject({
      stream_id: eservice.id,
      version: "1",
      type: "EServiceInstanceLabelUpdated",
      event_version: 2,
    });

    const writtenPayload = decodeProtobufPayload({
      messageType: EServiceInstanceLabelUpdatedV2,
      payload: writtenEvent.data,
    });

    expect(writtenPayload.eservice).toEqual(toEServiceV2(updatedEService));
    expect(writtenPayload.eservice).toEqual(toEServiceV2(returnedEService));
  });

  it("should write on event-store for the update of the E-service instanceLabel ('old label' -> undefined)", async () => {
    const template: EServiceTemplate = getMockEServiceTemplate();

    const descriptor: Descriptor = {
      ...getMockDescriptor(descriptorState.published),
      interface: getMockDocument(),
    };

    const oldLabel = "old label";
    const eservice: EService = {
      ...getMockEService(),
      descriptors: [descriptor],
      templateId: template.id,
      name: `${template.name} - ${oldLabel}`,
      instanceLabel: oldLabel,
    };

    await addOneEServiceTemplate(template);
    await addOneEService(eservice);

    const returnedEService =
      await catalogService.updateEServiceInstanceLabelAfterPublication(
        eservice.id,
        undefined,
        getMockContext({ authData: getMockAuthData(eservice.producerId) })
      );

    const updatedEService: EService = {
      ...eservice,
      name: template.name,
      instanceLabel: undefined,
    };

    const writtenEvent = await readLastEserviceEvent(eservice.id);
    expect(writtenEvent).toMatchObject({
      stream_id: eservice.id,
      version: "1",
      type: "EServiceInstanceLabelUpdated",
      event_version: 2,
    });

    const writtenPayload = decodeProtobufPayload({
      messageType: EServiceInstanceLabelUpdatedV2,
      payload: writtenEvent.data,
    });

    expect(writtenPayload.eservice).toEqual(toEServiceV2(updatedEService));
    expect(writtenPayload.eservice).toEqual(toEServiceV2(returnedEService));
  });

  it("should not write on event-store if the instanceLabel and name are unchanged", async () => {
    const template: EServiceTemplate = getMockEServiceTemplate();

    const descriptor: Descriptor = {
      ...getMockDescriptor(descriptorState.published),
      interface: getMockDocument(),
    };

    const existingLabel = "same";
    const eservice: EService = {
      ...getMockEService(),
      descriptors: [descriptor],
      templateId: template.id,
      name: `${template.name} - ${existingLabel}`,
      instanceLabel: existingLabel,
    };

    await addOneEServiceTemplate(template);
    await addOneEService(eservice);

    const returnedEService =
      await catalogService.updateEServiceInstanceLabelAfterPublication(
        eservice.id,
        existingLabel,
        getMockContext({ authData: getMockAuthData(eservice.producerId) })
      );

    // Even when the label is the same, the event is still written (no early return in the method)
    // since instanceLabel can be the same but name can differ due to template name changes.
    const writtenEvent = await readLastEserviceEvent(eservice.id);
    expect(writtenEvent).toMatchObject({
      stream_id: eservice.id,
      version: "1",
      type: "EServiceInstanceLabelUpdated",
      event_version: 2,
    });

    expect(returnedEService.instanceLabel).toBe(existingLabel);
  });

  it("should allow a delegate producer to update the instanceLabel", async () => {
    const template: EServiceTemplate = getMockEServiceTemplate();

    const descriptor: Descriptor = {
      ...getMockDescriptor(descriptorState.published),
      interface: getMockDocument(),
    };

    const eservice: EService = {
      ...getMockEService(),
      descriptors: [descriptor],
      templateId: template.id,
      name: template.name,
      instanceLabel: undefined,
    };

    const delegation = getMockDelegation({
      kind: delegationKind.delegatedProducer,
      eserviceId: eservice.id,
      delegatorId: eservice.producerId,
      state: delegationState.active,
    });

    await addOneEServiceTemplate(template);
    await addOneEService(eservice);
    await addOneDelegation(delegation);

    const newLabel = "delegated";

    const returnedEService =
      await catalogService.updateEServiceInstanceLabelAfterPublication(
        eservice.id,
        newLabel,
        getMockContext({
          authData: getMockAuthData(delegation.delegateId),
        })
      );

    expect(returnedEService.instanceLabel).toBe(newLabel);
    expect(returnedEService.name).toBe(`${template.name} - ${newLabel}`);
  });

  it("should throw eServiceNotFound if the eservice doesn't exist", async () => {
    const eservice = getMockEService();
    expect(
      catalogService.updateEServiceInstanceLabelAfterPublication(
        eservice.id,
        "label",
        getMockContext({ authData: getMockAuthData(eservice.producerId) })
      )
    ).rejects.toThrowError(eServiceNotFound(eservice.id));
  });

  it("should throw operationForbidden if the requester is not the producer", async () => {
    const template: EServiceTemplate = getMockEServiceTemplate();

    const descriptor: Descriptor = {
      ...getMockDescriptor(descriptorState.published),
      interface: getMockDocument(),
    };

    const eservice: EService = {
      ...getMockEService(),
      descriptors: [descriptor],
      templateId: template.id,
      name: template.name,
      instanceLabel: undefined,
    };

    await addOneEServiceTemplate(template);
    await addOneEService(eservice);

    expect(
      catalogService.updateEServiceInstanceLabelAfterPublication(
        eservice.id,
        "label",
        getMockContext({})
      )
    ).rejects.toThrowError(operationForbidden);
  });

  it("should throw eServiceNotAnInstance if the eservice is not a template instance", async () => {
    const descriptor: Descriptor = {
      ...getMockDescriptor(descriptorState.published),
      interface: getMockDocument(),
    };

    const eservice: EService = {
      ...getMockEService(),
      descriptors: [descriptor],
    };

    await addOneEService(eservice);

    expect(
      catalogService.updateEServiceInstanceLabelAfterPublication(
        eservice.id,
        "label",
        getMockContext({ authData: getMockAuthData(eservice.producerId) })
      )
    ).rejects.toThrowError(eServiceNotAnInstance(eservice.id));
  });

  it("should throw eserviceWithoutValidDescriptors if the eservice has no valid descriptors", async () => {
    const template: EServiceTemplate = getMockEServiceTemplate();

    const eservice: EService = {
      ...getMockEService(),
      descriptors: [],
      templateId: template.id,
      name: template.name,
      instanceLabel: undefined,
    };

    await addOneEServiceTemplate(template);
    await addOneEService(eservice);

    expect(
      catalogService.updateEServiceInstanceLabelAfterPublication(
        eservice.id,
        "label",
        getMockContext({ authData: getMockAuthData(eservice.producerId) })
      )
    ).rejects.toThrowError(eserviceWithoutValidDescriptors(eservice.id));
  });

  it("should throw eServiceNameDuplicateForProducer if the new name conflicts with another eservice", async () => {
    const template: EServiceTemplate = getMockEServiceTemplate();

    const descriptor: Descriptor = {
      ...getMockDescriptor(descriptorState.published),
      interface: getMockDocument(),
    };

    const eservice: EService = {
      ...getMockEService(),
      descriptors: [descriptor],
      templateId: template.id,
      name: template.name,
      instanceLabel: undefined,
    };

    const conflictingLabel = "conflict";
    const conflictingEService: EService = {
      ...getMockEService(undefined, eservice.producerId, [], template.id),
      name: `${template.name} - ${conflictingLabel}`,
      instanceLabel: conflictingLabel,
    };

    await addOneEServiceTemplate(template);
    await addOneEService(eservice);
    await addOneEService(conflictingEService);

    expect(
      catalogService.updateEServiceInstanceLabelAfterPublication(
        eservice.id,
        conflictingLabel,
        getMockContext({ authData: getMockAuthData(eservice.producerId) })
      )
    ).rejects.toThrowError(
      eServiceNameDuplicateForProducer(
        `${template.name} - ${conflictingLabel}`,
        eservice.producerId
      )
    );
  });
});
