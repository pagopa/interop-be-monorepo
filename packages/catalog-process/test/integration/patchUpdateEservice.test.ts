/* eslint-disable @typescript-eslint/no-floating-promises */
import { genericLogger } from "pagopa-interop-commons";
import {
  decodeProtobufPayload,
  getMockDelegation,
  getMockValidRiskAnalysis,
  randomArrayItem,
  getMockDocument,
  getMockDescriptor,
  getMockEService,
  getMockEServiceTemplate,
  getMockContextM2MAdmin,
} from "pagopa-interop-commons-test";
import {
  Descriptor,
  descriptorState,
  EService,
  DraftEServiceUpdatedV2,
  toEServiceV2,
  operationForbidden,
  generateId,
  delegationState,
  delegationKind,
  EServiceTemplateId,
  EServiceTemplate,
} from "pagopa-interop-models";
import { vi, expect, describe, it } from "vitest";
import { match } from "ts-pattern";
import { catalogApi } from "pagopa-interop-api-clients";
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
import {
  apiEServiceModeToEServiceMode,
  apiTechnologyToTechnology,
} from "../../src/model/domain/apiConverter.js";

describe("patch update eService", () => {
  const mockEService: EService = {
    ...getMockEService(),
    isSignalHubEnabled: false,
  };
  const mockDocument = getMockDocument();

  it.each([
    {}, // This should not throw an error and leave all fields unchanged
    {
      name: "New name",
    },
    {
      name: "New name",
      description: "New description",
    },
    {
      name: "New name",
      description: "New description",
      technology: "SOAP",
    },
    {
      name: "New name",
      description: "New description",
      technology: "SOAP",
      mode: "DELIVER",
    },
    {
      name: "New name",
      description: "New description",
      technology: "SOAP",
      mode: "DELIVER",
      isSignalHubEnabled: true,
    },
    {
      name: "New name",
      description: "New description",
      technology: "SOAP",
      mode: "DELIVER",
      isSignalHubEnabled: true,
      isConsumerDelegable: true,
    },
    {
      name: "New name",
      description: "New description",
      technology: "SOAP",
      mode: "DELIVER",
      isSignalHubEnabled: true,
      isConsumerDelegable: true,
      isClientAccessDelegable: true,
    },
    {
      name: "New name",
      description: "New description",
      technology: "SOAP",
      mode: "DELIVER",
      isSignalHubEnabled: true,
      isConsumerDelegable: true,
      isClientAccessDelegable: true,
      personalData: true,
    },
  ] as catalogApi.PatchUpdateEServiceSeed[])(
    "should write on event-store and update only the fields set in the seed, and leave undefined fields unchanged (seed #%#)",
    async (seed) => {
      config.featureFlagSignalhubWhitelist = true;
      config.signalhubWhitelistProducer = [mockEService.producerId];

      const descriptor: Descriptor = {
        ...getMockDescriptor(),
        state: descriptorState.draft,
        interface: mockDocument,
        serverUrls: ["test"],
      };
      const eservice: EService = {
        ...mockEService,
        descriptors: [descriptor],
        technology: "Rest",
        mode: "Receive",
        isSignalHubEnabled: false,
        isConsumerDelegable: false,
        isClientAccessDelegable: false,
        riskAnalysis: [getMockValidRiskAnalysis("PA")],
      };

      await addOneEService(eservice);

      const updateEServiceReturn = await catalogService.patchUpdateEService(
        mockEService.id,
        seed,
        getMockContextM2MAdmin({ organizationId: mockEService.producerId })
      );

      const wasTechnologyUpdated =
        seed.technology &&
        apiTechnologyToTechnology(seed.technology) !== eservice.technology;

      const expectedEService: EService = {
        ...eservice,
        name: seed.name ?? eservice.name,
        description: seed.description ?? eservice.description,
        technology: seed.technology
          ? apiTechnologyToTechnology(seed.technology)
          : eservice.technology,
        mode: seed.mode
          ? apiEServiceModeToEServiceMode(seed.mode)
          : eservice.mode,
        isSignalHubEnabled:
          seed.isSignalHubEnabled ?? eservice.isSignalHubEnabled,
        isConsumerDelegable:
          seed.isConsumerDelegable ?? eservice.isConsumerDelegable,
        isClientAccessDelegable:
          seed.isClientAccessDelegable ?? eservice.isClientAccessDelegable,
        personalData: seed.personalData ?? eservice.personalData,
        descriptors: eservice.descriptors.map((d) => ({
          ...d,
          interface: wasTechnologyUpdated ? undefined : d.interface,
          serverUrls: wasTechnologyUpdated ? [] : d.serverUrls,
        })),
        riskAnalysis: seed.mode === "DELIVER" ? [] : eservice.riskAnalysis,
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
    }
  );

  it("should update an eservice correctly handling isClientAccessDelegable when isConsumerDelegable is not true", async () => {
    config.featureFlagSignalhubWhitelist = true;
    config.signalhubWhitelistProducer = [mockEService.producerId];

    const isConsumerDelegable: false | undefined = randomArrayItem([
      false,
      undefined,
    ]);

    const descriptor: Descriptor = {
      ...getMockDescriptor(),
      state: descriptorState.draft,
    };
    const eservice: EService = {
      ...mockEService,
      descriptors: [descriptor],
      isConsumerDelegable: true,
      isClientAccessDelegable: true,
    };

    const isClientAccessDelegable = randomArrayItem([false, true, undefined]);

    await addOneEService(eservice);
    const updateEServiceReturn = await catalogService.patchUpdateEService(
      mockEService.id,
      {
        isConsumerDelegable,
        isClientAccessDelegable,
      },
      getMockContextM2MAdmin({ organizationId: mockEService.producerId })
    );

    const updatedIsConsumerDelegable =
      isConsumerDelegable ?? eservice.isConsumerDelegable;
    const expectedIsClientAccessDelegable = match([
      updatedIsConsumerDelegable,
      isClientAccessDelegable,
    ])
      .with([false, false], () => false)
      .with([false, true], () => false)
      .with([false, undefined], () => false)
      .with([true, false], () => false)
      .with([true, true], () => true)
      .with([true, undefined], () => true)
      .with([undefined, false], () => false)
      .with([undefined, true], () => true)
      .with([undefined, undefined], () => true)
      .exhaustive();

    const expectedEService: EService = {
      ...eservice,
      isConsumerDelegable: updatedIsConsumerDelegable,
      isClientAccessDelegable: expectedIsClientAccessDelegable,
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

  it("should update an eservice setting isSignalHubEnabled to false if tenant is not in whitelist", async () => {
    config.featureFlagSignalhubWhitelist = true;
    config.signalhubWhitelistProducer = [];

    await addOneEService({
      ...mockEService,
      isSignalHubEnabled: randomArrayItem([false, true, undefined]),
    });
    const updateEServiceReturn = await catalogService.patchUpdateEService(
      mockEService.id,
      {
        isSignalHubEnabled: randomArrayItem([false, true, undefined]),
      },
      getMockContextM2MAdmin({ organizationId: mockEService.producerId })
    );

    const expectedEService: EService = {
      ...mockEService,
      isSignalHubEnabled: false,
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

  it("should delete interface on technology change)", async () => {
    vi.spyOn(fileManager, "delete");

    config.featureFlagSignalhubWhitelist = true;
    config.signalhubWhitelistProducer = [mockEService.producerId];

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
      technology: "Rest",
    };
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

    const updateEServiceReturn = await catalogService.patchUpdateEService(
      eservice.id,
      {
        technology: "SOAP",
      },
      getMockContextM2MAdmin({ organizationId: eservice.producerId })
    );

    const expectedEService: EService = {
      ...eservice,
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

  it("should write on event-store for the update of an e-service (delegate)", async () => {
    const delegation = getMockDelegation({
      kind: delegationKind.delegatedProducer,
      eserviceId: mockEService.id,
      state: delegationState.active,
    });

    await addOneEService(mockEService);
    await addOneDelegation(delegation);
    const updateEServiceReturn = await catalogService.patchUpdateEService(
      mockEService.id,
      {
        name: "eservice new name",
        description: "eservice new description",
      },
      getMockContextM2MAdmin({ organizationId: delegation.delegateId })
    );

    const expectedEService: EService = {
      ...mockEService,
      name: "eservice new name",
      description: "eservice new description",
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

  it("should throw eServiceNotFound if the eservice doesn't exist", async () => {
    expect(
      catalogService.patchUpdateEService(
        mockEService.id,
        {
          name: "eservice new name",
          description: "eservice description",
          technology: "REST",
          mode: "DELIVER",
        },
        getMockContextM2MAdmin({ organizationId: mockEService.producerId })
      )
    ).rejects.toThrowError(eServiceNotFound(mockEService.id));
  });

  it("should throw operationForbidden if the requester is not the producer", async () => {
    await addOneEService(mockEService);

    expect(
      catalogService.patchUpdateEService(
        mockEService.id,
        {
          name: "eservice new name",
          description: "eservice description",
          technology: "REST",
          mode: "DELIVER",
        },
        getMockContextM2MAdmin({})
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
      catalogService.patchUpdateEService(
        mockEService.id,
        {
          name: "eservice new name",
          description: "eservice description",
          technology: "REST",
          mode: "DELIVER",
        },
        getMockContextM2MAdmin({ organizationId: mockEService.producerId })
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
      catalogService.patchUpdateEService(
        eservice1.id,
        {
          name,
          description: "eservice description",
          technology: "REST",
          mode: "DELIVER",
        },
        getMockContextM2MAdmin({ organizationId: eservice1.producerId })
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
      catalogService.patchUpdateEService(
        eservice1.id,
        {
          name: name.toUpperCase(),
          description: "eservice description",
          technology: "REST",
          mode: "DELIVER",
        },
        getMockContextM2MAdmin({ organizationId: eservice1.producerId })
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
      catalogService.patchUpdateEService(
        eservice1.id,
        {
          name,
          description: "eservice description",
          technology: "REST",
          mode: "DELIVER",
        },
        getMockContextM2MAdmin({ organizationId: eservice1.producerId })
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
      catalogService.patchUpdateEService(
        eservice1.id,
        {
          name: name.toUpperCase(),
          description: "eservice description",
          technology: "REST",
          mode: "DELIVER",
        },
        getMockContextM2MAdmin({ organizationId: eservice1.producerId })
      )
    ).rejects.toThrowError(eserviceTemplateNameConflict(name.toUpperCase()));
  });

  it.each(
    Object.values(descriptorState).filter(
      (state) => state !== descriptorState.draft
    )
  )(
    "should throw eserviceNotInDraftState if the eservice descriptor is in %s state",
    async (state) => {
      const descriptor: Descriptor = {
        ...getMockDescriptor(),
        interface: mockDocument,
        state,
      };
      const eservice: EService = {
        ...mockEService,
        descriptors: [descriptor],
      };
      await addOneEService(eservice);
      expect(
        catalogService.patchUpdateEService(
          eservice.id,
          {
            name: "eservice new name",
            description: "eservice description",
            technology: "REST",
            mode: "DELIVER",
          },
          getMockContextM2MAdmin({ organizationId: eservice.producerId })
        )
      ).rejects.toThrowError(eserviceNotInDraftState(eservice.id));
    }
  );

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
      catalogService.patchUpdateEService(
        mockEService.id,
        {
          name: "eservice new name",
          description: "eservice description",
          technology: "REST",
          mode: "DELIVER",
        },
        getMockContextM2MAdmin({ organizationId: eservice.producerId })
      )
    ).rejects.toThrowError(templateInstanceNotAllowed(eservice.id, templateId));
  });
});
