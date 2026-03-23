/* eslint-disable @typescript-eslint/no-unused-vars */
import { afterAll, beforeAll, describe, vi, it, expect } from "vitest";
import {
  decodeProtobufPayload,
  getMockEServiceTemplate,
  getMockEServiceTemplateVersion,
  getMockTenant,
  getMockValidEServiceTemplateRiskAnalysis,
  readEventByStreamIdAndVersion,
  getMockEService,
  getMockAuthData,
  getMockDescriptor,
  getMockDocument,
  getMockContext,
} from "pagopa-interop-commons-test";
import { genericLogger } from "pagopa-interop-commons";
import {
  Document,
  EService,
  EServiceAddedV2,
  EServiceDescriptorAddedV2,
  EServiceDescriptorDocumentAddedV2,
  EServiceDescriptorAsyncExchangeCallbackInterfaceAddedV2,
  EServiceDocumentId,
  eserviceMode,
  EServiceTemplate,
  EServiceTemplateVersion,
  EServiceTemplateVersionId,
  eserviceTemplateVersionState,
  generateId,
  Tenant,
  tenantKind,
  toEServiceV2,
  unsafeBrandId,
} from "pagopa-interop-models";
import {
  catalogService,
  postgresDB,
  readLastEserviceEvent,
  addOneEService,
  addOneEServiceTemplate,
  fileManager,
  addOneTenant,
} from "../integrationUtils.js";
import { config } from "../../src/config/config.js";
import { eServiceNameDuplicateForProducer } from "../../src/model/domain/errors.js";

