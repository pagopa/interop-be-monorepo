/* eslint-disable @typescript-eslint/no-non-null-assertion */
/* eslint-disable @typescript-eslint/no-floating-promises */
import { genericLogger, FileManagerError } from "pagopa-interop-commons";
import {
  decodeProtobufPayload,
  getMockContext,
  getMockDelegation,
  getMockEServiceTemplate,
  getMockEServiceTemplateVersion,
  getRandomAuthData,
} from "pagopa-interop-commons-test/index.js";
import {
  Descriptor,
  descriptorState,
  EService,
  Document,
  unsafeBrandId,
  toEServiceV2,
  generateId,
  operationForbidden,
  delegationState,
  delegationKind,
  EServiceTemplate,
  EServiceTemplateVersion,
  EServiceDescriptorAddedV2,
  EServiceTemplateId,
} from "pagopa-interop-models";
import { beforeAll, vi, afterAll, expect, describe, it } from "vitest";
import {
  eServiceNotFound,
  eServiceNotAnInstance,
  eServiceTemplateNotFound,
  eServiceAlreadyUpgraded,
} from "../src/model/domain/errors.js";
import { config } from "../src/config/config.js";
import {
  fileManager,
  addOneEService,
  catalogService,
  readLastEserviceEvent,
  getMockEService,
  getMockDescriptor,
  getMockDocument,
  addOneDelegation,
  addOneEServiceTemplate,
} from "./utils.js";

