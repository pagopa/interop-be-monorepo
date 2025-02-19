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
  eserviceTemplateVersionState,
  generateId,
  toEServiceV2,
  unsafeBrandId,
} from "pagopa-interop-models";
import { config } from "../src/config/config.js";
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
} from "./utils.js";

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
      { instanceId: undefined },
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
      description: eServiceTemplate.eserviceDescription,
      name: eServiceTemplate.name,
      createdAt: eService.createdAt,
      id: eService.id,
      isSignalHubEnabled: eService.isSignalHubEnabled,
      isConsumerDelegable: false,
      isClientAccessDelegable: false,
      templateId: eServiceTemplate.id,
      instanceId: eService.instanceId,
    };

    const expectedEServiceWithDescriptor: EService = {
      ...mockEService,
      description: eServiceTemplate.eserviceDescription,
      name: eServiceTemplate.name,
      createdAt: new Date(),
      id: eService.id,
      isSignalHubEnabled: eService.isSignalHubEnabled,
      isClientAccessDelegable: false,
      isConsumerDelegable: false,
      templateId: eServiceTemplate.id,
      descriptors: [
        {
          ...mockDescriptor,
          description: publishedVersion.description,
          id: eService.descriptors[0].id,
          createdAt: new Date(),
          serverUrls: [],
          audience: [eServiceTemplate.audienceDescription],
          dailyCallsPerConsumer: publishedVersion?.dailyCallsPerConsumer ?? 1,
          dailyCallsTotal: publishedVersion?.dailyCallsTotal ?? 1,
          templateVersionId: publishedVersion.id,
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
  it("should write on event-store for the creation of an eService from a template with a custom instanceId", async () => {
    const instanceId = generateId();

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
      { instanceId },
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
      description: eServiceTemplate.eserviceDescription,
      name: `${eServiceTemplate.name} ${instanceId}`,
      createdAt: eService.createdAt,
      id: eService.id,
      isSignalHubEnabled: eService.isSignalHubEnabled,
      isClientAccessDelegable: false,
      isConsumerDelegable: false,
      descriptors: [],
      templateId: eServiceTemplate.id,
      instanceId,
    };

    const expectedEServiceWithDescriptor: EService = {
      ...mockEService,
      description: eServiceTemplate.eserviceDescription,
      name: `${eServiceTemplate.name} ${instanceId}`,
      createdAt: new Date(),
      id: eService.id,
      isSignalHubEnabled: eService.isSignalHubEnabled,
      isClientAccessDelegable: false,
      isConsumerDelegable: false,
      templateId: eServiceTemplate.id,
      instanceId,
      descriptors: [
        {
          ...mockDescriptor,
          description: publishedVersion.description,
          id: eService.descriptors[0].id,
          createdAt: new Date(),
          serverUrls: [],
          audience: [eServiceTemplate.audienceDescription],
          dailyCallsPerConsumer: publishedVersion?.dailyCallsPerConsumer ?? 1,
          dailyCallsTotal: publishedVersion?.dailyCallsTotal ?? 1,
          templateVersionId: publishedVersion.id,
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

    const publishedVersion: EServiceTemplateVersion = {
      ...getMockEServiceTemplateVersion(),
      state: eserviceTemplateVersionState.published,
      docs: [document1, document2],
    };
    const eServiceTemplate: EServiceTemplate = {
      ...mockEServiceTemplate,
      versions: [publishedVersion],
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
      { instanceId: undefined },
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

    const eServiceCreationPayload = decodeProtobufPayload({
      messageType: EServiceAddedV2,
      payload: eServiceCreationEvent.data,
    });
    const descriptorCreationPayload = decodeProtobufPayload({
      messageType: EServiceDescriptorAddedV2,
      payload: eServiceDescriptorCreationEvent.data,
    });
    const eServiceDocument1CreationPayload = decodeProtobufPayload({
      messageType: EServiceDescriptorDocumentAddedV2,
      payload: eServiceDocument1CreationEvent.data,
    });
    const eServiceDocument2CreationPayload = decodeProtobufPayload({
      messageType: EServiceDescriptorDocumentAddedV2,
      payload: eServiceDocument2CreationEvent.data,
    });

    const expectedEService: EService = {
      ...mockEService,
      description: eServiceTemplate.eserviceDescription,
      name: eServiceTemplate.name,
      createdAt: eService.createdAt,
      id: eService.id,
      isSignalHubEnabled: eService.isSignalHubEnabled,
      isConsumerDelegable: false,
      isClientAccessDelegable: false,
      templateId: eServiceTemplate.id,
      instanceId: eService.instanceId,
    };

    const expectedEServiceWithDescriptor: EService = {
      ...mockEService,
      description: eServiceTemplate.eserviceDescription,
      name: eServiceTemplate.name,
      createdAt: new Date(),
      id: eService.id,
      isSignalHubEnabled: eService.isSignalHubEnabled,
      isClientAccessDelegable: false,
      isConsumerDelegable: false,
      templateId: eServiceTemplate.id,
      descriptors: [
        {
          ...mockDescriptor,
          description: publishedVersion.description,
          id: eService.descriptors[0].id,
          createdAt: new Date(),
          serverUrls: [],
          audience: [eServiceTemplate.audienceDescription],
          dailyCallsPerConsumer: publishedVersion?.dailyCallsPerConsumer ?? 1,
          dailyCallsTotal: publishedVersion?.dailyCallsTotal ?? 1,
          templateVersionId: publishedVersion.id,
        },
      ],
    };

    const expectedDocument1: Document = {
      ...document1,
      id: unsafeBrandId(
        eServiceDocument1CreationPayload.eservice!.descriptors[0].docs[0].id
      ),
      uploadDate: new Date(
        eServiceDocument1CreationPayload.eservice!.descriptors[0].docs[0].uploadDate
      ),
      path: eServiceDocument1CreationPayload.eservice!.descriptors[0].docs[0]
        .path,
    };
    const expectedDocument2: Document = {
      ...document2,
      id: unsafeBrandId(
        eServiceDocument2CreationPayload.eservice!.descriptors[0].docs[1].id
      ),
      uploadDate: new Date(
        eServiceDocument2CreationPayload.eservice!.descriptors[0].docs[1].uploadDate
      ),
      path: eServiceDocument2CreationPayload.eservice!.descriptors[0].docs[1]
        .path,
    };

    expect(eServiceCreationPayload.eservice).toEqual(
      toEServiceV2(expectedEService)
    );
    expect(descriptorCreationPayload.eservice).toEqual(
      toEServiceV2(expectedEServiceWithDescriptor)
    );
    expect(eServiceDocument1CreationPayload.eservice).toEqual(
      toEServiceV2({
        ...expectedEServiceWithDescriptor,
        descriptors: [
          {
            ...expectedEServiceWithDescriptor.descriptors[0],
            docs: [expectedDocument1],
          },
        ],
      })
    );
    expect(eServiceDocument2CreationPayload.eservice).toEqual(
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
        { instanceId: undefined },
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
        { instanceId: undefined },
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
