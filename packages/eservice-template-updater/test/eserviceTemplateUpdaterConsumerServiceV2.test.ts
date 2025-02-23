/* eslint-disable functional/no-let */
import {
  getMockDescriptor,
  getMockDocument,
  getMockEService,
  getMockEServiceTemplate,
  getMockEServiceTemplateVersion,
} from "pagopa-interop-commons-test/index.js";
import {
  AttributeId,
  CorrelationId,
  Descriptor,
  Document,
  EService,
  EServiceTemplate,
  EServiceTemplateEServiceDescriptionUpdatedV2,
  EServiceTemplateEventEnvelope,
  EServiceTemplateNameUpdatedV2,
  EServiceTemplateVersion,
  EServiceTemplateVersionAttributesUpdatedV2,
  EServiceTemplateVersionDocumentAddedV2,
  EServiceTemplateVersionDocumentDeletedV2,
  EServiceTemplateVersionDocumentUpdatedV2,
  EServiceTemplateVersionId,
  EServiceTemplateVersionQuotasUpdatedV2,
  generateId,
  missingKafkaMessageDataError,
  toEServiceTemplateV2,
} from "pagopa-interop-models";
import { beforeAll, describe, expect, it, vi, afterEach } from "vitest";
import * as commons from "pagopa-interop-commons";

const internalUpdateEServiceNameFn = vi.fn();
const internalUpdateEServiceDescriptionFn = vi.fn();
const internalUpdateDescriptorAttributesFn = vi.fn();
const internalUpdateDescriptorVoucherLifespanFn = vi.fn();
const internalCreateDescriptorDocumentFn = vi.fn();
const internalUpdateDescriptorDocumentFn = vi.fn();
const internalDeleteDescriptorDocumentFn = vi.fn();

const copyDocumentFn = vi.fn();

const fileManager = {
  copy: copyDocumentFn,
} as unknown as commons.FileManager;

vi.doMock("pagopa-interop-api-clients", () => ({
  catalogApi: {
    // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
    createProcessApiClient: () => ({
      internalUpdateEServiceName: internalUpdateEServiceNameFn,
      internalUpdateEServiceDescription: internalUpdateEServiceDescriptionFn,
      internalUpdateDescriptorAttributes: internalUpdateDescriptorAttributesFn,
      internalUpdateDescriptorVoucherLifespan:
        internalUpdateDescriptorVoucherLifespanFn,
      internalCreateDescriptorDocument: internalCreateDescriptorDocumentFn,
      internalUpdateDescriptorDocument: internalUpdateDescriptorDocumentFn,
      internalDeleteDescriptorDocument: internalDeleteDescriptorDocumentFn,
    }),
  },
}));

const instanceToUpdate1 = getMockEService();
const instanceToUpdate2 = getMockEService();
const instanceToUpdate3 = getMockEService();

function mockInstancesToUpdate(
  instances: EService[] = [
    instanceToUpdate1,
    instanceToUpdate2,
    instanceToUpdate3,
  ]
): void {
  vi.spyOn(commons, "getAllFromPaginated").mockResolvedValue(instances);
}

