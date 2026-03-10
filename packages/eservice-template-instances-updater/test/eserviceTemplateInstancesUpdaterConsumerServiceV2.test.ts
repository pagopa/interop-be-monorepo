/* eslint-disable functional/no-let */
import type {
  FileManager,
  RefreshableInteropToken,
} from "pagopa-interop-commons";
import {
  getMockDescriptor,
  getMockDocument,
  getMockEService,
  getMockEServiceTemplate,
  getMockEServiceTemplateVersion,
} from "pagopa-interop-commons-test";
import {
  AttributeId,
  CorrelationId,
  Descriptor,
  Document,
  EService,
  EServiceTemplate,
  EServiceTemplateDescriptionUpdatedV2,
  EServiceTemplateEventEnvelope,
  EServiceTemplateNameUpdatedV2,
  EServiceTemplatePersonalDataFlagUpdatedAfterPublicationV2,
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
import { addOneEService, readModelService } from "./utils.js";

const updateTemplateInstanceNameFn = vi.fn();
const updateTemplateInstanceDescriptionFn = vi.fn();
const updateTemplateInstanceDescriptorAttributesFn = vi.fn();
const updateTemplateInstanceDescriptorVoucherLifespanFn = vi.fn();
const createTemplateInstanceDescriptorDocumentFn = vi.fn();
const updateTemplateInstanceDescriptorDocumentFn = vi.fn();
const deleteTemplateInstanceDescriptorDocumentFn = vi.fn();
const setTemplateInstancePersonalDataFlagFn = vi.fn();

const copyDocumentFn = vi.fn();

const fileManager = {
  copy: copyDocumentFn,
} as unknown as FileManager;

vi.doMock("pagopa-interop-api-clients", () => ({
  catalogApi: {
    // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
    createProcessApiClient: () => ({
      updateTemplateInstanceName: updateTemplateInstanceNameFn,
      updateTemplateInstanceDescription: updateTemplateInstanceDescriptionFn,
      updateTemplateInstanceDescriptorAttributes:
        updateTemplateInstanceDescriptorAttributesFn,
      updateTemplateInstanceDescriptorVoucherLifespan:
        updateTemplateInstanceDescriptorVoucherLifespanFn,
      createTemplateInstanceDescriptorDocument:
        createTemplateInstanceDescriptorDocumentFn,
      updateTemplateInstanceDescriptorDocument:
        updateTemplateInstanceDescriptorDocumentFn,
      deleteTemplateInstanceDescriptorDocument:
        deleteTemplateInstanceDescriptorDocumentFn,
      setTemplateInstancePersonalDataFlag:
        setTemplateInstancePersonalDataFlagFn,
    }),
  },
}));

describe("eserviceTemplateUpdaterConsumerServiceV2", () => {
  const correlationId: CorrelationId = generateId();

  const testToken = "mockToken";

  const eserviceTemplate = getMockEServiceTemplate();
  const instanceToUpdate1: EService = {
    ...getMockEService(),
    templateId: eserviceTemplate.id,
  };
  const instanceToUpdate2: EService = {
    ...getMockEService(),
    templateId: eserviceTemplate.id,
  };
  const instanceToUpdate3: EService = {
    ...getMockEService(),
    templateId: eserviceTemplate.id,
  };

  const testHeaders = {
    "X-Correlation-Id": correlationId,
    Authorization: `Bearer ${testToken}`,
  };

  let mockRefreshableToken: RefreshableInteropToken;

  beforeAll(() => {
    mockRefreshableToken = {
      get: () => Promise.resolve({ serialized: testToken }),
    } as unknown as RefreshableInteropToken;
  });

  afterEach(() => {
    updateTemplateInstanceNameFn.mockClear();
    updateTemplateInstanceDescriptionFn.mockClear();
    updateTemplateInstanceDescriptorAttributesFn.mockClear();
    updateTemplateInstanceDescriptorVoucherLifespanFn.mockClear();
    createTemplateInstanceDescriptorDocumentFn.mockClear();
    updateTemplateInstanceDescriptorDocumentFn.mockClear();
    deleteTemplateInstanceDescriptorDocumentFn.mockClear();
  });

  it("The consumer should call the updateTemplateInstanceName route on EServiceTemplateNameUpdated event", async () => {
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

    await addOneEService(instanceToUpdate1);
    await addOneEService(instanceToUpdate2);
    await addOneEService(instanceToUpdate3);

    const { handleMessageV2 } =
      await import("../src/eserviceTemplateInstancesUpdaterConsumerServiceV2.js");

    await handleMessageV2({
      decodedKafkaMessage,
      refreshableToken: mockRefreshableToken,
      partition: Math.random(),
      offset: "10",
      readModelService,
      fileManager,
    });

    expect(updateTemplateInstanceNameFn).toHaveBeenCalledTimes(3);
    expect(updateTemplateInstanceNameFn).toHaveBeenCalledWith(
      { name: eserviceTemplate.name },
      {
        params: {
          eServiceId: instanceToUpdate1.id,
        },
        headers: testHeaders,
      }
    );
    expect(updateTemplateInstanceNameFn).toHaveBeenCalledWith(
      { name: eserviceTemplate.name },
      {
        params: {
          eServiceId: instanceToUpdate2.id,
        },
        headers: testHeaders,
      }
    );
    expect(updateTemplateInstanceNameFn).toHaveBeenCalledWith(
      { name: eserviceTemplate.name },
      {
        params: {
          eServiceId: instanceToUpdate3.id,
        },
        headers: testHeaders,
      }
    );
  });

  it("The consumer should call the updateTemplateInstanceDescription route on EServiceTemplateVersionAttributesUpdated event", async () => {
    const payload: EServiceTemplateDescriptionUpdatedV2 = {
      eserviceTemplate: toEServiceTemplateV2(eserviceTemplate),
    };

    const decodedKafkaMessage: EServiceTemplateEventEnvelope = {
      sequence_num: 1,
      stream_id: eserviceTemplate.id,
      version: 2,
      type: "EServiceTemplateDescriptionUpdated",
      event_version: 2,
      data: payload,
      log_date: new Date(),
      correlation_id: correlationId,
    };

    await addOneEService(instanceToUpdate1);
    await addOneEService(instanceToUpdate2);
    await addOneEService(instanceToUpdate3);

    const { handleMessageV2 } =
      await import("../src/eserviceTemplateInstancesUpdaterConsumerServiceV2.js");

    await handleMessageV2({
      decodedKafkaMessage,
      refreshableToken: mockRefreshableToken,
      partition: Math.random(),
      offset: "10",
      readModelService,
      fileManager,
    });

    expect(updateTemplateInstanceDescriptionFn).toHaveBeenCalledTimes(3);
    expect(updateTemplateInstanceDescriptionFn).toHaveBeenCalledWith(
      { description: eserviceTemplate.description },
      {
        params: {
          eServiceId: instanceToUpdate1.id,
        },
        headers: testHeaders,
      }
    );
    expect(updateTemplateInstanceDescriptionFn).toHaveBeenCalledWith(
      { description: eserviceTemplate.description },
      {
        params: {
          eServiceId: instanceToUpdate2.id,
        },
        headers: testHeaders,
      }
    );
    expect(updateTemplateInstanceDescriptionFn).toHaveBeenCalledWith(
      { description: eserviceTemplate.description },
      {
        params: {
          eServiceId: instanceToUpdate3.id,
        },
        headers: testHeaders,
      }
    );
  });

  it("The consumer should call the updateTemplateInstanceDescriptorAttributes route on EServiceTemplateVersionAttributesUpdated event", async () => {
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
      templateVersionRef: { id: updatedVersion.id },
    };

    const descriptorInstance2: Descriptor = {
      ...getMockDescriptor(),
      templateVersionRef: { id: updatedVersion.id },
    };

    const descriptorInstance3: Descriptor = {
      ...getMockDescriptor(),
      templateVersionRef: { id: generateId<EServiceTemplateVersionId>() },
    };

    const eserviceInstance1: EService = {
      ...getMockEService(),
      descriptors: [descriptorInstance1],
      templateId: eserviceTemplate.id,
    };
    const eserviceInstance2: EService = {
      ...getMockEService(),
      descriptors: [descriptorInstance2],
      templateId: eserviceTemplate.id,
    };
    const eserviceInstance3: EService = {
      ...getMockEService(),
      descriptors: [descriptorInstance3],
      templateId: eserviceTemplate.id,
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

    await addOneEService(eserviceInstance1);
    await addOneEService(eserviceInstance2);
    await addOneEService(eserviceInstance3);

    const { handleMessageV2 } =
      await import("../src/eserviceTemplateInstancesUpdaterConsumerServiceV2.js");

    await handleMessageV2({
      decodedKafkaMessage,
      refreshableToken: mockRefreshableToken,
      partition: Math.random(),
      offset: "10",
      readModelService,
      fileManager,
    });

    expect(updateTemplateInstanceDescriptorAttributesFn).toHaveBeenCalledTimes(
      2
    );
    expect(updateTemplateInstanceDescriptorAttributesFn).toHaveBeenCalledWith(
      updatedVersion.attributes,
      {
        params: {
          eServiceId: eserviceInstance1.id,
          descriptorId: descriptorInstance1.id,
        },
        headers: testHeaders,
      }
    );
    expect(updateTemplateInstanceDescriptorAttributesFn).toHaveBeenCalledWith(
      updatedVersion.attributes,
      {
        params: {
          eServiceId: eserviceInstance2.id,
          descriptorId: descriptorInstance2.id,
        },
        headers: testHeaders,
      }
    );
    expect(
      updateTemplateInstanceDescriptorAttributesFn
    ).not.toHaveBeenCalledWith(updatedVersion.attributes, {
      params: {
        eServiceId: eserviceInstance3.id,
        descriptorId: descriptorInstance3.id,
      },
      headers: testHeaders,
    });
  });

  it("The consumer should call the updateTemplateInstanceDescriptorVoucherLifespan route on EServiceTemplateVersionQuotasUpdated event", async () => {
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
      templateVersionRef: { id: updatedVersion.id },
    };

    const descriptorInstance2: Descriptor = {
      ...getMockDescriptor(),
      templateVersionRef: { id: updatedVersion.id },
    };

    const descriptorInstance3: Descriptor = {
      ...getMockDescriptor(),
      templateVersionRef: { id: generateId<EServiceTemplateVersionId>() },
    };

    const eserviceInstance1: EService = {
      ...getMockEService(),
      descriptors: [descriptorInstance1],
      templateId: eserviceTemplate.id,
    };
    const eserviceInstance2: EService = {
      ...getMockEService(),
      descriptors: [descriptorInstance2],
      templateId: eserviceTemplate.id,
    };
    const eserviceInstance3: EService = {
      ...getMockEService(),
      descriptors: [descriptorInstance3],
      templateId: eserviceTemplate.id,
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

    await addOneEService(eserviceInstance1);
    await addOneEService(eserviceInstance2);
    await addOneEService(eserviceInstance3);

    const { handleMessageV2 } =
      await import("../src/eserviceTemplateInstancesUpdaterConsumerServiceV2.js");

    await handleMessageV2({
      decodedKafkaMessage,
      refreshableToken: mockRefreshableToken,
      partition: Math.random(),
      offset: "10",
      readModelService,
      fileManager,
    });

    expect(
      updateTemplateInstanceDescriptorVoucherLifespanFn
    ).toHaveBeenCalledTimes(2);
    expect(
      updateTemplateInstanceDescriptorVoucherLifespanFn
    ).toHaveBeenCalledWith(
      { voucherLifespan: updatedVoucherLifespan },
      {
        params: {
          eServiceId: eserviceInstance1.id,
          descriptorId: descriptorInstance1.id,
        },
        headers: testHeaders,
      }
    );
    expect(
      updateTemplateInstanceDescriptorVoucherLifespanFn
    ).toHaveBeenCalledWith(
      { voucherLifespan: updatedVoucherLifespan },
      {
        params: {
          eServiceId: eserviceInstance2.id,
          descriptorId: descriptorInstance2.id,
        },
        headers: testHeaders,
      }
    );
    expect(
      updateTemplateInstanceDescriptorAttributesFn
    ).not.toHaveBeenCalledWith(
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

  it("The consumer should call the createTemplateInstanceDescriptorDocument route on EServiceTemplateVersionDocumentAdded event", async () => {
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
      templateVersionRef: { id: updatedVersion.id },
      docs: [{ ...oldDocument, id: generateId() }],
    };

    const descriptorInstance2: Descriptor = {
      ...getMockDescriptor(),
      templateVersionRef: { id: updatedVersion.id },
      docs: [
        { ...oldDocument, id: generateId() },
        { ...newDocument, id: generateId() },
      ],
    };

    const descriptorInstance3: Descriptor = {
      ...getMockDescriptor(),
      templateVersionRef: { id: generateId<EServiceTemplateVersionId>() },
      docs: [
        { ...oldDocument, id: generateId() },
        { ...newDocument, id: generateId() },
      ],
    };

    const eserviceInstance1: EService = {
      ...getMockEService(),
      descriptors: [descriptorInstance1],
      templateId: eserviceTemplate.id,
    };
    const eserviceInstance2: EService = {
      ...getMockEService(),
      descriptors: [descriptorInstance2],
      templateId: eserviceTemplate.id,
    };
    const eserviceInstance3: EService = {
      ...getMockEService(),
      descriptors: [descriptorInstance3],
      templateId: eserviceTemplate.id,
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

    await addOneEService(eserviceInstance1);
    await addOneEService(eserviceInstance2);
    await addOneEService(eserviceInstance3);

    const clonedPath = "clonedPath";
    copyDocumentFn.mockResolvedValue(clonedPath);

    const { handleMessageV2 } =
      await import("../src/eserviceTemplateInstancesUpdaterConsumerServiceV2.js");

    await handleMessageV2({
      decodedKafkaMessage,
      refreshableToken: mockRefreshableToken,
      partition: Math.random(),
      offset: "10",
      readModelService,
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

    expect(createTemplateInstanceDescriptorDocumentFn).toHaveBeenCalledTimes(1);
    expect(createTemplateInstanceDescriptorDocumentFn).toHaveBeenCalledWith(
      expectedDocument,
      {
        params: {
          eServiceId: eserviceInstance1.id,
          descriptorId: descriptorInstance1.id,
        },
        headers: testHeaders,
      }
    );
    expect(createTemplateInstanceDescriptorDocumentFn).not.toHaveBeenCalledWith(
      expectedDocument,
      {
        params: {
          eServiceId: eserviceInstance2.id,
          descriptorId: descriptorInstance2.id,
        },
        headers: testHeaders,
      }
    );
    expect(
      updateTemplateInstanceDescriptorAttributesFn
    ).not.toHaveBeenCalledWith(expectedDocument, {
      params: {
        eServiceId: eserviceInstance3.id,
        descriptorId: descriptorInstance3.id,
      },
      headers: testHeaders,
    });
  });

  it("The consumer should call the updateTemplateInstanceDescriptorDocument route on EServiceTemplateVersionDocumentUpdated event", async () => {
    const oldDocument: Document = {
      ...getMockDocument(),
      checksum: "checksum1",
    };
    const updatedDocument: Document = {
      ...oldDocument,
      prettyName: "newPrettyName",
    };

    const updatedVersion: EServiceTemplateVersion = {
      ...getMockEServiceTemplateVersion(),
      docs: [updatedDocument],
    };

    const eserviceTemplate: EServiceTemplate = {
      ...getMockEServiceTemplate(),
      versions: [updatedVersion],
    };

    const documentIstance1: Document = {
      ...oldDocument,
      id: generateId(),
    };
    const descriptorInstance1: Descriptor = {
      ...getMockDescriptor(),
      templateVersionRef: { id: updatedVersion.id },
      docs: [documentIstance1],
    };

    const documentIstance2: Document = {
      ...oldDocument,
      id: generateId(),
    };
    const descriptorInstance2: Descriptor = {
      ...getMockDescriptor(),
      templateVersionRef: { id: updatedVersion.id },
      docs: [documentIstance2],
    };

    const documentIstance3: Document = {
      ...oldDocument,
      id: generateId(),
    };
    const descriptorInstance3: Descriptor = {
      ...getMockDescriptor(),
      templateVersionRef: { id: generateId<EServiceTemplateVersionId>() },
      docs: [documentIstance3],
    };

    const eserviceInstance1: EService = {
      ...getMockEService(),
      descriptors: [descriptorInstance1],
      templateId: eserviceTemplate.id,
    };
    const eserviceInstance2: EService = {
      ...getMockEService(),
      descriptors: [descriptorInstance2],
      templateId: eserviceTemplate.id,
    };
    const eserviceInstance3: EService = {
      ...getMockEService(),
      descriptors: [descriptorInstance3],
      templateId: eserviceTemplate.id,
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

    await addOneEService(eserviceInstance1);
    await addOneEService(eserviceInstance2);
    await addOneEService(eserviceInstance3);

    const { handleMessageV2 } =
      await import("../src/eserviceTemplateInstancesUpdaterConsumerServiceV2.js");

    await handleMessageV2({
      decodedKafkaMessage,
      refreshableToken: mockRefreshableToken,
      partition: Math.random(),
      offset: "10",
      readModelService,
      fileManager,
    });

    expect(updateTemplateInstanceDescriptorDocumentFn).toHaveBeenCalledTimes(2);
    expect(updateTemplateInstanceDescriptorDocumentFn).toHaveBeenCalledWith(
      { prettyName: updatedDocument.prettyName },
      {
        params: {
          eServiceId: eserviceInstance1.id,
          descriptorId: descriptorInstance1.id,
          documentId: documentIstance1.id,
        },
        headers: testHeaders,
      }
    );
    expect(updateTemplateInstanceDescriptorDocumentFn).toHaveBeenCalledWith(
      { prettyName: updatedDocument.prettyName },
      {
        params: {
          eServiceId: eserviceInstance2.id,
          descriptorId: descriptorInstance2.id,
          documentId: documentIstance2.id,
        },
        headers: testHeaders,
      }
    );
    expect(
      updateTemplateInstanceDescriptorAttributesFn
    ).not.toHaveBeenCalledWith(
      { prettyName: updatedDocument.prettyName },
      {
        params: {
          eServiceId: eserviceInstance3.id,
          descriptorId: descriptorInstance3.id,
          documentId: documentIstance3.id,
        },
        headers: testHeaders,
      }
    );
  });

  it("The consumer should call the deleteTemplateInstanceDescriptorDocument route on EServiceTemplateVersionDocumentDeleted event", async () => {
    const document: Document = {
      ...getMockDocument(),
      checksum: "checksum1",
    };
    const documentToDelete: Document = {
      ...getMockDocument(),
      checksum: "checksum2",
    };

    const updatedVersion: EServiceTemplateVersion = {
      ...getMockEServiceTemplateVersion(),
      docs: [document],
    };

    const eserviceTemplate: EServiceTemplate = {
      ...getMockEServiceTemplate(),
      versions: [updatedVersion],
    };

    const documentIstance1: Document = {
      ...document,
      id: generateId(),
    };
    const documentIstance1ToDelete: Document = {
      ...documentToDelete,
      id: generateId(),
    };
    const descriptorInstance1: Descriptor = {
      ...getMockDescriptor(),
      templateVersionRef: { id: updatedVersion.id },
      docs: [documentIstance1, documentIstance1ToDelete],
    };

    const documentIstance2: Document = {
      ...document,
      id: generateId(),
    };
    const documentIstance2ToDelete: Document = {
      ...documentToDelete,
      id: generateId(),
    };
    const descriptorInstance2: Descriptor = {
      ...getMockDescriptor(),
      templateVersionRef: { id: updatedVersion.id },
      docs: [documentIstance2, documentIstance2ToDelete],
    };

    const documentIstance3: Document = {
      ...document,
      id: generateId(),
    };
    const documentIstance3ToDelete: Document = {
      ...documentToDelete,
      id: generateId(),
    };
    const descriptorInstance3: Descriptor = {
      ...getMockDescriptor(),
      templateVersionRef: { id: generateId<EServiceTemplateVersionId>() },
      docs: [documentIstance3, documentIstance3ToDelete],
    };

    const eserviceInstance1: EService = {
      ...getMockEService(),
      descriptors: [descriptorInstance1],
      templateId: eserviceTemplate.id,
    };
    const eserviceInstance2: EService = {
      ...getMockEService(),
      descriptors: [descriptorInstance2],
      templateId: eserviceTemplate.id,
    };
    const eserviceInstance3: EService = {
      ...getMockEService(),
      descriptors: [descriptorInstance3],
      templateId: eserviceTemplate.id,
    };

    const payload: EServiceTemplateVersionDocumentDeletedV2 = {
      documentId: documentToDelete.id,
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

    await addOneEService(eserviceInstance1);
    await addOneEService(eserviceInstance2);
    await addOneEService(eserviceInstance3);

    const { handleMessageV2 } =
      await import("../src/eserviceTemplateInstancesUpdaterConsumerServiceV2.js");

    await handleMessageV2({
      decodedKafkaMessage,
      refreshableToken: mockRefreshableToken,
      partition: Math.random(),
      offset: "10",
      readModelService,
      fileManager,
    });

    expect(deleteTemplateInstanceDescriptorDocumentFn).toHaveBeenCalledTimes(2);
    expect(deleteTemplateInstanceDescriptorDocumentFn).toHaveBeenCalledWith(
      undefined,
      {
        params: {
          eServiceId: eserviceInstance1.id,
          descriptorId: descriptorInstance1.id,
          documentId: documentIstance1ToDelete.id,
        },
        headers: testHeaders,
      }
    );
    expect(deleteTemplateInstanceDescriptorDocumentFn).toHaveBeenCalledWith(
      undefined,
      {
        params: {
          eServiceId: eserviceInstance2.id,
          descriptorId: descriptorInstance2.id,
          documentId: documentIstance2ToDelete.id,
        },
        headers: testHeaders,
      }
    );
    expect(
      updateTemplateInstanceDescriptorAttributesFn
    ).not.toHaveBeenCalledWith(undefined, {
      params: {
        eServiceId: eserviceInstance3.id,
        descriptorId: descriptorInstance3.id,
        documentId: documentIstance3ToDelete.id,
      },
      headers: testHeaders,
    });
  });

  it("The consumer should call the updateTemplateInstancePersonalDataFlag route on EServiceTemplatePersonalDataFlagUpdatedAfterPublication event", async () => {
    const mockTemplate: EServiceTemplate = {
      ...eserviceTemplate,
      personalData: true,
    };
    const payload: EServiceTemplatePersonalDataFlagUpdatedAfterPublicationV2 = {
      eserviceTemplate: toEServiceTemplateV2(mockTemplate),
    };

    const decodedKafkaMessage: EServiceTemplateEventEnvelope = {
      sequence_num: 1,
      stream_id: eserviceTemplate.id,
      version: 2,
      type: "EServiceTemplatePersonalDataFlagUpdatedAfterPublication",
      event_version: 2,
      data: payload,
      log_date: new Date(),
      correlation_id: correlationId,
    };

    await addOneEService(instanceToUpdate1);
    await addOneEService(instanceToUpdate2);
    await addOneEService(instanceToUpdate3);

    const { handleMessageV2 } =
      await import("../src/eserviceTemplateInstancesUpdaterConsumerServiceV2.js");

    await handleMessageV2({
      decodedKafkaMessage,
      refreshableToken: mockRefreshableToken,
      partition: Math.random(),
      offset: "10",
      readModelService,
      fileManager,
    });

    expect(setTemplateInstancePersonalDataFlagFn).toHaveBeenCalledTimes(3);
    expect(setTemplateInstancePersonalDataFlagFn).toHaveBeenCalledWith(
      { personalData: mockTemplate.personalData },
      {
        params: {
          eServiceId: instanceToUpdate1.id,
        },
        headers: testHeaders,
      }
    );
    expect(setTemplateInstancePersonalDataFlagFn).toHaveBeenCalledWith(
      { personalData: mockTemplate.personalData },
      {
        params: {
          eServiceId: instanceToUpdate2.id,
        },
        headers: testHeaders,
      }
    );
    expect(setTemplateInstancePersonalDataFlagFn).toHaveBeenCalledWith(
      { personalData: mockTemplate.personalData },
      {
        params: {
          eServiceId: instanceToUpdate3.id,
        },
        headers: testHeaders,
      }
    );
  });

  it.each([
    "EServiceTemplateAdded",
    "EServiceTemplateIntendedTargetUpdated",
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

    const { handleMessageV2 } =
      await import("../src/eserviceTemplateInstancesUpdaterConsumerServiceV2.js");

    await handleMessageV2({
      decodedKafkaMessage,
      refreshableToken: mockRefreshableToken,
      partition: 0,
      offset: "10",
      readModelService,
      fileManager,
    });

    expect(updateTemplateInstanceNameFn).not.toHaveBeenCalled();
    expect(updateTemplateInstanceDescriptionFn).not.toHaveBeenCalled();
    expect(updateTemplateInstanceDescriptorAttributesFn).not.toHaveBeenCalled();
    expect(
      updateTemplateInstanceDescriptorVoucherLifespanFn
    ).not.toHaveBeenCalled();
    expect(createTemplateInstanceDescriptorDocumentFn).not.toHaveBeenCalled();
    expect(updateTemplateInstanceDescriptorDocumentFn).not.toHaveBeenCalled();
    expect(deleteTemplateInstanceDescriptorDocumentFn).not.toHaveBeenCalled();
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

    const { handleMessageV2 } =
      await import("../src/eserviceTemplateInstancesUpdaterConsumerServiceV2.js");

    await expect(
      handleMessageV2({
        decodedKafkaMessage,
        refreshableToken: mockRefreshableToken,
        partition: 0,
        offset: "10",
        readModelService,
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