describe("upgrade eservice template instance", () => {
  const mockEService = getMockEService();
  const mockDescriptor = getMockDescriptor();
  const mockDocument = getMockDocument();
  beforeAll(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date());
  });
  afterAll(() => {
    vi.useRealTimers();
  });
  it("should write on event-store for the upgrading of a eservice template instance, and clone the template version docs", async () => {
    vi.spyOn(fileManager, "copy");

    const document1 = {
      ...mockDocument,
      name: `${mockDocument.name}_1`,
      path: `${config.eserviceDocumentsPath}/${mockDocument.id}/${mockDocument.name}_1`,
    };
    const document2 = {
      ...mockDocument,
      name: `${mockDocument.name}_2`,
      path: `${config.eserviceDocumentsPath}/${mockDocument.id}/${mockDocument.name}_2`,
    };

    const firstTemplateVersion: EServiceTemplateVersion = {
      ...getMockEServiceTemplateVersion(),
      version: 1,
      state: descriptorState.deprecated,
      docs: [],
    };

    const secondTemplateVersion: EServiceTemplateVersion = {
      ...getMockEServiceTemplateVersion(),
      version: 2,
      state: descriptorState.published,
      docs: [document1, document2],
    };

    const template: EServiceTemplate = {
      ...getMockEServiceTemplate(),
      versions: [firstTemplateVersion, secondTemplateVersion],
    };

    await addOneEServiceTemplate(template);

    const eservice: EService = {
      ...mockEService,
      templateRef: { id: template.id },
      descriptors: [
        {
          ...mockDescriptor,
          templateVersionRef: { id: firstTemplateVersion.id },
          version: "1",
          state: descriptorState.published,
          interface: undefined,
          docs: [],
        },
      ],
    };

    await addOneEService(eservice);

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

    const upgradedEService = await catalogService.upgradeEServiceInstance(
      eservice.id,
      getMockContext({ authData: getRandomAuthData(eservice.producerId) })
    );

    const writtenEvent = await readLastEserviceEvent(upgradedEService.id);
    expect(writtenEvent.stream_id).toBe(upgradedEService.id);
    expect(writtenEvent.version).toBe("1");
    expect(writtenEvent.type).toBe("EServiceDescriptorAdded");
    expect(writtenEvent.event_version).toBe(2);
    const writtenPayload = decodeProtobufPayload({
      messageType: EServiceDescriptorAddedV2,
      payload: writtenEvent.data,
    });

    const expectedDocument1: Document = {
      ...document1,
      id: unsafeBrandId(writtenPayload.eservice!.descriptors[1].docs[0].id),
      uploadDate: new Date(
        writtenPayload.eservice!.descriptors[1].docs[0].uploadDate
      ),
      path: writtenPayload.eservice!.descriptors[1].docs[0].path,
    };
    const expectedDocument2: Document = {
      ...document2,
      id: unsafeBrandId(writtenPayload.eservice!.descriptors[1].docs[1].id),
      uploadDate: new Date(
        writtenPayload.eservice!.descriptors[1].docs[1].uploadDate
      ),
      path: writtenPayload.eservice!.descriptors[1].docs[1].path,
    };

    const expectedDescriptor: Descriptor = {
      id: unsafeBrandId(writtenPayload.eservice!.descriptors[1].id),
      version: "2",
      interface: undefined,
      createdAt: new Date(
        Number(writtenPayload.eservice?.descriptors[1].createdAt)
      ),
      docs: [expectedDocument1, expectedDocument2],
      templateVersionRef: { id: secondTemplateVersion.id },
      description: secondTemplateVersion.description,
      state: descriptorState.draft,
      voucherLifespan: secondTemplateVersion.voucherLifespan,
      audience: [],
      dailyCallsPerConsumer: secondTemplateVersion.dailyCallsPerConsumer ?? 1,
      dailyCallsTotal: secondTemplateVersion.dailyCallsTotal ?? 1,
      agreementApprovalPolicy: secondTemplateVersion.agreementApprovalPolicy,
      attributes: secondTemplateVersion.attributes,
      serverUrls: [],
      publishedAt: undefined,
      suspendedAt: undefined,
      deprecatedAt: undefined,
      archivedAt: undefined,
      rejectionReasons: undefined,
    };

    const expectedEService: EService = {
      ...eservice,
      descriptors: [...eservice.descriptors, expectedDescriptor],
    };
    expect(writtenPayload.eservice).toEqual(toEServiceV2(expectedEService));

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
  it("should write on event-store for the upgrading of a eservice template instance, and clone the template version docs (producer delegate)", async () => {
    vi.spyOn(fileManager, "copy");

    const document1 = {
      ...mockDocument,
      name: `${mockDocument.name}_1`,
      path: `${config.eserviceDocumentsPath}/${mockDocument.id}/${mockDocument.name}_1`,
    };
    const document2 = {
      ...mockDocument,
      name: `${mockDocument.name}_2`,
      path: `${config.eserviceDocumentsPath}/${mockDocument.id}/${mockDocument.name}_2`,
    };

    const firstTemplateVersion: EServiceTemplateVersion = {
      ...getMockEServiceTemplateVersion(),
      version: 1,
      state: descriptorState.deprecated,
      docs: [],
    };

    const secondTemplateVersion: EServiceTemplateVersion = {
      ...getMockEServiceTemplateVersion(),
      version: 2,
      state: descriptorState.published,
      docs: [document1, document2],
    };

    const template: EServiceTemplate = {
      ...getMockEServiceTemplate(),
      versions: [firstTemplateVersion, secondTemplateVersion],
    };

    await addOneEServiceTemplate(template);

    const eservice: EService = {
      ...mockEService,
      templateRef: { id: template.id },
      descriptors: [
        {
          ...mockDescriptor,
          templateVersionRef: { id: firstTemplateVersion.id },
          version: "1",
          state: descriptorState.published,
          interface: undefined,
          docs: [],
        },
      ],
    };

    await addOneEService(eservice);

    const delegation = getMockDelegation({
      kind: delegationKind.delegatedProducer,
      eserviceId: eservice.id,
      state: delegationState.active,
    });

    await addOneDelegation(delegation);

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

    const upgradedEService = await catalogService.upgradeEServiceInstance(
      eservice.id,
      getMockContext({ authData: getRandomAuthData(delegation.delegateId) })
    );

    const writtenEvent = await readLastEserviceEvent(upgradedEService.id);
    expect(writtenEvent.stream_id).toBe(upgradedEService.id);
    expect(writtenEvent.version).toBe("1");
    expect(writtenEvent.type).toBe("EServiceDescriptorAdded");
    expect(writtenEvent.event_version).toBe(2);
    const writtenPayload = decodeProtobufPayload({
      messageType: EServiceDescriptorAddedV2,
      payload: writtenEvent.data,
    });

    const expectedDocument1: Document = {
      ...document1,
      id: unsafeBrandId(writtenPayload.eservice!.descriptors[1].docs[0].id),
      uploadDate: new Date(
        writtenPayload.eservice!.descriptors[1].docs[0].uploadDate
      ),
      path: writtenPayload.eservice!.descriptors[1].docs[0].path,
    };
    const expectedDocument2: Document = {
      ...document2,
      id: unsafeBrandId(writtenPayload.eservice!.descriptors[1].docs[1].id),
      uploadDate: new Date(
        writtenPayload.eservice!.descriptors[1].docs[1].uploadDate
      ),
      path: writtenPayload.eservice!.descriptors[1].docs[1].path,
    };

    const expectedDescriptor: Descriptor = {
      id: unsafeBrandId(writtenPayload.eservice!.descriptors[1].id),
      version: "2",
      interface: undefined,
      createdAt: new Date(
        Number(writtenPayload.eservice?.descriptors[1].createdAt)
      ),
      docs: [expectedDocument1, expectedDocument2],
      templateVersionRef: { id: secondTemplateVersion.id },
      description: secondTemplateVersion.description,
      state: descriptorState.draft,
      voucherLifespan: secondTemplateVersion.voucherLifespan,
      audience: [],
      dailyCallsPerConsumer: secondTemplateVersion.dailyCallsPerConsumer ?? 1,
      dailyCallsTotal: secondTemplateVersion.dailyCallsTotal ?? 1,
      agreementApprovalPolicy: secondTemplateVersion.agreementApprovalPolicy,
      attributes: secondTemplateVersion.attributes,
      serverUrls: [],
      publishedAt: undefined,
      suspendedAt: undefined,
      deprecatedAt: undefined,
      archivedAt: undefined,
      rejectionReasons: undefined,
    };

    const expectedEService: EService = {
      ...eservice,
      descriptors: [...eservice.descriptors, expectedDescriptor],
    };
    expect(writtenPayload.eservice).toEqual(toEServiceV2(expectedEService));

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
  it("should fail if one of the file copy fails", async () => {
    const document1 = {
      ...mockDocument,
      name: `${mockDocument.name}_1`,
      path: `${config.eserviceDocumentsPath}/${mockDocument.id}/${mockDocument.name}_1`,
    };

    const firstTemplateVersion: EServiceTemplateVersion = {
      ...getMockEServiceTemplateVersion(),
      version: 1,
      state: descriptorState.deprecated,
      docs: [],
    };

    const secondTemplateVersion: EServiceTemplateVersion = {
      ...getMockEServiceTemplateVersion(),
      version: 2,
      state: descriptorState.published,
      docs: [document1],
    };

    const template: EServiceTemplate = {
      ...getMockEServiceTemplate(),
      versions: [firstTemplateVersion, secondTemplateVersion],
    };

    await addOneEServiceTemplate(template);

    const eservice: EService = {
      ...mockEService,
      templateRef: { id: template.id },
      descriptors: [
        {
          ...mockDescriptor,
          templateVersionRef: { id: firstTemplateVersion.id },
          version: "1",
          state: descriptorState.published,
          interface: undefined,
          docs: [],
        },
      ],
    };

    await addOneEService(eservice);

    await expect(
      catalogService.upgradeEServiceInstance(
        eservice.id,
        getMockContext({ authData: getRandomAuthData(eservice.producerId) })
      )
    ).rejects.toThrowError(FileManagerError);
  });
  it("should throw eServiceNotFound if the eservice doesn't exist", () => {
    expect(
      catalogService.upgradeEServiceInstance(
        mockEService.id,
        getMockContext({})
      )
    ).rejects.toThrowError(eServiceNotFound(mockEService.id));
  });
  it("should throw operationForbidden if the requester is not the producer", async () => {
    const descriptor: Descriptor = {
      ...mockDescriptor,
      state: descriptorState.published,
    };
    const eservice: EService = {
      ...mockEService,
      descriptors: [descriptor],
    };
    await addOneEService(eservice);
    expect(
      catalogService.upgradeEServiceInstance(eservice.id, getMockContext({}))
    ).rejects.toThrowError(operationForbidden);
  });
  it("should throw eServiceNotAnInstance if the eservice is not an instance of a template", async () => {
    const eservice: EService = {
      ...mockEService,
      descriptors: [mockDescriptor],
    };
    await addOneEService(eservice);
    expect(
      catalogService.upgradeEServiceInstance(
        mockEService.id,
        getMockContext({ authData: getRandomAuthData(eservice.producerId) })
      )
    ).rejects.toThrowError(eServiceNotAnInstance(eservice.id));
  });
  it("should throw eServiceTemplateNotFound if the template doesn't exist", async () => {
    const eservice: EService = {
      ...mockEService,
      descriptors: [mockDescriptor],
      templateRef: { id: generateId<EServiceTemplateId>() },
    };
    await addOneEService(eservice);
    expect(
      catalogService.upgradeEServiceInstance(
        mockEService.id,
        getMockContext({ authData: getRandomAuthData(eservice.producerId) })
      )
    ).rejects.toThrowError(
      eServiceTemplateNotFound(eservice.templateRef?.id as EServiceTemplateId)
    );
  });
  it("should throw eServiceAlreadyUpgraded if the eservice instance has already be upgraded", async () => {
    const firstTemplateVersion: EServiceTemplateVersion = {
      ...getMockEServiceTemplateVersion(),
      version: 1,
      state: descriptorState.deprecated,
      docs: [],
    };

    const secondTemplateVersion: EServiceTemplateVersion = {
      ...getMockEServiceTemplateVersion(),
      version: 2,
      state: descriptorState.published,
      docs: [],
    };

    const template: EServiceTemplate = {
      ...getMockEServiceTemplate(),
      versions: [firstTemplateVersion, secondTemplateVersion],
    };

    await addOneEServiceTemplate(template);

    const eservice: EService = {
      ...mockEService,
      templateRef: { id: template.id },
      descriptors: [
        {
          ...mockDescriptor,
          templateVersionRef: { id: firstTemplateVersion.id },
          version: "1",
          state: descriptorState.published,
          interface: undefined,
          docs: [],
        },
        {
          ...mockDescriptor,
          templateVersionRef: { id: secondTemplateVersion.id },
          version: "2",
          state: descriptorState.draft,
          interface: undefined,
          docs: [],
        },
      ],
    };

    await addOneEService(eservice);

    expect(
      catalogService.upgradeEServiceInstance(
        mockEService.id,
        getMockContext({ authData: getRandomAuthData(eservice.producerId) })
      )
    ).rejects.toThrowError(eServiceAlreadyUpgraded(eservice.id));
  });
});
