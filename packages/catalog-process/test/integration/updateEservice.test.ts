/* eslint-disable @typescript-eslint/no-floating-promises */
import { genericLogger, fileManagerDeleteError } from "pagopa-interop-commons";
import {
  decodeProtobufPayload,
  getMockContext,
  getMockDelegation,
  getMockValidRiskAnalysis,
  getMockAuthData,
  randomArrayItem,
  getMockDocument,
  getMockDescriptor,
  getMockEService,
  getMockEServiceTemplate,
} from "pagopa-interop-commons-test";
import {
  Descriptor,
  descriptorState,
  EService,
  DraftEServiceUpdatedV2,
  toEServiceV2,
  eserviceMode,
  operationForbidden,
  generateId,
  delegationState,
  delegationKind,
  EServiceTemplateId,
  EServiceTemplate,
} from "pagopa-interop-models";
import { vi, expect, describe, it } from "vitest";
import { match } from "ts-pattern";
import {
  eServiceNotFound,
  eServiceNameDuplicateForProducer,
  eserviceNotInDraftState,
  templateInstanceNotAllowed,
  eserviceTemplateNameConflict,
} from "../../src/model/domain/errors.js";
import { config } from "../../src/config/config.js";
import {
  fileManager,
  addOneEService,
  catalogService,
  readLastEserviceEvent,
  addOneDelegation,
  addOneEServiceTemplate,
} from "../integrationUtils.js";

