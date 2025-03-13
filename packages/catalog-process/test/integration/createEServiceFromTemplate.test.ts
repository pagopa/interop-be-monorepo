import { afterAll, beforeAll, describe, vi, it, expect } from "vitest";
import {
  decodeProtobufPayload,
  getMockEServiceTemplate,
  getMockEServiceTemplateVersion,
  readEventByStreamIdAndVersion,
} from "pagopa-interop-commons-test";
import { genericLogger } from "pagopa-interop-commons";
import {
  Document,
  EService,
  EServiceAddedV2,
  EServiceDescriptorAddedV2,
  EServiceDescriptorDocumentAddedV2,
  EServiceTemplate,
  EServiceTemplateVersion,
  EServiceTemplateVersionId,
  eserviceTemplateVersionState,
  generateId,
  toEServiceV2,
  unsafeBrandId,
} from "pagopa-interop-models";
import { config } from "../../src/config/config.js";
import {
  catalogService,
  getMockEService,
  getMockAuthData,
  postgresDB,
  readLastEserviceEvent,
  getMockDescriptor,
  addOneEServiceTemplate,
  fileManager,
  getMockDocument,
} from "../utils.js";

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
    };

    await addOneEServiceTemplate(eServiceTemplate);

    const eService = await catalogService.createEServiceInstanceFromTemplate(
      eServiceTemplate.id,
      { instanceLabel: undefined },
      {
        authData: getMockAuthData(mockEService.producerId),
        correlationId: generateId(),
        serviceName: "",
        logger: genericLogger,
      }
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
      templateRef: {
        id: eServiceTemplate.id,
        instanceLabel: eService?.templateRef?.instanceLabel,
      },
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
      templateRef: { id: eServiceTemplate.id },
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
  it("should write on event-store for the creation of an eService from a template with a custom instanceLabel", async () => {
    const instanceLabel = generateId();

    const publishedVersion: EServiceTemplateVersion = {
      ...getMockEServiceTemplateVersion(),
      state: eserviceTemplateVersionState.published,
    };
    const eServiceTemplate: EServiceTemplate = {
      ...mockEServiceTemplate,
      versions: [publishedVersion],
    };

    await addOneEServiceTemplate(eServiceTemplate);

    const eService = await catalogService.createEServiceInstanceFromTemplate(
      eServiceTemplate.id,
      { instanceLabel },
      {
        authData: getMockAuthData(mockEService.producerId),
        correlationId: generateId(),
        serviceName: "",
        logger: genericLogger,
      }
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
      name: `${eServiceTemplate.name} ${instanceLabel}`,
      createdAt: eService.createdAt,
      id: eService.id,
      isSignalHubEnabled: eService.isSignalHubEnabled,
      isClientAccessDelegable: false,
      isConsumerDelegable: false,
      descriptors: [],
      templateRef: { id: eServiceTemplate.id, instanceLabel },
    };

    const expectedEServiceWithDescriptor: EService = {
      ...mockEService,
      description: eServiceTemplate.description,
      name: `${eServiceTemplate.name} ${instanceLabel}`,
      createdAt: new Date(),
      id: eService.id,
      isSignalHubEnabled: eService.isSignalHubEnabled,
      isClientAccessDelegable: false,
      isConsumerDelegable: false,
      templateRef: { id: eServiceTemplate.id, instanceLabel },
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
  it("should write on event-store for the creation of an eService from a template with documents", async () => {
    vi.spyOn(fileManager, "copy");

    const document1 = {
      ...mockDocument,
      name: `${mockDocument.name}_1`,
      prettyName: `${mockDocument.prettyName}_1`,
      path: `${config.eserviceDocumentsPath}/${mockDocument.id}/${mockDocument.name}_1`,
    };
    const document2 = {
      ...mockDocument,
      name: `${mockDocument.name}_2`,
      prettyName: `${mockDocument.prettyName}_2`,
      path: `${config.eserviceDocumentsPath}/${mockDocument.id}/${mockDocument.name}_2`,
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
    };

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
      { instanceLabel: undefined },
      {
        authData: getMockAuthData(mockEService.producerId),
        correlationId: generateId(),
        serviceName: "",
        logger: genericLogger,
      }
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
      templateRef: { id: eServiceTemplate.id },
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
  it("should throw eServiceTemplateNotFound when the template does not exist", async () => {
    await expect(
      catalogService.createEServiceInstanceFromTemplate(
        generateId(),
        { instanceLabel: undefined },
        {
          authData: getMockAuthData(mockEService.producerId),
          correlationId: generateId(),
          serviceName: "",
          logger: genericLogger,
        }
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
        { instanceLabel: undefined },
        {
          authData: getMockAuthData(mockEService.producerId),
          correlationId: generateId(),
          serviceName: "",
          logger: genericLogger,
        }
      )
    ).rejects.toMatchObject({
      code: "eServiceTemplateWithoutPublishedVersion",
    });
  });
});