describe("create eService from template", () => {
  const mockEService = getMockEService();
  const mockDescriptor = getMockDescriptor();
  const mockEServiceTemplate = getMockEServiceTemplate();
  const mockDocument = getMockDocument();
  beforeAll(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date());
  });
  afterAll(() => {
    vi.useRealTimers();
  });

  it("should write on event-store for the creation of an eService from a template", async () => {
    const publishedVersion: EServiceTemplateVersion = {
      ...getMockEServiceTemplateVersion(),
      state: eserviceTemplateVersionState.published,
    };
    const eServiceTemplate: EServiceTemplate = {
      ...mockEServiceTemplate,
      versions: [publishedVersion],
      personalData: false,
      asyncExchange: true,
    };

    const tenant: Tenant = {
      ...getMockTenant(mockEService.producerId),
      kind: tenantKind.PA,
    };

    await addOneTenant(tenant);
    await addOneEServiceTemplate(eServiceTemplate);

    const eService = await catalogService.createEServiceInstanceFromTemplate(
      eServiceTemplate.id,
      {},
      getMockContext({ authData: getMockAuthData(mockEService.producerId) })
    );

    expect(eService).toBeDefined();

    const eServiceCreationEvent = await readEventByStreamIdAndVersion(
      eService.id,
      0,
      "catalog",
      postgresDB
    );
    const descriptorCreationEvent = await readLastEserviceEvent(eService.id);

    expect(eServiceCreationEvent).toMatchObject({
      stream_id: eService.id,
      version: "0",
      type: "EServiceAdded",
      event_version: 2,
    });
    expect(descriptorCreationEvent).toMatchObject({
      stream_id: eService.id,
      version: "1",
      type: "EServiceDescriptorAdded",
      event_version: 2,
    });

    const eServiceCreationPayload = decodeProtobufPayload({
      messageType: EServiceAddedV2,
      payload: eServiceCreationEvent.data,
    });
    const descriptorCreationPayload = decodeProtobufPayload({
      messageType: EServiceDescriptorAddedV2,
      payload: descriptorCreationEvent.data,
    });

    const expectedEService: EService = {
      ...mockEService,
      description: eServiceTemplate.description,
      name: eServiceTemplate.name,
      createdAt: eService.createdAt,
      id: eService.id,
      isSignalHubEnabled: eService.isSignalHubEnabled,
      isConsumerDelegable: false,
      isClientAccessDelegable: false,
      templateId: eServiceTemplate.id,
      personalData: eServiceTemplate.personalData,
      asyncExchange: eServiceTemplate.asyncExchange,
    };

    const expectedEServiceWithDescriptor: EService = {
      ...mockEService,
      description: eServiceTemplate.description,
      name: eServiceTemplate.name,
      createdAt: new Date(),
      id: eService.id,
      isSignalHubEnabled: eService.isSignalHubEnabled,
      isClientAccessDelegable: false,
      isConsumerDelegable: false,
      templateId: eServiceTemplate.id,
      personalData: eServiceTemplate.personalData,
      asyncExchange: eServiceTemplate.asyncExchange,
      descriptors: [
        {
          ...mockDescriptor,
          description: publishedVersion.description,
          id: eService.descriptors[0].id,
          createdAt: new Date(),
          serverUrls: [],
          audience: [],
          dailyCallsPerConsumer: publishedVersion?.dailyCallsPerConsumer ?? 1,
          dailyCallsTotal: publishedVersion?.dailyCallsTotal ?? 1,
          templateVersionRef: { id: publishedVersion.id },
        },
      ],
    };

    expect(eServiceCreationPayload.eservice).toEqual(
      toEServiceV2(expectedEService)
    );
    expect(descriptorCreationPayload.eservice).toEqual(
      toEServiceV2(expectedEServiceWithDescriptor)
    );
  });

  it.each([
    {
      instanceLabel: undefined as string | undefined,
      expectedParsedInstanceLabel: undefined as string | undefined,
      description: "without instanceLabel",
    },
    {
      instanceLabel: "test",
      expectedParsedInstanceLabel: "test",
      description: 'with instanceLabel "test"',
    },
    {
      instanceLabel: "",
      expectedParsedInstanceLabel: undefined,
      description: 'with instanceLabel "" (treated as undefined)',
    },
    {
      instanceLabel: " ",
      expectedParsedInstanceLabel: undefined,
      description: 'with instanceLabel " " (treated as undefined)',
    },
  ])(
    "should write on event-store for the creation of an eService from a template ($description) when another instance already exists",
    async ({ instanceLabel, expectedParsedInstanceLabel }) => {
      const publishedVersion: EServiceTemplateVersion = {
        ...getMockEServiceTemplateVersion(),
        state: eserviceTemplateVersionState.published,
      };
      const eServiceTemplate: EServiceTemplate = {
        ...mockEServiceTemplate,
        versions: [publishedVersion],
        personalData: false,
      };

      const tenant: Tenant = {
        ...getMockTenant(mockEService.producerId),
        kind: tenantKind.PA,
      };

      await addOneTenant(tenant);
      await addOneEServiceTemplate(eServiceTemplate);

      // Add an existing instance with label "istanza 0001" to verify no conflict
      const existingInstance: EService = {
        ...getMockEService(
          undefined,
          mockEService.producerId,
          [],
          eServiceTemplate.id
        ),
        name: `${eServiceTemplate.name} - istanza 0001`,
        instanceLabel: "istanza 0001",
      };
      await addOneEService(existingInstance);

      const expectedName =
        expectedParsedInstanceLabel !== undefined
          ? `${eServiceTemplate.name} - ${expectedParsedInstanceLabel}`
          : eServiceTemplate.name;

      const eService = await catalogService.createEServiceInstanceFromTemplate(
        eServiceTemplate.id,
        { instanceLabel },
        getMockContext({
          authData: getMockAuthData(mockEService.producerId),
        })
      );

      expect(eService).toBeDefined();

      const eServiceCreationEvent = await readEventByStreamIdAndVersion(
        eService.id,
        0,
        "catalog",
        postgresDB
      );
      const descriptorCreationEvent = await readLastEserviceEvent(eService.id);

      expect(eServiceCreationEvent).toMatchObject({
        stream_id: eService.id,
        version: "0",
        type: "EServiceAdded",
        event_version: 2,
      });
      expect(descriptorCreationEvent).toMatchObject({
        stream_id: eService.id,
        version: "1",
        type: "EServiceDescriptorAdded",
        event_version: 2,
      });

      const eServiceCreationPayload = decodeProtobufPayload({
        messageType: EServiceAddedV2,
        payload: eServiceCreationEvent.data,
      });
      const descriptorCreationPayload = decodeProtobufPayload({
        messageType: EServiceDescriptorAddedV2,
        payload: descriptorCreationEvent.data,
      });

      const expectedEService: EService = {
        ...mockEService,
        description: eServiceTemplate.description,
        name: expectedName,
        createdAt: eService.createdAt,
        id: eService.id,
        isSignalHubEnabled: eService.isSignalHubEnabled,
        isConsumerDelegable: false,
        isClientAccessDelegable: false,
        templateId: eServiceTemplate.id,
        personalData: eServiceTemplate.personalData,
        asyncExchange: eServiceTemplate.asyncExchange,
        ...(expectedParsedInstanceLabel !== undefined
          ? { instanceLabel: expectedParsedInstanceLabel }
          : {}),
      };

      const expectedEServiceWithDescriptor: EService = {
        ...mockEService,
        description: eServiceTemplate.description,
        name: expectedName,
        createdAt: new Date(),
        id: eService.id,
        isSignalHubEnabled: eService.isSignalHubEnabled,
        isClientAccessDelegable: false,
        isConsumerDelegable: false,
        templateId: eServiceTemplate.id,
        personalData: eServiceTemplate.personalData,
        asyncExchange: eServiceTemplate.asyncExchange,
        ...(expectedParsedInstanceLabel !== undefined
          ? { instanceLabel: expectedParsedInstanceLabel }
          : {}),
        descriptors: [
          {
            ...mockDescriptor,
            description: publishedVersion.description,
            id: eService.descriptors[0].id,
            createdAt: new Date(),
            serverUrls: [],
            audience: [],
            dailyCallsPerConsumer: publishedVersion?.dailyCallsPerConsumer ?? 1,
            dailyCallsTotal: publishedVersion?.dailyCallsTotal ?? 1,
            templateVersionRef: { id: publishedVersion.id },
          },
        ],
      };

      expect(eServiceCreationPayload.eservice).toEqual(
        toEServiceV2(expectedEService)
      );
      expect(descriptorCreationPayload.eservice).toEqual(
        toEServiceV2(expectedEServiceWithDescriptor)
      );
    }
  );

  it("should write on event-store for the creation of an eService in RECEIVE mode from a template when user is a PA", async () => {
    const tenant: Tenant = {
      ...getMockTenant(mockEService.producerId),
      id: mockEService.producerId,
      kind: tenantKind.PA,
    };

    const validEServiceTemplateRiskAnalysisPA1 =
      getMockValidEServiceTemplateRiskAnalysis(tenantKind.PA);
    const validEServiceTemplateRiskAnalysisPA2 =
      getMockValidEServiceTemplateRiskAnalysis(tenantKind.PA);
    const validEServiceTemplateRiskAnalysisPrivate =
      getMockValidEServiceTemplateRiskAnalysis(tenantKind.PRIVATE);

    const publishedVersion: EServiceTemplateVersion = {
      ...getMockEServiceTemplateVersion(),
      state: eserviceTemplateVersionState.published,
    };

    const eserviceTemplate: EServiceTemplate = {
      ...getMockEServiceTemplate(),
      mode: eserviceMode.receive,
      riskAnalysis: [
        validEServiceTemplateRiskAnalysisPA1,
        validEServiceTemplateRiskAnalysisPA2,
        validEServiceTemplateRiskAnalysisPrivate,
      ],
      versions: [publishedVersion],
      personalData: false,
      asyncExchange: true,
    };

    await addOneTenant(tenant);
    await addOneEServiceTemplate(eserviceTemplate);

    const result = await catalogService.createEServiceInstanceFromTemplate(
      eserviceTemplate.id,
      {},
      getMockContext({ authData: getMockAuthData(mockEService.producerId) })
    );

    const { tenantKind: _tenantKind, ...validRiskAnalysisPA1 } =
      validEServiceTemplateRiskAnalysisPA1;
    const { tenantKind: _tenantKind2, ...validRiskAnalysisPA2 } =
      validEServiceTemplateRiskAnalysisPA2;

    const expectedEServiceWithDescriptor: EService = {
      ...mockEService,
      description: eserviceTemplate.description,
      name: eserviceTemplate.name,
      mode: eserviceMode.receive,
      createdAt: new Date(),
      id: result.id,
      isSignalHubEnabled: result.isSignalHubEnabled,
      isClientAccessDelegable: false,
      isConsumerDelegable: false,
      templateId: eserviceTemplate.id,
      riskAnalysis: [validRiskAnalysisPA1, validRiskAnalysisPA2],
      personalData: eserviceTemplate.personalData,
      asyncExchange: undefined,
      descriptors: [
        {
          ...mockDescriptor,
          description: publishedVersion.description,
          id: result.descriptors[0].id,
          createdAt: new Date(),
          serverUrls: [],
          audience: [],
          dailyCallsPerConsumer: publishedVersion?.dailyCallsPerConsumer ?? 1,
          dailyCallsTotal: publishedVersion?.dailyCallsTotal ?? 1,
          templateVersionRef: { id: publishedVersion.id },
        },
      ],
    };

    expect(result).toEqual(expectedEServiceWithDescriptor);
  });

  it("should write on event-store for the creation of an eService in RECEIVE mode from a template when user has kind Private", async () => {
    const tenant: Tenant = {
      ...getMockTenant(mockEService.producerId),
      id: mockEService.producerId,
      kind: tenantKind.PRIVATE,
    };

    const validEServiceTemplateRiskAnalysisPA1 =
      getMockValidEServiceTemplateRiskAnalysis(tenantKind.PA);
    const validEServiceTemplateRiskAnalysisPA2 =
      getMockValidEServiceTemplateRiskAnalysis(tenantKind.PA);
    const validEServiceTemplateRiskAnalysisPrivate =
      getMockValidEServiceTemplateRiskAnalysis(tenantKind.PRIVATE);

    const publishedVersion: EServiceTemplateVersion = {
      ...getMockEServiceTemplateVersion(),
      state: eserviceTemplateVersionState.published,
    };

    const eserviceTemplate: EServiceTemplate = {
      ...getMockEServiceTemplate(),
      mode: eserviceMode.receive,
      riskAnalysis: [
        validEServiceTemplateRiskAnalysisPA1,
        validEServiceTemplateRiskAnalysisPA2,
        validEServiceTemplateRiskAnalysisPrivate,
      ],
      versions: [publishedVersion],
      personalData: false,
      asyncExchange: true,
    };

    await addOneTenant(tenant);
    await addOneEServiceTemplate(eserviceTemplate);

    const result = await catalogService.createEServiceInstanceFromTemplate(
      eserviceTemplate.id,
      {},
      getMockContext({ authData: getMockAuthData(mockEService.producerId) })
    );

    const { tenantKind: _tenantKind, ...validRiskAnalysisPrivate } =
      validEServiceTemplateRiskAnalysisPrivate;

    const expectedEServiceWithDescriptor: EService = {
      ...mockEService,
      description: eserviceTemplate.description,
      name: eserviceTemplate.name,
      mode: eserviceMode.receive,
      createdAt: new Date(),
      id: result.id,
      isSignalHubEnabled: result.isSignalHubEnabled,
      isClientAccessDelegable: false,
      isConsumerDelegable: false,
      templateId: eserviceTemplate.id,
      riskAnalysis: [validRiskAnalysisPrivate],
      personalData: eserviceTemplate.personalData,
      asyncExchange: undefined,
      descriptors: [
        {
          ...mockDescriptor,
          description: publishedVersion.description,
          id: result.descriptors[0].id,
          createdAt: new Date(),
          serverUrls: [],
          audience: [],
          dailyCallsPerConsumer: publishedVersion?.dailyCallsPerConsumer ?? 1,
          dailyCallsTotal: publishedVersion?.dailyCallsTotal ?? 1,
          templateVersionRef: { id: publishedVersion.id },
        },
      ],
    };

    expect(result).toEqual(expectedEServiceWithDescriptor);
  });

  it("should write on event-store for the creation of an eService from a template with documents", async () => {
    vi.spyOn(fileManager, "copy");

    const documentId1 = generateId<EServiceDocumentId>();
    const documentId2 = generateId<EServiceDocumentId>();

    const document1 = {
      ...mockDocument,
      id: documentId1,
      name: `${mockDocument.name}_1`,
      prettyName: `${mockDocument.prettyName}_1`,
      path: `${config.eserviceDocumentsPath}/${documentId1}/${mockDocument.name}_1`,
      checksum: "checksum1",
    };
    const document2 = {
      ...mockDocument,
      id: documentId2,
      name: `${mockDocument.name}_2`,
      prettyName: `${mockDocument.prettyName}_2`,
      path: `${config.eserviceDocumentsPath}/${documentId2}/${mockDocument.name}_2`,
      checksum: "checksum2",
    };

    const eserviceTemplatePublishedVersionId =
      generateId<EServiceTemplateVersionId>();
    const eserviceTemplatePublishedVersion: EServiceTemplateVersion = {
      ...getMockEServiceTemplateVersion(
        eserviceTemplatePublishedVersionId,
        eserviceTemplateVersionState.published
      ),
      docs: [document1, document2],
    };
    const eServiceTemplate: EServiceTemplate = {
      ...mockEServiceTemplate,
      versions: [eserviceTemplatePublishedVersion],
      personalData: false,
      asyncExchange: true,
    };

    const tenant: Tenant = {
      ...getMockTenant(mockEService.producerId),
      kind: tenantKind.PA,
    };
    await addOneTenant(tenant);
    await addOneEServiceTemplate(eServiceTemplate);

    await fileManager.storeBytes(
      {
        bucket: config.s3Bucket,
        path: config.eserviceDocumentsPath,
        resourceId: document1.id,
        name: document1.name,
        content: Buffer.from("testtest"),
      },
      genericLogger
    );

    await fileManager.storeBytes(
      {
        bucket: config.s3Bucket,
        path: config.eserviceDocumentsPath,
        resourceId: document2.id,
        name: document2.name,
        content: Buffer.from("testtest"),
      },
      genericLogger
    );

    expect(
      await fileManager.listFiles(config.s3Bucket, genericLogger)
    ).toContain(document1.path);
    expect(
      await fileManager.listFiles(config.s3Bucket, genericLogger)
    ).toContain(document2.path);

    const eService = await catalogService.createEServiceInstanceFromTemplate(
      eServiceTemplate.id,
      {},
      getMockContext({ authData: getMockAuthData(mockEService.producerId) })
    );

    expect(eService).toBeDefined();

    const eServiceCreationEvent = await readEventByStreamIdAndVersion(
      eService.id,
      0,
      "catalog",
      postgresDB
    );

    const eServiceDescriptorCreationEvent = await readEventByStreamIdAndVersion(
      eService.id,
      1,
      "catalog",
      postgresDB
    );

    const eServiceDocument1CreationEvent = await readEventByStreamIdAndVersion(
      eService.id,
      2,
      "catalog",
      postgresDB
    );

    const eServiceDocument2CreationEvent = await readEventByStreamIdAndVersion(
      eService.id,
      3,
      "catalog",
      postgresDB
    );

    expect(eServiceCreationEvent).toMatchObject({
      stream_id: eService.id,
      version: "0",
      type: "EServiceAdded",
      event_version: 2,
    });
    expect(eServiceDescriptorCreationEvent).toMatchObject({
      stream_id: eService.id,
      version: "1",
      type: "EServiceDescriptorAdded",
      event_version: 2,
    });
    expect(eServiceDocument1CreationEvent).toMatchObject({
      stream_id: eService.id,
      version: "2",
      type: "EServiceDescriptorDocumentAdded",
      event_version: 2,
    });
    expect(eServiceDocument2CreationEvent).toMatchObject({
      stream_id: eService.id,
      version: "3",
      type: "EServiceDescriptorDocumentAdded",
      event_version: 2,
    });

    const actualEServiceCreation = decodeProtobufPayload({
      messageType: EServiceAddedV2,
      payload: eServiceCreationEvent.data,
    }).eservice;
    const actualDescriptorCreation = decodeProtobufPayload({
      messageType: EServiceDescriptorAddedV2,
      payload: eServiceDescriptorCreationEvent.data,
    }).eservice;
    const actualEServiceDocument1Creation = decodeProtobufPayload({
      messageType: EServiceDescriptorDocumentAddedV2,
      payload: eServiceDocument1CreationEvent.data,
    }).eservice;
    const actualEServiceDocument2Creation = decodeProtobufPayload({
      messageType: EServiceDescriptorDocumentAddedV2,
      payload: eServiceDocument2CreationEvent.data,
    });

    const expectedEServiceWithDescriptor: EService = {
      ...mockEService,
      description: eServiceTemplate.description,
      name: eServiceTemplate.name,
      createdAt: new Date(),
      id: eService.id,
      isSignalHubEnabled: eService.isSignalHubEnabled,
      isClientAccessDelegable: false,
      isConsumerDelegable: false,
      templateId: eServiceTemplate.id,
      personalData: eServiceTemplate.personalData,
      asyncExchange: eServiceTemplate.asyncExchange,
      descriptors: [
        {
          ...mockDescriptor,
          description: eserviceTemplatePublishedVersion.description,
          id: eService.descriptors[0].id,
          createdAt: new Date(),
          serverUrls: [],
          audience: [],
          dailyCallsPerConsumer:
            eserviceTemplatePublishedVersion?.dailyCallsPerConsumer ?? 1,
          dailyCallsTotal:
            eserviceTemplatePublishedVersion?.dailyCallsTotal ?? 1,
          templateVersionRef: { id: eserviceTemplatePublishedVersion.id },
        },
      ],
    };

    const expectedDocument1: Document = {
      ...document1,
      id: unsafeBrandId(
        actualEServiceDocument1Creation?.descriptors[0]?.docs[0]?.id ?? ""
      ),
      uploadDate: new Date(
        actualEServiceDocument1Creation?.descriptors[0]?.docs[0]?.uploadDate ??
          Date.now()
      ),
      path:
        actualEServiceDocument1Creation?.descriptors[0]?.docs[0]?.path ?? "",
    };

    const expectedDocument2: Document = {
      ...document2,
      id: unsafeBrandId(
        actualEServiceDocument2Creation.eservice?.descriptors[0]?.docs[1]?.id ??
          ""
      ),
      uploadDate: new Date(
        actualEServiceDocument2Creation.eservice?.descriptors[0]?.docs[1]
          ?.uploadDate ?? Date.now()
      ),
      path:
        actualEServiceDocument2Creation.eservice?.descriptors[0]?.docs[1]
          ?.path ?? "",
    };

    expect(actualEServiceCreation).toEqual(
      toEServiceV2({
        ...expectedEServiceWithDescriptor,
        descriptors: [],
      })
    );
    expect(actualDescriptorCreation).toEqual(
      toEServiceV2(expectedEServiceWithDescriptor)
    );

    const expectedEventStoredDocument1 = toEServiceV2({
      ...expectedEServiceWithDescriptor,
      descriptors: [
        {
          ...expectedEServiceWithDescriptor.descriptors[0],
          docs: [expectedDocument1],
        },
      ],
    });

    expect(actualEServiceDocument1Creation).toEqual(
      expectedEventStoredDocument1
    );

    expect(actualEServiceDocument2Creation.eservice).toEqual(
      toEServiceV2({
        ...expectedEServiceWithDescriptor,
        descriptors: [
          {
            ...expectedEServiceWithDescriptor.descriptors[0],
            docs: [expectedDocument1, expectedDocument2],
          },
        ],
      })
    );

    expect(fileManager.copy).toHaveBeenCalledWith(
      config.s3Bucket,
      document1.path,
      config.eserviceDocumentsPath,
      expectedDocument1.id,
      expectedDocument1.name,
      genericLogger
    );
    expect(fileManager.copy).toHaveBeenCalledWith(
      config.s3Bucket,
      document2.path,
      config.eserviceDocumentsPath,
      expectedDocument2.id,
      expectedDocument2.name,
      genericLogger
    );

    expect(
      await fileManager.listFiles(config.s3Bucket, genericLogger)
    ).toContain(expectedDocument1.path);
    expect(
      await fileManager.listFiles(config.s3Bucket, genericLogger)
    ).toContain(expectedDocument2.path);
  });

  it("should throw templateMissingRequiredRiskAnalysis when the template is in receive mode and there are no risk analysis of the requester tenant kind", async () => {
    const tenant: Tenant = {
      ...getMockTenant(mockEService.producerId),
      id: mockEService.producerId,
      kind: tenantKind.PA,
    };

    const validRiskAnalysis = getMockValidEServiceTemplateRiskAnalysis(
      tenantKind.PRIVATE
    );

    const publishedVersion: EServiceTemplateVersion = {
      ...getMockEServiceTemplateVersion(),
      state: eserviceTemplateVersionState.published,
    };

    const eserviceTemplate: EServiceTemplate = {
      ...getMockEServiceTemplate(),
      mode: eserviceMode.receive,
      riskAnalysis: [validRiskAnalysis],
      versions: [publishedVersion],
    };

    await addOneTenant(tenant);
    await addOneEServiceTemplate(eserviceTemplate);

    await expect(
      catalogService.createEServiceInstanceFromTemplate(
        eserviceTemplate.id,
        {},
        getMockContext({ authData: getMockAuthData(mockEService.producerId) })
      )
    ).rejects.toMatchObject({
      code: "templateMissingRequiredRiskAnalysis",
    });
  });

  it("should throw eServiceTemplateNotFound when the template does not exist", async () => {
    await expect(
      catalogService.createEServiceInstanceFromTemplate(
        generateId(),
        {},
        getMockContext({ authData: getMockAuthData(mockEService.producerId) })
      )
    ).rejects.toMatchObject({
      code: "eServiceTemplateNotFound",
    });
  });
  it("should throw eServiceTemplateWithoutPublishedVersion when the template does not have a published version", async () => {
    const eServiceTemplate: EServiceTemplate = {
      ...mockEServiceTemplate,
      versions: [],
    };

    await addOneEServiceTemplate(eServiceTemplate);

    await expect(
      catalogService.createEServiceInstanceFromTemplate(
        eServiceTemplate.id,
        {},
        getMockContext({ authData: getMockAuthData(mockEService.producerId) })
      )
    ).rejects.toMatchObject({
      code: "eServiceTemplateWithoutPublishedVersion",
    });
  });

  it("should throw eServiceTemplateWithoutPersonalDataFlag when the template has no personalData flag and the feature flag is enabled", async () => {
    const publishedVersion: EServiceTemplateVersion = {
      ...getMockEServiceTemplateVersion(),
      state: eserviceTemplateVersionState.published,
    };
    const eServiceTemplate: EServiceTemplate = {
      ...mockEServiceTemplate,
      versions: [publishedVersion],
    };

    const tenant: Tenant = {
      ...getMockTenant(mockEService.producerId),
      kind: tenantKind.PA,
    };

    await addOneTenant(tenant);
    await addOneEServiceTemplate(eServiceTemplate);

    await expect(
      catalogService.createEServiceInstanceFromTemplate(
        eServiceTemplate.id,
        {},
        getMockContext({ authData: getMockAuthData(tenant.id) })
      )
    ).rejects.toMatchObject({
      code: "eServiceTemplateWithoutPersonalDataFlag",
    });
  });

  it("should throw templateVersionMissingAsyncExchangeProperties when the template is async but published version has no asyncExchangeProperties", async () => {
    const publishedVersion: EServiceTemplateVersion = {
      ...getMockEServiceTemplateVersion(),
      state: eserviceTemplateVersionState.published,
    };
    const eServiceTemplate: EServiceTemplate = {
      ...mockEServiceTemplate,
      versions: [publishedVersion],
      personalData: false,
      asyncExchange: true,
    };

    const tenant: Tenant = {
      ...getMockTenant(mockEService.producerId),
      kind: tenantKind.PA,
    };

    await addOneTenant(tenant);
    await addOneEServiceTemplate(eServiceTemplate);

    await expect(
      catalogService.createEServiceInstanceFromTemplate(
        eServiceTemplate.id,
        {},
        getMockContext({ authData: getMockAuthData(tenant.id) })
      )
    ).rejects.toMatchObject({
      code: "templateVersionMissingAsyncExchangeProperties",
    });
  });

  it.each([
    {
      existingLabel: undefined,
      requestedLabel: undefined,
      description: "undefined (no label) already in use",
    },
    {
      existingLabel: "istanza 0001",
      requestedLabel: "istanza 0001",
      description: '"istanza 0001" already in use',
    },
  ])(
    "should throw eServiceNameDuplicateForProducer when the requested instanceLabel is $description",
    async ({ existingLabel, requestedLabel }) => {
      const publishedVersion: EServiceTemplateVersion = {
        ...getMockEServiceTemplateVersion(),
        state: eserviceTemplateVersionState.published,
      };
      const eServiceTemplate: EServiceTemplate = {
        ...mockEServiceTemplate,
        versions: [publishedVersion],
        personalData: false,
      };

      await addOneEServiceTemplate(eServiceTemplate);

      const mock = getMockEService(
        undefined,
        mockEService.producerId,
        [],
        eServiceTemplate.id
      );
      const existingInstance: EService =
        existingLabel === undefined
          ? { ...mock, name: eServiceTemplate.name, instanceLabel: undefined }
          : {
              ...mock,
              name: `${eServiceTemplate.name} - ${existingLabel}`,
              instanceLabel: existingLabel,
            };
      await addOneEService(existingInstance);

      const expectedName =
        requestedLabel === undefined
          ? eServiceTemplate.name
          : `${eServiceTemplate.name} - ${requestedLabel}`;

      await expect(
        catalogService.createEServiceInstanceFromTemplate(
          eServiceTemplate.id,
          { instanceLabel: requestedLabel },
          getMockContext({ authData: getMockAuthData(mockEService.producerId) })
        )
      ).rejects.toThrowError(
        eServiceNameDuplicateForProducer(expectedName, mockEService.producerId)
      );
    }
  );

  it("should copy asyncExchangeProperties from template to instance descriptor", async () => {
    const publishedVersion: EServiceTemplateVersion = {
      ...getMockEServiceTemplateVersion(),
      state: eserviceTemplateVersionState.published,
      asyncExchangeProperties: {
        responseTime: 3600,
        resourceAvailableTime: 7200,
        confirmation: true,
        bulk: false,
        maxResultSet: 1000,
      },
    };
    const eServiceTemplate: EServiceTemplate = {
      ...mockEServiceTemplate,
      versions: [publishedVersion],
      personalData: false,
      asyncExchange: true,
    };

    const tenant: Tenant = {
      ...getMockTenant(mockEService.producerId),
      kind: tenantKind.PA,
    };

    await addOneTenant(tenant);
    await addOneEServiceTemplate(eServiceTemplate);

    const eService = await catalogService.createEServiceInstanceFromTemplate(
      eServiceTemplate.id,
      {},
      getMockContext({ authData: getMockAuthData(mockEService.producerId) })
    );

    expect(eService).toBeDefined();

    const descriptorCreationEvent = await readEventByStreamIdAndVersion(
      eService.id,
      1,
      "catalog",
      postgresDB
    );

    expect(descriptorCreationEvent).toMatchObject({
      stream_id: eService.id,
      version: "1",
      type: "EServiceDescriptorAdded",
      event_version: 2,
    });

    const descriptorCreationPayload = decodeProtobufPayload({
      messageType: EServiceDescriptorAddedV2,
      payload: descriptorCreationEvent.data,
    });

    const createdDescriptor =
      descriptorCreationPayload.eservice?.descriptors[0];
    expect(createdDescriptor).toBeDefined();
    expect(createdDescriptor?.asyncExchangeProperties).toEqual({
      responseTime: 3600,
      resourceAvailableTime: 7200,
      confirmation: true,
      bulk: false,
      maxResultSet: 1000,
    });
  });

  it("should allow overriding modifiable asyncExchangeProperties fields when creating instance from template", async () => {
    const publishedVersion: EServiceTemplateVersion = {
      ...getMockEServiceTemplateVersion(),
      state: eserviceTemplateVersionState.published,
      asyncExchangeProperties: {
        responseTime: 3600,
        resourceAvailableTime: 7200,
        confirmation: true,
        bulk: false,
        maxResultSet: 1000,
      },
    };
    const eServiceTemplate: EServiceTemplate = {
      ...mockEServiceTemplate,
      versions: [publishedVersion],
      personalData: false,
      asyncExchange: true,
    };

    const tenant: Tenant = {
      ...getMockTenant(mockEService.producerId),
      kind: tenantKind.PA,
    };

    await addOneTenant(tenant);
    await addOneEServiceTemplate(eServiceTemplate);

    const eService = await catalogService.createEServiceInstanceFromTemplate(
      eServiceTemplate.id,
      {
        asyncExchangeResponseTime: 1800,
        asyncExchangeResourceAvailableTime: 3600,
        asyncExchangeMaxResultSet: 500,
      },
      getMockContext({ authData: getMockAuthData(mockEService.producerId) })
    );

    expect(eService).toBeDefined();

    const descriptorCreationEvent = await readEventByStreamIdAndVersion(
      eService.id,
      1,
      "catalog",
      postgresDB
    );

    const descriptorCreationPayload = decodeProtobufPayload({
      messageType: EServiceDescriptorAddedV2,
      payload: descriptorCreationEvent.data,
    });

    const createdDescriptor =
      descriptorCreationPayload.eservice?.descriptors[0];
    expect(createdDescriptor).toBeDefined();
    expect(createdDescriptor?.asyncExchangeProperties).toEqual({
      responseTime: 1800,
      resourceAvailableTime: 3600,
      confirmation: true,
      bulk: false,
      maxResultSet: 500,
    });
  });

  it("should use template values for asyncExchangeProperties fields not provided in the seed", async () => {
    const publishedVersion: EServiceTemplateVersion = {
      ...getMockEServiceTemplateVersion(),
      state: eserviceTemplateVersionState.published,
      asyncExchangeProperties: {
        responseTime: 3600,
        resourceAvailableTime: 7200,
        confirmation: true,
        bulk: false,
        maxResultSet: 1000,
      },
    };
    const eServiceTemplate: EServiceTemplate = {
      ...mockEServiceTemplate,
      versions: [publishedVersion],
      personalData: false,
      asyncExchange: true,
    };

    const tenant: Tenant = {
      ...getMockTenant(mockEService.producerId),
      kind: tenantKind.PA,
    };

    await addOneTenant(tenant);
    await addOneEServiceTemplate(eServiceTemplate);

    const eService = await catalogService.createEServiceInstanceFromTemplate(
      eServiceTemplate.id,
      { asyncExchangeResponseTime: 900 },
      getMockContext({ authData: getMockAuthData(mockEService.producerId) })
    );

    expect(eService).toBeDefined();

    const descriptorCreationEvent = await readEventByStreamIdAndVersion(
      eService.id,
      1,
      "catalog",
      postgresDB
    );

    const descriptorCreationPayload = decodeProtobufPayload({
      messageType: EServiceDescriptorAddedV2,
      payload: descriptorCreationEvent.data,
    });

    const createdDescriptor =
      descriptorCreationPayload.eservice?.descriptors[0];
    expect(createdDescriptor).toBeDefined();
    expect(createdDescriptor?.asyncExchangeProperties).toEqual({
      responseTime: 900,
      resourceAvailableTime: 7200,
      confirmation: true,
      bulk: false,
      maxResultSet: 1000,
    });
  });

  it("should ignore asyncExchange override fields when featureFlagAsyncExchange is disabled", async () => {
    config.featureFlagAsyncExchange = false;

    const publishedVersion: EServiceTemplateVersion = {
      ...getMockEServiceTemplateVersion(),
      state: eserviceTemplateVersionState.published,
      asyncExchangeProperties: {
        responseTime: 3600,
        resourceAvailableTime: 7200,
        confirmation: true,
        bulk: false,
        maxResultSet: 1000,
      },
    };
    const eServiceTemplate: EServiceTemplate = {
      ...mockEServiceTemplate,
      versions: [publishedVersion],
      personalData: false,
      asyncExchange: true,
    };

    const tenant: Tenant = {
      ...getMockTenant(mockEService.producerId),
      kind: tenantKind.PA,
    };

    await addOneTenant(tenant);
    await addOneEServiceTemplate(eServiceTemplate);

    const eService = await catalogService.createEServiceInstanceFromTemplate(
      eServiceTemplate.id,
      {
        asyncExchangeResponseTime: 900,
        asyncExchangeResourceAvailableTime: 1800,
        asyncExchangeMaxResultSet: 500,
      },
      getMockContext({ authData: getMockAuthData(mockEService.producerId) })
    );

    expect(eService).toBeDefined();
    expect(eService.asyncExchange).toBeUndefined();

    const descriptorCreationEvent = await readEventByStreamIdAndVersion(
      eService.id,
      1,
      "catalog",
      postgresDB
    );

    const descriptorCreationPayload = decodeProtobufPayload({
      messageType: EServiceDescriptorAddedV2,
      payload: descriptorCreationEvent.data,
    });

    const createdDescriptor =
      descriptorCreationPayload.eservice?.descriptors[0];
    expect(createdDescriptor).toBeDefined();
    expect(createdDescriptor?.asyncExchangeProperties).toBeUndefined();

    config.featureFlagAsyncExchange = true;
  });

  it("should copy asyncExchangeCallbackInterface from template to instance descriptor", async () => {
    vi.spyOn(fileManager, "copy");

    const callbackDocId = generateId<EServiceDocumentId>();
    const callbackDoc: Document = {
      ...mockDocument,
      id: unsafeBrandId(callbackDocId),
      name: "callback.yaml",
      prettyName: "Callback Interface",
      path: `${config.eserviceDocumentsPath}/${callbackDocId}/callback.yaml`,
      checksum: "callback-checksum",
    };

    const publishedVersion: EServiceTemplateVersion = {
      ...getMockEServiceTemplateVersion(),
      state: eserviceTemplateVersionState.published,
      asyncExchangeCallbackInterface: callbackDoc,
      asyncExchangeProperties: {
        responseTime: 3600,
        resourceAvailableTime: 7200,
        confirmation: true,
        bulk: false,
        maxResultSet: 1000,
      },
    };
    const eServiceTemplate: EServiceTemplate = {
      ...mockEServiceTemplate,
      versions: [publishedVersion],
      personalData: false,
      asyncExchange: true,
    };

    const tenant: Tenant = {
      ...getMockTenant(mockEService.producerId),
      kind: tenantKind.PA,
    };

    await addOneTenant(tenant);
    await addOneEServiceTemplate(eServiceTemplate);

    await fileManager.storeBytes(
      {
        bucket: config.s3Bucket,
        path: config.eserviceDocumentsPath,
        resourceId: callbackDoc.id,
        name: callbackDoc.name,
        content: Buffer.from("callback-content"),
      },
      genericLogger
    );

    const eService = await catalogService.createEServiceInstanceFromTemplate(
      eServiceTemplate.id,
      {},
      getMockContext({ authData: getMockAuthData(mockEService.producerId) })
    );

    expect(eService).toBeDefined();

    // Events: 0=EServiceAdded, 1=EServiceDescriptorAdded, 2=AsyncExchangeCallbackInterfaceAdded
    const callbackInterfaceEvent = await readEventByStreamIdAndVersion(
      eService.id,
      2,
      "catalog",
      postgresDB
    );

    expect(callbackInterfaceEvent).toMatchObject({
      stream_id: eService.id,
      version: "2",
      type: "EServiceDescriptorAsyncExchangeCallbackInterfaceAdded",
      event_version: 2,
    });

    const callbackPayload = decodeProtobufPayload({
      messageType: EServiceDescriptorAsyncExchangeCallbackInterfaceAddedV2,
      payload: callbackInterfaceEvent.data,
    });

    const copiedCallbackInterface =
      callbackPayload.eservice?.descriptors[0]?.asyncExchangeCallbackInterface;
    expect(copiedCallbackInterface).toBeDefined();
    expect(copiedCallbackInterface?.name).toEqual(callbackDoc.name);
    expect(copiedCallbackInterface?.prettyName).toEqual(callbackDoc.prettyName);
    expect(copiedCallbackInterface?.contentType).toEqual(
      callbackDoc.contentType
    );
    expect(copiedCallbackInterface?.checksum).toEqual(callbackDoc.checksum);

    // Verify fileManager.copy was called for the callback interface
    expect(fileManager.copy).toHaveBeenCalledWith(
      config.s3Bucket,
      callbackDoc.path,
      config.eserviceDocumentsPath,
      expect.any(String),
      callbackDoc.name,
      genericLogger
    );
  });

  // Skipped: depends on PIN-9415 (asyncExchangeProperties in descriptor)
  it.skip("should not copy asyncExchangeCallbackInterface when featureFlagAsyncExchange is disabled", async () => {
    config.featureFlagAsyncExchange = false;

    vi.spyOn(fileManager, "copy");

    const callbackDocId = generateId<EServiceDocumentId>();
    const callbackDoc: Document = {
      ...mockDocument,
      id: unsafeBrandId(callbackDocId),
      name: "callback.yaml",
      prettyName: "Callback Interface",
      path: `${config.eserviceDocumentsPath}/${callbackDocId}/callback.yaml`,
      checksum: "callback-checksum",
    };

    const publishedVersion: EServiceTemplateVersion = {
      ...getMockEServiceTemplateVersion(),
      state: eserviceTemplateVersionState.published,
      asyncExchangeCallbackInterface: callbackDoc,
    };
    const eServiceTemplate: EServiceTemplate = {
      ...mockEServiceTemplate,
      versions: [publishedVersion],
      personalData: false,
      asyncExchange: true,
    };

    const tenant: Tenant = {
      ...getMockTenant(mockEService.producerId),
      kind: tenantKind.PA,
    };

    await addOneTenant(tenant);
    await addOneEServiceTemplate(eServiceTemplate);

    await fileManager.storeBytes(
      {
        bucket: config.s3Bucket,
        path: config.eserviceDocumentsPath,
        resourceId: callbackDoc.id,
        name: callbackDoc.name,
        content: Buffer.from("callback-content"),
      },
      genericLogger
    );

    const eService = await catalogService.createEServiceInstanceFromTemplate(
      eServiceTemplate.id,
      {},
      getMockContext({ authData: getMockAuthData(mockEService.producerId) })
    );

    expect(eService).toBeDefined();
    expect(eService.asyncExchange).toBeUndefined();

    // Only 2 events should exist: EServiceAdded and EServiceDescriptorAdded
    // No EServiceDescriptorAsyncExchangeCallbackInterfaceAdded event
    const lastEvent = await readLastEserviceEvent(eService.id);
    expect(lastEvent).toMatchObject({
      stream_id: eService.id,
      version: "1",
      type: "EServiceDescriptorAdded",
    });

    // fileManager.copy should not have been called for the callback interface
    expect(fileManager.copy).not.toHaveBeenCalled();

    config.featureFlagAsyncExchange = true;
  });
});