describe("eserviceTemplateUpdaterConsumerServiceV2", () => {
  const correlationId: CorrelationId = generateId();

  const testToken = "mockToken";

  const eserviceTemplate = getMockEServiceTemplate();

  const testHeaders = {
    "X-Correlation-Id": correlationId,
    Authorization: `Bearer ${testToken}`,
  };

  let mockRefreshableToken: commons.RefreshableInteropToken;

  beforeAll(() => {
    mockRefreshableToken = {
      get: () => Promise.resolve({ serialized: testToken }),
    } as unknown as commons.RefreshableInteropToken;
  });

  afterEach(() => {
    internalUpdateEServiceNameFn.mockClear();
    internalUpdateEServiceDescriptionFn.mockClear();
    internalUpdateDescriptorAttributesFn.mockClear();
    internalUpdateDescriptorVoucherLifespanFn.mockClear();
    internalCreateDescriptorDocumentFn.mockClear();
    internalUpdateDescriptorDocumentFn.mockClear();
    internalDeleteDescriptorDocumentFn.mockClear();
  });

  it("The consumer should call the internalUpdateEServiceName route on EServiceTemplateNameUpdated event", async () => {
    const payload: EServiceTemplateNameUpdatedV2 = {
      eserviceTemplate: toEServiceTemplateV2(eserviceTemplate),
    };

    const decodedKafkaMessage: EServiceTemplateEventEnvelope = {
      sequence_num: 1,
      stream_id: eserviceTemplate.id,
      version: 2,
      type: "EServiceTemplateNameUpdated",
      event_version: 2,
      data: payload,
      log_date: new Date(),
      correlation_id: correlationId,
    };

    mockInstancesToUpdate();

    const { handleMessageV2 } = await import(
      "../src/eserviceTemplateUpdaterConsumerServiceV2.js"
    );

    await handleMessageV2({
      decodedKafkaMessage,
      refreshableToken: mockRefreshableToken,
      partition: Math.random(),
      offset: "10",
      fileManager,
    });

    expect(internalUpdateEServiceNameFn).toHaveBeenCalledTimes(3);
    expect(internalUpdateEServiceNameFn).toHaveBeenCalledWith(
      { name: eserviceTemplate.name },
      {
        params: {
          eServiceId: instanceToUpdate1.id,
        },
        headers: testHeaders,
      }
    );
    expect(internalUpdateEServiceNameFn).toHaveBeenCalledWith(
      { name: eserviceTemplate.name },
      {
        params: {
          eServiceId: instanceToUpdate2.id,
        },
        headers: testHeaders,
      }
    );
    expect(internalUpdateEServiceNameFn).toHaveBeenCalledWith(
      { name: eserviceTemplate.name },
      {
        params: {
          eServiceId: instanceToUpdate3.id,
        },
        headers: testHeaders,
      }
    );
  });

  it("The consumer should call the internalUpdateEServiceDescription route on EServiceTemplateVersionAttributesUpdated event", async () => {
    const payload: EServiceTemplateEServiceDescriptionUpdatedV2 = {
      eserviceTemplate: toEServiceTemplateV2(eserviceTemplate),
    };

    const decodedKafkaMessage: EServiceTemplateEventEnvelope = {
      sequence_num: 1,
      stream_id: eserviceTemplate.id,
      version: 2,
      type: "EServiceTemplateEServiceDescriptionUpdated",
      event_version: 2,
      data: payload,
      log_date: new Date(),
      correlation_id: correlationId,
    };

    mockInstancesToUpdate();

    const { handleMessageV2 } = await import(
      "../src/eserviceTemplateUpdaterConsumerServiceV2.js"
    );

    await handleMessageV2({
      decodedKafkaMessage,
      refreshableToken: mockRefreshableToken,
      partition: Math.random(),
      offset: "10",
      fileManager,
    });

    expect(internalUpdateEServiceDescriptionFn).toHaveBeenCalledTimes(3);
    expect(internalUpdateEServiceDescriptionFn).toHaveBeenCalledWith(
      { description: eserviceTemplate.eserviceDescription },
      {
        params: {
          eServiceId: instanceToUpdate1.id,
        },
        headers: testHeaders,
      }
    );
    expect(internalUpdateEServiceDescriptionFn).toHaveBeenCalledWith(
      { description: eserviceTemplate.eserviceDescription },
      {
        params: {
          eServiceId: instanceToUpdate2.id,
        },
        headers: testHeaders,
      }
    );
    expect(internalUpdateEServiceDescriptionFn).toHaveBeenCalledWith(
      { description: eserviceTemplate.eserviceDescription },
      {
        params: {
          eServiceId: instanceToUpdate3.id,
        },
        headers: testHeaders,
      }
    );
  });

  it("The consumer should call the internalUpdateDescriptorAttributes route on EServiceTemplateVersionAttributesUpdated event", async () => {
    const certifiedAttrId1 = generateId<AttributeId>();
    const certifiedAttrId2 = generateId<AttributeId>();
    const verifiedAttrId = generateId<AttributeId>();

    const updatedVersion: EServiceTemplateVersion = {
      ...getMockEServiceTemplateVersion(),
      attributes: {
        certified: [
          [{ id: certifiedAttrId1, explicitAttributeVerification: true }],
          [{ id: certifiedAttrId2, explicitAttributeVerification: true }],
        ],
        verified: [
          [{ id: verifiedAttrId, explicitAttributeVerification: true }],
        ],
        declared: [],
      },
    };

    const eserviceTemplate: EServiceTemplate = {
      ...getMockEServiceTemplate(),
      versions: [updatedVersion],
    };

    const descriptorInstance1: Descriptor = {
      ...getMockDescriptor(),
      templateVersionId: updatedVersion.id,
    };

    const descriptorInstance2: Descriptor = {
      ...getMockDescriptor(),
      templateVersionId: updatedVersion.id,
    };

    const descriptorInstance3: Descriptor = {
      ...getMockDescriptor(),
      templateVersionId: generateId<EServiceTemplateVersionId>(),
    };

    const eserviceInstance1: EService = {
      ...getMockEService(),
      descriptors: [descriptorInstance1],
    };
    const eserviceInstance2: EService = {
      ...getMockEService(),
      descriptors: [descriptorInstance2],
    };
    const eserviceInstance3: EService = {
      ...getMockEService(),
      descriptors: [descriptorInstance3],
    };

    const payload: EServiceTemplateVersionAttributesUpdatedV2 = {
      attributeIds: [certifiedAttrId1, certifiedAttrId2, verifiedAttrId],
      eserviceTemplateVersionId: updatedVersion.id,
      eserviceTemplate: toEServiceTemplateV2(eserviceTemplate),
    };

    const decodedKafkaMessage: EServiceTemplateEventEnvelope = {
      sequence_num: 1,
      stream_id: eserviceTemplate.id,
      version: 2,
      type: "EServiceTemplateVersionAttributesUpdated",
      event_version: 2,
      data: payload,
      log_date: new Date(),
      correlation_id: correlationId,
    };

    mockInstancesToUpdate([
      eserviceInstance1,
      eserviceInstance2,
      eserviceInstance3,
    ]);

    const { handleMessageV2 } = await import(
      "../src/eserviceTemplateUpdaterConsumerServiceV2.js"
    );

    await handleMessageV2({
      decodedKafkaMessage,
      refreshableToken: mockRefreshableToken,
      partition: Math.random(),
      offset: "10",
      fileManager,
    });

    expect(internalUpdateDescriptorAttributesFn).toHaveBeenCalledTimes(2);
    expect(internalUpdateDescriptorAttributesFn).toHaveBeenCalledWith(
      updatedVersion.attributes,
      {
        params: {
          eServiceId: eserviceInstance1.id,
          descriptorId: descriptorInstance1.id,
        },
        headers: testHeaders,
      }
    );
    expect(internalUpdateDescriptorAttributesFn).toHaveBeenCalledWith(
      updatedVersion.attributes,
      {
        params: {
          eServiceId: eserviceInstance2.id,
          descriptorId: descriptorInstance2.id,
        },
        headers: testHeaders,
      }
    );
    expect(internalUpdateDescriptorAttributesFn).not.toHaveBeenCalledWith(
      updatedVersion.attributes,
      {
        params: {
          eServiceId: eserviceInstance3.id,
          descriptorId: descriptorInstance3.id,
        },
        headers: testHeaders,
      }
    );
  });

  it("The consumer should call the internalUpdateDescriptorVoucherLifespan route on EServiceTemplateVersionQuotasUpdated event", async () => {
    const updatedVoucherLifespan = 1000;

    const updatedVersion: EServiceTemplateVersion = {
      ...getMockEServiceTemplateVersion(),
      voucherLifespan: updatedVoucherLifespan,
    };

    const eserviceTemplate: EServiceTemplate = {
      ...getMockEServiceTemplate(),
      versions: [updatedVersion],
    };

    const descriptorInstance1: Descriptor = {
      ...getMockDescriptor(),
      templateVersionId: updatedVersion.id,
    };

    const descriptorInstance2: Descriptor = {
      ...getMockDescriptor(),
      templateVersionId: updatedVersion.id,
    };

    const descriptorInstance3: Descriptor = {
      ...getMockDescriptor(),
      templateVersionId: generateId<EServiceTemplateVersionId>(),
    };

    const eserviceInstance1: EService = {
      ...getMockEService(),
      descriptors: [descriptorInstance1],
    };
    const eserviceInstance2: EService = {
      ...getMockEService(),
      descriptors: [descriptorInstance2],
    };
    const eserviceInstance3: EService = {
      ...getMockEService(),
      descriptors: [descriptorInstance3],
    };

    const payload: EServiceTemplateVersionQuotasUpdatedV2 = {
      eserviceTemplateVersionId: updatedVersion.id,
      eserviceTemplate: toEServiceTemplateV2(eserviceTemplate),
    };

    const decodedKafkaMessage: EServiceTemplateEventEnvelope = {
      sequence_num: 1,
      stream_id: eserviceTemplate.id,
      version: 2,
      type: "EServiceTemplateVersionQuotasUpdated",
      event_version: 2,
      data: payload,
      log_date: new Date(),
      correlation_id: correlationId,
    };

    mockInstancesToUpdate([
      eserviceInstance1,
      eserviceInstance2,
      eserviceInstance3,
    ]);

    const { handleMessageV2 } = await import(
      "../src/eserviceTemplateUpdaterConsumerServiceV2.js"
    );

    await handleMessageV2({
      decodedKafkaMessage,
      refreshableToken: mockRefreshableToken,
      partition: Math.random(),
      offset: "10",
      fileManager,
    });

    expect(internalUpdateDescriptorVoucherLifespanFn).toHaveBeenCalledTimes(2);
    expect(internalUpdateDescriptorVoucherLifespanFn).toHaveBeenCalledWith(
      { voucherLifespan: updatedVoucherLifespan },
      {
        params: {
          eServiceId: eserviceInstance1.id,
          descriptorId: descriptorInstance1.id,
        },
        headers: testHeaders,
      }
    );
    expect(internalUpdateDescriptorVoucherLifespanFn).toHaveBeenCalledWith(
      { voucherLifespan: updatedVoucherLifespan },
      {
        params: {
          eServiceId: eserviceInstance2.id,
          descriptorId: descriptorInstance2.id,
        },
        headers: testHeaders,
      }
    );
    expect(internalUpdateDescriptorAttributesFn).not.toHaveBeenCalledWith(
      { voucherLifespan: updatedVoucherLifespan },
      {
        params: {
          eServiceId: eserviceInstance3.id,
          descriptorId: descriptorInstance3.id,
        },
        headers: testHeaders,
      }
    );
  });

  it("The consumer should call the internalCreateDescriptorDocument route on EServiceTemplateVersionDocumentAdded event", async () => {
    const oldDocument: Document = {
      ...getMockDocument(),
      checksum: "checksum1",
    };
    const newDocument: Document = {
      ...getMockDocument(),
      checksum: "checksum2",
    };

    const updatedVersion: EServiceTemplateVersion = {
      ...getMockEServiceTemplateVersion(),
      docs: [oldDocument, newDocument],
    };

    const eserviceTemplate: EServiceTemplate = {
      ...getMockEServiceTemplate(),
      versions: [updatedVersion],
    };

    const descriptorInstance1: Descriptor = {
      ...getMockDescriptor(),
      templateVersionId: updatedVersion.id,
      docs: [oldDocument],
    };

    const descriptorInstance2: Descriptor = {
      ...getMockDescriptor(),
      templateVersionId: updatedVersion.id,
      docs: [oldDocument, newDocument],
    };

    const descriptorInstance3: Descriptor = {
      ...getMockDescriptor(),
      templateVersionId: generateId<EServiceTemplateVersionId>(),
      docs: [oldDocument, newDocument],
    };

    const eserviceInstance1: EService = {
      ...getMockEService(),
      descriptors: [descriptorInstance1],
    };
    const eserviceInstance2: EService = {
      ...getMockEService(),
      descriptors: [descriptorInstance2],
    };
    const eserviceInstance3: EService = {
      ...getMockEService(),
      descriptors: [descriptorInstance3],
    };

    const payload: EServiceTemplateVersionDocumentAddedV2 = {
      documentId: newDocument.id,
      eserviceTemplateVersionId: updatedVersion.id,
      eserviceTemplate: toEServiceTemplateV2(eserviceTemplate),
    };

    const decodedKafkaMessage: EServiceTemplateEventEnvelope = {
      sequence_num: 1,
      stream_id: eserviceTemplate.id,
      version: 2,
      type: "EServiceTemplateVersionDocumentAdded",
      event_version: 2,
      data: payload,
      log_date: new Date(),
      correlation_id: correlationId,
    };

    mockInstancesToUpdate([
      eserviceInstance1,
      eserviceInstance2,
      eserviceInstance3,
    ]);

    const clonedPath = "clonedPath";
    copyDocumentFn.mockResolvedValue(clonedPath);

    const { handleMessageV2 } = await import(
      "../src/eserviceTemplateUpdaterConsumerServiceV2.js"
    );

    await handleMessageV2({
      decodedKafkaMessage,
      refreshableToken: mockRefreshableToken,
      partition: Math.random(),
      offset: "10",
      fileManager,
    });

    const expectedDocument = {
      documentId: expect.any(String),
      kind: "DOCUMENT",
      contentType: newDocument.contentType,
      prettyName: newDocument.prettyName,
      fileName: newDocument.name,
      filePath: clonedPath,
      checksum: newDocument.checksum,
      serverUrls: [],
    };

    expect(internalCreateDescriptorDocumentFn).toHaveBeenCalledTimes(1);
    expect(internalCreateDescriptorDocumentFn).toHaveBeenCalledWith(
      expectedDocument,
      {
        params: {
          eServiceId: eserviceInstance1.id,
          descriptorId: descriptorInstance1.id,
        },
        headers: testHeaders,
      }
    );
    expect(internalCreateDescriptorDocumentFn).not.toHaveBeenCalledWith(
      expectedDocument,
      {
        params: {
          eServiceId: eserviceInstance2.id,
          descriptorId: descriptorInstance2.id,
        },
        headers: testHeaders,
      }
    );
    expect(internalUpdateDescriptorAttributesFn).not.toHaveBeenCalledWith(
      expectedDocument,
      {
        params: {
          eServiceId: eserviceInstance3.id,
          descriptorId: descriptorInstance3.id,
        },
        headers: testHeaders,
      }
    );
  });

  it("The consumer should call the internalUpdateDescriptorDocument route on EServiceTemplateVersionDocumentUpdated event", async () => {
    const oldDocument: Document = {
      ...getMockDocument(),
      checksum: "checksum1",
    };
    const updatedDocument: Document = {
      ...getMockDocument(),
      checksum: "checksum2",
      prettyName: "newPrettyName",
    };

    const updatedVersion: EServiceTemplateVersion = {
      ...getMockEServiceTemplateVersion(),
      docs: [oldDocument, updatedDocument],
    };

    const eserviceTemplate: EServiceTemplate = {
      ...getMockEServiceTemplate(),
      versions: [updatedVersion],
    };

    const descriptorInstance1: Descriptor = {
      ...getMockDescriptor(),
      templateVersionId: updatedVersion.id,
      docs: [oldDocument],
    };

    const descriptorInstance2: Descriptor = {
      ...getMockDescriptor(),
      templateVersionId: updatedVersion.id,
      docs: [oldDocument, updatedDocument],
    };

    const descriptorInstance3: Descriptor = {
      ...getMockDescriptor(),
      templateVersionId: generateId<EServiceTemplateVersionId>(),
      docs: [oldDocument, updatedDocument],
    };

    const eserviceInstance1: EService = {
      ...getMockEService(),
      descriptors: [descriptorInstance1],
    };
    const eserviceInstance2: EService = {
      ...getMockEService(),
      descriptors: [descriptorInstance2],
    };
    const eserviceInstance3: EService = {
      ...getMockEService(),
      descriptors: [descriptorInstance3],
    };

    const payload: EServiceTemplateVersionDocumentUpdatedV2 = {
      documentId: updatedDocument.id,
      eserviceTemplateVersionId: updatedVersion.id,
      eserviceTemplate: toEServiceTemplateV2(eserviceTemplate),
    };

    const decodedKafkaMessage: EServiceTemplateEventEnvelope = {
      sequence_num: 1,
      stream_id: eserviceTemplate.id,
      version: 2,
      type: "EServiceTemplateVersionDocumentUpdated",
      event_version: 2,
      data: payload,
      log_date: new Date(),
      correlation_id: correlationId,
    };

    mockInstancesToUpdate([
      eserviceInstance1,
      eserviceInstance2,
      eserviceInstance3,
    ]);

    const { handleMessageV2 } = await import(
      "../src/eserviceTemplateUpdaterConsumerServiceV2.js"
    );

    await handleMessageV2({
      decodedKafkaMessage,
      refreshableToken: mockRefreshableToken,
      partition: Math.random(),
      offset: "10",
      fileManager,
    });

    expect(internalUpdateDescriptorDocumentFn).toHaveBeenCalledTimes(1);
    expect(internalUpdateDescriptorDocumentFn).not.toHaveBeenCalledWith(
      { prettyName: updatedDocument.prettyName },
      {
        params: {
          eServiceId: eserviceInstance1.id,
          descriptorId: descriptorInstance1.id,
          documentId: updatedDocument.id,
        },
        headers: testHeaders,
      }
    );
    expect(internalUpdateDescriptorDocumentFn).toHaveBeenCalledWith(
      { prettyName: updatedDocument.prettyName },
      {
        params: {
          eServiceId: eserviceInstance2.id,
          descriptorId: descriptorInstance2.id,
          documentId: updatedDocument.id,
        },
        headers: testHeaders,
      }
    );
    expect(internalUpdateDescriptorAttributesFn).not.toHaveBeenCalledWith(
      { prettyName: updatedDocument.prettyName },
      {
        params: {
          eServiceId: eserviceInstance3.id,
          descriptorId: descriptorInstance3.id,
          documentId: updatedDocument.id,
        },
        headers: testHeaders,
      }
    );
  });

  it("The consumer should call the internalDeleteDescriptorDocument route on EServiceTemplateVersionDocumentDeleted event", async () => {
    const oldDocument: Document = {
      ...getMockDocument(),
      checksum: "checksum1",
    };
    const deletedDocument: Document = {
      ...getMockDocument(),
      checksum: "checksum2",
    };

    const updatedVersion: EServiceTemplateVersion = {
      ...getMockEServiceTemplateVersion(),
      docs: [oldDocument],
    };

    const eserviceTemplate: EServiceTemplate = {
      ...getMockEServiceTemplate(),
      versions: [updatedVersion],
    };

    const descriptorInstance1: Descriptor = {
      ...getMockDescriptor(),
      templateVersionId: updatedVersion.id,
      docs: [oldDocument],
    };

    const descriptorInstance2: Descriptor = {
      ...getMockDescriptor(),
      templateVersionId: updatedVersion.id,
      docs: [oldDocument, deletedDocument],
    };

    const descriptorInstance3: Descriptor = {
      ...getMockDescriptor(),
      templateVersionId: generateId<EServiceTemplateVersionId>(),
      docs: [oldDocument, deletedDocument],
    };

    const eserviceInstance1: EService = {
      ...getMockEService(),
      descriptors: [descriptorInstance1],
    };
    const eserviceInstance2: EService = {
      ...getMockEService(),
      descriptors: [descriptorInstance2],
    };
    const eserviceInstance3: EService = {
      ...getMockEService(),
      descriptors: [descriptorInstance3],
    };

    const payload: EServiceTemplateVersionDocumentDeletedV2 = {
      documentId: deletedDocument.id,
      eserviceTemplateVersionId: updatedVersion.id,
      eserviceTemplate: toEServiceTemplateV2(eserviceTemplate),
    };

    const decodedKafkaMessage: EServiceTemplateEventEnvelope = {
      sequence_num: 1,
      stream_id: eserviceTemplate.id,
      version: 2,
      type: "EServiceTemplateVersionDocumentDeleted",
      event_version: 2,
      data: payload,
      log_date: new Date(),
      correlation_id: correlationId,
    };

    mockInstancesToUpdate([
      eserviceInstance1,
      eserviceInstance2,
      eserviceInstance3,
    ]);

    const { handleMessageV2 } = await import(
      "../src/eserviceTemplateUpdaterConsumerServiceV2.js"
    );

    await handleMessageV2({
      decodedKafkaMessage,
      refreshableToken: mockRefreshableToken,
      partition: Math.random(),
      offset: "10",
      fileManager,
    });

    expect(internalDeleteDescriptorDocumentFn).toHaveBeenCalledTimes(1);
    expect(internalDeleteDescriptorDocumentFn).not.toHaveBeenCalledWith(
      undefined,
      {
        params: {
          eServiceId: eserviceInstance1.id,
          descriptorId: descriptorInstance1.id,
          documentId: deletedDocument.id,
        },
        headers: testHeaders,
      }
    );
    expect(internalDeleteDescriptorDocumentFn).toHaveBeenCalledWith(undefined, {
      params: {
        eServiceId: eserviceInstance2.id,
        descriptorId: descriptorInstance2.id,
        documentId: deletedDocument.id,
      },
      headers: testHeaders,
    });
    expect(internalUpdateDescriptorAttributesFn).not.toHaveBeenCalledWith(
      undefined,
      {
        params: {
          eServiceId: eserviceInstance3.id,
          descriptorId: descriptorInstance3.id,
          documentId: deletedDocument.id,
        },
        headers: testHeaders,
      }
    );
  });

  it.each([
    "EServiceTemplateAdded",
    "EServiceTemplateAudienceDescriptionUpdated",
    "EServiceTemplateDeleted",
    "EServiceTemplateDraftUpdated",
    "EServiceTemplateDraftVersionDeleted",
    "EServiceTemplateDraftVersionUpdated",
    "EServiceTemplateRiskAnalysisAdded",
    "EServiceTemplateRiskAnalysisDeleted",
    "EServiceTemplateRiskAnalysisUpdated",
    "EServiceTemplateVersionActivated",
    "EServiceTemplateVersionAdded",
    "EServiceTemplateVersionInterfaceAdded",
    "EServiceTemplateVersionInterfaceDeleted",
    "EServiceTemplateVersionInterfaceUpdated",
    "EServiceTemplateVersionPublished",
    "EServiceTemplateVersionSuspended",
  ] as const)("Should ignore %s event", async (eventType) => {
    const decodedKafkaMessage: EServiceTemplateEventEnvelope = {
      sequence_num: 1,
      stream_id: "stream-id",
      version: 2,
      type: eventType,
      event_version: 2,
      data: {} as never,
      log_date: new Date(),
      correlation_id: correlationId,
    };

    const { handleMessageV2 } = await import(
      "../src/eserviceTemplateUpdaterConsumerServiceV2.js"
    );

    await handleMessageV2({
      decodedKafkaMessage,
      refreshableToken: mockRefreshableToken,
      partition: 0,
      offset: "10",
      fileManager,
    });

    expect(internalUpdateEServiceNameFn).not.toHaveBeenCalled();
    expect(internalUpdateEServiceDescriptionFn).not.toHaveBeenCalled();
    expect(internalUpdateDescriptorAttributesFn).not.toHaveBeenCalled();
    expect(internalUpdateDescriptorVoucherLifespanFn).not.toHaveBeenCalled();
    expect(internalCreateDescriptorDocumentFn).not.toHaveBeenCalled();
    expect(internalUpdateDescriptorDocumentFn).not.toHaveBeenCalled();
    expect(internalDeleteDescriptorDocumentFn).not.toHaveBeenCalled();
  });

  it("Should throw missingKafkaMessageDataError when eservice template data is missing", async () => {
    const decodedKafkaMessage: EServiceTemplateEventEnvelope = {
      sequence_num: 1,
      stream_id: "stream-id",
      version: 2,
      type: "EServiceTemplateNameUpdated",
      event_version: 2,
      data: { eserviceTemplate: undefined },
      log_date: new Date(),
      correlation_id: correlationId,
    };

    const { handleMessageV2 } = await import(
      "../src/eserviceTemplateUpdaterConsumerServiceV2.js"
    );

    await expect(
      handleMessageV2({
        decodedKafkaMessage,
        refreshableToken: mockRefreshableToken,
        partition: 0,
        offset: "10",
        fileManager,
      })
    ).rejects.toThrow(
      missingKafkaMessageDataError(
        "eserviceTemplate",
        "EServiceTemplateNameUpdated"
      )
    );
  });
});