describe("update eService", () => {
  const mockEService = getMockEService();
  const mockDocument = getMockDocument();
  it("should write on event-store for the update of an eService (no technology change)", async () => {
    vi.spyOn(fileManager, "delete");

    const isSignalHubEnabled = randomArrayItem([false, true, undefined]);
    const isConsumerDelegable = randomArrayItem([false, true, undefined]);
    const isClientAccessDelegable = match(isConsumerDelegable)
      .with(undefined, () => undefined)
      .with(true, () => randomArrayItem([false, true, undefined]))
      .with(false, () => false)
      .exhaustive();
    const personalData = randomArrayItem([false, true]);

    const descriptor: Descriptor = {
      ...getMockDescriptor(),
      state: descriptorState.draft,
      interface: mockDocument,
    };
    const eservice: EService = {
      ...mockEService,
      descriptors: [descriptor],
      isSignalHubEnabled,
    };
    const updatedName = "eservice new name";
    await addOneEService(eservice);
    const updateEServiceReturn = await catalogService.updateEService(
      mockEService.id,
      {
        name: updatedName,
        description: mockEService.description,
        technology: "REST",
        mode: "DELIVER",
        isSignalHubEnabled,
        isConsumerDelegable,
        isClientAccessDelegable,
        personalData,
      },
      getMockContext({ authData: getMockAuthData(mockEService.producerId) })
    );

    const expectedEService: EService = {
      ...eservice,
      name: updatedName,
      isSignalHubEnabled,
      isConsumerDelegable,
      isClientAccessDelegable,
      personalData,
    };

    const writtenEvent = await readLastEserviceEvent(mockEService.id);
    expect(writtenEvent.stream_id).toBe(mockEService.id);
    expect(writtenEvent.version).toBe("1");
    expect(writtenEvent.type).toBe("DraftEServiceUpdated");
    expect(writtenEvent.event_version).toBe(2);
    const writtenPayload = decodeProtobufPayload({
      messageType: DraftEServiceUpdatedV2,
      payload: writtenEvent.data,
    });

    expect(writtenPayload.eservice).toEqual(toEServiceV2(expectedEService));
    expect(updateEServiceReturn).toEqual({
      data: expectedEService,
      metadata: { version: 1 },
    });
    expect(fileManager.delete).not.toHaveBeenCalled();
  });

  it("should update an eservice correctly handling isClientAccessDelegable when isConsumerDelegable is not true", async () => {
    vi.spyOn(fileManager, "delete");

    const isSignalHubEnabled = randomArrayItem([false, true, undefined]);
    const isConsumerDelegable: false | undefined = randomArrayItem([
      false,
      undefined,
    ]);
    const isClientAccessDelegable = randomArrayItem([false, true, undefined]);
    const expectedIsClientAccessDelegable = match(isConsumerDelegable)
      .with(false, () => false)
      .with(undefined, () => undefined)
      .exhaustive();

    const descriptor: Descriptor = {
      ...getMockDescriptor(),
      state: descriptorState.draft,
      interface: mockDocument,
    };
    const eservice: EService = {
      ...mockEService,
      descriptors: [descriptor],
      isSignalHubEnabled,
    };
    const updatedName = "eservice new name";
    await addOneEService(eservice);
    const updateEServiceReturn = await catalogService.updateEService(
      mockEService.id,
      {
        name: updatedName,
        description: mockEService.description,
        technology: "REST",
        mode: "DELIVER",
        isSignalHubEnabled,
        isConsumerDelegable,
        isClientAccessDelegable,
      },
      getMockContext({ authData: getMockAuthData(mockEService.producerId) })
    );

    const expectedEService: EService = {
      ...eservice,
      name: updatedName,
      isSignalHubEnabled,
      isConsumerDelegable,
      isClientAccessDelegable: expectedIsClientAccessDelegable,
    };

    const writtenEvent = await readLastEserviceEvent(mockEService.id);
    expect(writtenEvent.stream_id).toBe(mockEService.id);
    expect(writtenEvent.version).toBe("1");
    expect(writtenEvent.type).toBe("DraftEServiceUpdated");
    expect(writtenEvent.event_version).toBe(2);
    const writtenPayload = decodeProtobufPayload({
      messageType: DraftEServiceUpdatedV2,
      payload: writtenEvent.data,
    });

    expect(writtenPayload.eservice).toEqual(toEServiceV2(expectedEService));
    expect(updateEServiceReturn).toEqual({
      data: expectedEService,
      metadata: { version: 1 },
    });
    expect(fileManager.delete).not.toHaveBeenCalled();
  });

  it("should write on event-store for the update of an eService (technology change: interface has to be deleted)", async () => {
    vi.spyOn(fileManager, "delete");

    const interfaceDocument = {
      ...mockDocument,
      name: `${mockDocument.name}`,
      path: `${config.eserviceDocumentsPath}/${mockDocument.id}/${mockDocument.name}`,
    };

    const descriptor: Descriptor = {
      ...getMockDescriptor(),
      state: descriptorState.draft,
      interface: interfaceDocument,
    };
    const eservice: EService = {
      ...mockEService,
      descriptors: [descriptor],
    };
    const updatedName = "eservice new name";
    await addOneEService(eservice);

    await fileManager.storeBytes(
      {
        bucket: config.s3Bucket,
        path: config.eserviceDocumentsPath,
        resourceId: interfaceDocument.id,
        name: interfaceDocument.name,
        content: Buffer.from("testtest"),
      },
      genericLogger
    );

    expect(
      await fileManager.listFiles(config.s3Bucket, genericLogger)
    ).toContain(interfaceDocument.path);

    const updateEServiceReturn = await catalogService.updateEService(
      eservice.id,
      {
        name: updatedName,
        description: eservice.description,
        technology: "SOAP",
        mode: "DELIVER",
      },
      getMockContext({ authData: getMockAuthData(eservice.producerId) })
    );

    const expectedEService: EService = {
      ...eservice,
      name: updatedName,
      technology: "Soap",
      descriptors: eservice.descriptors.map((d) => ({
        ...d,
        interface: undefined,
        serverUrls: [],
      })),
    };

    const writtenEvent = await readLastEserviceEvent(eservice.id);
    expect(writtenEvent).toMatchObject({
      stream_id: eservice.id,
      version: "1",
      type: "DraftEServiceUpdated",
      event_version: 2,
    });

    const writtenPayload = decodeProtobufPayload({
      messageType: DraftEServiceUpdatedV2,
      payload: writtenEvent.data,
    });

    expect(writtenPayload.eservice).toEqual(toEServiceV2(expectedEService));
    expect(fileManager.delete).toHaveBeenCalledWith(
      config.s3Bucket,
      interfaceDocument.path,
      genericLogger
    );
    expect(
      await fileManager.listFiles(config.s3Bucket, genericLogger)
    ).not.toContain(interfaceDocument.path);
    expect(updateEServiceReturn).toEqual({
      data: expectedEService,
      metadata: { version: 1 },
    });
  });

  it("should write on event-store for the update of an eService (mode change: risk analysis has to be deleted)", async () => {
    const eservice: EService = {
      ...mockEService,
      riskAnalysis: [getMockValidRiskAnalysis("PA")],
      technology: "Rest",
      mode: eserviceMode.receive,
      descriptors: [],
    };
    await addOneEService(eservice);

    const updateEServiceReturn = await catalogService.updateEService(
      eservice.id,
      {
        name: eservice.name,
        description: eservice.description,
        technology: "REST",
        mode: "DELIVER",
      },
      getMockContext({ authData: getMockAuthData(eservice.producerId) })
    );

    const expectedEService: EService = {
      ...eservice,
      mode: eserviceMode.deliver,
      riskAnalysis: [],
    };

    const writtenEvent = await readLastEserviceEvent(eservice.id);
    expect(writtenEvent).toMatchObject({
      stream_id: eservice.id,
      version: "1",
      type: "DraftEServiceUpdated",
      event_version: 2,
    });

    const writtenPayload = decodeProtobufPayload({
      messageType: DraftEServiceUpdatedV2,
      payload: writtenEvent.data,
    });

    expect(writtenPayload.eservice).toEqual(toEServiceV2(expectedEService));

    expect(updateEServiceReturn).toEqual({
      data: expectedEService,
      metadata: { version: 1 },
    });
  });

  it("should write on event-store for the update of an eService (personalData flag change: risk analysis has to be deleted)", async () => {
    const eservice: EService = {
      ...mockEService,
      mode: eserviceMode.receive,
      technology: "Rest",
      personalData: true,
      riskAnalysis: [getMockValidRiskAnalysis("PA")],
    };
    await addOneEService(eservice);

    const updateEServiceReturn = await catalogService.updateEService(
      eservice.id,
      {
        name: eservice.name,
        description: eservice.description,
        technology: "REST",
        mode: "RECEIVE",
        personalData: false,
      },
      getMockContext({ authData: getMockAuthData(eservice.producerId) })
    );

    const expectedEService: EService = {
      ...eservice,
      personalData: false,
      riskAnalysis: [],
    };

    const writtenEvent = await readLastEserviceEvent(eservice.id);
    expect(writtenEvent).toMatchObject({
      stream_id: eservice.id,
      version: "1",
      type: "DraftEServiceUpdated",
      event_version: 2,
    });

    const writtenPayload = decodeProtobufPayload({
      messageType: DraftEServiceUpdatedV2,
      payload: writtenEvent.data,
    });

    expect(writtenPayload.eservice).toEqual(toEServiceV2(expectedEService));

    expect(updateEServiceReturn).toEqual({
      data: expectedEService,
      metadata: { version: 1 },
    });
  });

  it("should fail if the file deletion fails when interface file has to be deleted on technology change", async () => {
    config.s3Bucket = "invalid-bucket"; // configure an invalid bucket to force a failure
    const descriptor: Descriptor = {
      ...getMockDescriptor(),
      state: descriptorState.draft,
      interface: mockDocument,
    };
    const eservice: EService = {
      ...mockEService,
      descriptors: [descriptor],
    };
    const updatedName = "eService new name";
    await addOneEService(eservice);

    expect(
      catalogService.updateEService(
        mockEService.id,
        {
          name: updatedName,
          description: mockEService.description,
          technology: "SOAP",
          mode: "DELIVER",
        },
        getMockContext({ authData: getMockAuthData(mockEService.producerId) })
      )
    ).rejects.toThrowError(
      fileManagerDeleteError(
        mockDocument.path,
        config.s3Bucket,
        new Error("The specified bucket does not exist")
      )
    );
  });
  it("should write on event-store for the update of an eService (update description only)", async () => {
    const updatedDescription = "eservice new description";

    await addOneEService(mockEService);
    const updateEServiceReturn = await catalogService.updateEService(
      mockEService.id,
      {
        name: mockEService.name,
        description: updatedDescription,
        technology: "REST",
        mode: "DELIVER",
      },
      getMockContext({ authData: getMockAuthData(mockEService.producerId) })
    );

    const expectedEService: EService = {
      ...mockEService,
      description: updatedDescription,
    };

    const writtenEvent = await readLastEserviceEvent(mockEService.id);
    expect(writtenEvent).toMatchObject({
      stream_id: mockEService.id,
      version: "1",
      type: "DraftEServiceUpdated",
      event_version: 2,
    });
    const writtenPayload = decodeProtobufPayload({
      messageType: DraftEServiceUpdatedV2,
      payload: writtenEvent.data,
    });

    expect(writtenPayload.eservice).toEqual(toEServiceV2(expectedEService));
    expect(updateEServiceReturn).toEqual({
      data: expectedEService,
      metadata: { version: 1 },
    });
  });
  it("should write on event-store for the update of an eService (delegate)", async () => {
    const updatedDescription = "eservice new description";
    const delegation = getMockDelegation({
      kind: delegationKind.delegatedProducer,
      eserviceId: mockEService.id,
      state: delegationState.active,
    });

    await addOneEService(mockEService);
    await addOneDelegation(delegation);
    const updateEServiceReturn = await catalogService.updateEService(
      mockEService.id,
      {
        name: mockEService.name,
        description: updatedDescription,
        technology: "REST",
        mode: "DELIVER",
      },
      getMockContext({ authData: getMockAuthData(delegation.delegateId) })
    );

    const expectedEService: EService = {
      ...mockEService,
      description: updatedDescription,
    };

    const writtenEvent = await readLastEserviceEvent(mockEService.id);
    expect(writtenEvent).toMatchObject({
      stream_id: mockEService.id,
      version: "1",
      type: "DraftEServiceUpdated",
      event_version: 2,
    });
    const writtenPayload = decodeProtobufPayload({
      messageType: DraftEServiceUpdatedV2,
      payload: writtenEvent.data,
    });

    expect(writtenPayload.eservice).toEqual(toEServiceV2(expectedEService));
    expect(updateEServiceReturn).toEqual({
      data: expectedEService,
      metadata: { version: 1 },
    });
  });

  it("should write on event-store for the update of an eService (update mode to DELIVER so risk analysis has to be deleted)", async () => {
    const riskAnalysis = getMockValidRiskAnalysis("PA");
    const eservice: EService = {
      ...mockEService,
      descriptors: [],
      riskAnalysis: [riskAnalysis],
      mode: "Receive",
    };
    await addOneEService(eservice);

    const updateEServiceReturn = await catalogService.updateEService(
      eservice.id,
      {
        name: eservice.name,
        description: eservice.description,
        technology: "REST",
        mode: "DELIVER",
      },
      getMockContext({ authData: getMockAuthData(eservice.producerId) })
    );

    const expectedEService: EService = {
      ...eservice,
      mode: eserviceMode.deliver,
      riskAnalysis: [],
    };

    const writtenEvent = await readLastEserviceEvent(eservice.id);
    expect(writtenEvent).toMatchObject({
      stream_id: eservice.id,
      version: "1",
      type: "DraftEServiceUpdated",
      event_version: 2,
    });
    const writtenPayload = decodeProtobufPayload({
      messageType: DraftEServiceUpdatedV2,
      payload: writtenEvent.data,
    });

    expect(writtenPayload.eservice).toEqual(toEServiceV2(expectedEService));
    expect(updateEServiceReturn).toEqual({
      data: expectedEService,
      metadata: { version: 1 },
    });
  });

  it("should throw eServiceNotFound if the eservice doesn't exist", async () => {
    expect(
      catalogService.updateEService(
        mockEService.id,
        {
          name: "eservice new name",
          description: "eservice description",
          technology: "REST",
          mode: "DELIVER",
        },
        getMockContext({ authData: getMockAuthData(mockEService.producerId) })
      )
    ).rejects.toThrowError(eServiceNotFound(mockEService.id));
  });

  it("should throw operationForbidden if the requester is not the producer", async () => {
    await addOneEService(mockEService);

    expect(
      catalogService.updateEService(
        mockEService.id,
        {
          name: "eservice new name",
          description: "eservice description",
          technology: "REST",
          mode: "DELIVER",
        },
        getMockContext({})
      )
    ).rejects.toThrowError(operationForbidden);
  });

  it("should throw operationForbidden if the requester if the given e-service has been delegated and caller is not the delegate", async () => {
    const delegation = getMockDelegation({
      kind: delegationKind.delegatedProducer,
      eserviceId: mockEService.id,
      state: delegationState.active,
    });

    await addOneEService(mockEService);
    await addOneDelegation(delegation);

    expect(
      catalogService.updateEService(
        mockEService.id,
        {
          name: "eservice new name",
          description: "eservice description",
          technology: "REST",
          mode: "DELIVER",
        },
        getMockContext({ authData: getMockAuthData(mockEService.producerId) })
      )
    ).rejects.toThrowError(operationForbidden);
  });

  it("should throw eServiceNameDuplicateForProducer if the updated name is already in use", async () => {
    const eservice1: EService = {
      ...mockEService,
      id: generateId(),
      descriptors: [],
    };

    const name = "eservice name already in use";

    const eservice2: EService = {
      ...mockEService,
      id: generateId(),
      name,
      descriptors: [],
    };
    await addOneEService(eservice1);
    await addOneEService(eservice2);

    expect(
      catalogService.updateEService(
        eservice1.id,
        {
          name,
          description: "eservice description",
          technology: "REST",
          mode: "DELIVER",
        },
        getMockContext({ authData: getMockAuthData(eservice1.producerId) })
      )
    ).rejects.toThrowError(
      eServiceNameDuplicateForProducer(name, eservice1.producerId)
    );
  });
  it("should throw eServiceNameDuplicateForProducer if the updated name is already in use, case insensitive", async () => {
    const eservice1: EService = {
      ...mockEService,
      id: generateId(),
      descriptors: [],
    };

    const name = "eservice name already in use";

    const eservice2: EService = {
      ...mockEService,
      id: generateId(),
      name,
      descriptors: [],
    };
    await addOneEService(eservice1);
    await addOneEService(eservice2);

    expect(
      catalogService.updateEService(
        eservice1.id,
        {
          name: name.toUpperCase(),
          description: "eservice description",
          technology: "REST",
          mode: "DELIVER",
        },
        getMockContext({ authData: getMockAuthData(eservice1.producerId) })
      )
    ).rejects.toThrowError(
      eServiceNameDuplicateForProducer(name.toUpperCase(), eservice1.producerId)
    );
  });
  it("should throw eserviceTemplateNameConflict if the updated name is already in use", async () => {
    const eservice1: EService = {
      ...mockEService,
      id: generateId(),
      descriptors: [],
    };

    const name = "eservice name already in use";

    const eserviceTemplate: EServiceTemplate = {
      ...getMockEServiceTemplate(),
      name,
    };

    await addOneEService(eservice1);
    await addOneEServiceTemplate(eserviceTemplate);

    expect(
      catalogService.updateEService(
        eservice1.id,
        {
          name,
          description: "eservice description",
          technology: "REST",
          mode: "DELIVER",
        },
        getMockContext({ authData: getMockAuthData(eservice1.producerId) })
      )
    ).rejects.toThrowError(eserviceTemplateNameConflict(name));
  });
  it("should throw eserviceTemplateNameConflict if the updated name is already in use, case insensitive", async () => {
    const eservice1: EService = {
      ...mockEService,
      id: generateId(),
      descriptors: [],
    };

    const name = "eservice name already in use";

    const eserviceTemplate: EServiceTemplate = {
      ...getMockEServiceTemplate(),
      name,
    };

    await addOneEService(eservice1);
    await addOneEServiceTemplate(eserviceTemplate);

    expect(
      catalogService.updateEService(
        eservice1.id,
        {
          name: name.toUpperCase(),
          description: "eservice description",
          technology: "REST",
          mode: "DELIVER",
        },
        getMockContext({ authData: getMockAuthData(eservice1.producerId) })
      )
    ).rejects.toThrowError(eserviceTemplateNameConflict(name.toUpperCase()));
  });

  it("should throw eserviceNotInDraftState if the eservice descriptor is in published state", async () => {
    const descriptor: Descriptor = {
      ...getMockDescriptor(),
      interface: mockDocument,
      state: descriptorState.published,
    };
    const eservice: EService = {
      ...mockEService,
      descriptors: [descriptor],
    };
    await addOneEService(eservice);
    expect(
      catalogService.updateEService(
        eservice.id,
        {
          name: "eservice new name",
          description: "eservice description",
          technology: "REST",
          mode: "DELIVER",
        },
        getMockContext({ authData: getMockAuthData(eservice.producerId) })
      )
    ).rejects.toThrowError(eserviceNotInDraftState(eservice.id));
  });

  it("should throw eserviceNotInDraftState if the eservice descriptor is in archived state", async () => {
    const descriptor: Descriptor = {
      ...getMockDescriptor(),
      interface: mockDocument,
      state: descriptorState.archived,
    };
    const eservice: EService = {
      ...mockEService,
      descriptors: [descriptor],
    };
    await addOneEService(eservice);
    expect(
      catalogService.updateEService(
        eservice.id,
        {
          name: "eservice new name",
          description: "eservice description",
          technology: "REST",
          mode: "DELIVER",
        },
        getMockContext({ authData: getMockAuthData(eservice.producerId) })
      )
    ).rejects.toThrowError(eserviceNotInDraftState(eservice.id));
  });

  it("should throw eserviceNotInDraftState if the eservice descriptor is in suspended state", async () => {
    const descriptor: Descriptor = {
      ...getMockDescriptor(),
      interface: mockDocument,
      state: descriptorState.suspended,
    };
    const eservice: EService = {
      ...mockEService,
      descriptors: [descriptor],
    };
    await addOneEService(eservice);
    expect(
      catalogService.updateEService(
        eservice.id,
        {
          name: "eservice new name",
          description: "eservice description",
          technology: "REST",
          mode: "DELIVER",
        },
        getMockContext({ authData: getMockAuthData(eservice.producerId) })
      )
    ).rejects.toThrowError(eserviceNotInDraftState(eservice.id));
  });

  it("should throw eserviceNotInDraftState if the eservice descriptor is in deprecated state", async () => {
    const descriptor: Descriptor = {
      ...getMockDescriptor(),
      interface: mockDocument,
      state: descriptorState.deprecated,
    };
    const eservice: EService = {
      ...mockEService,
      descriptors: [descriptor],
    };
    await addOneEService(eservice);
    expect(
      catalogService.updateEService(
        eservice.id,
        {
          name: "eservice new name",
          description: "eservice description",
          technology: "REST",
          mode: "DELIVER",
        },
        getMockContext({ authData: getMockAuthData(eservice.producerId) })
      )
    ).rejects.toThrowError(eserviceNotInDraftState(eservice.id));
  });

  it("should throw templateInstanceNotAllowed if the eservice is an instance of a template", async () => {
    const templateId: EServiceTemplateId = generateId();
    const descriptor: Descriptor = {
      ...getMockDescriptor(),
      interface: mockDocument,
      state: descriptorState.draft,
    };
    const eservice: EService = {
      ...mockEService,
      descriptors: [descriptor],
      templateId,
    };
    await addOneEService(eservice);

    expect(
      catalogService.updateEService(
        mockEService.id,
        {
          name: "eservice new name",
          description: "eservice description",
          technology: "REST",
          mode: "DELIVER",
        },
        getMockContext({ authData: getMockAuthData(mockEService.producerId) })
      )
    ).rejects.toThrowError(templateInstanceNotAllowed(eservice.id, templateId));
  });
});
