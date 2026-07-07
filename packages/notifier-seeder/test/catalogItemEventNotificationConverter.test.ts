import { describe, expect, it } from "vitest";
import {
  DescriptorId,
  EServiceDocumentId,
  EServiceEventEnvelopeV2,
  EServiceId,
  TenantId,
  descriptorState,
  eserviceMode,
  generateId,
  technology,
  toEServiceV2,
} from "pagopa-interop-models";
import { toCatalogItemEventNotification } from "../src/models/catalog/catalogItemEventNotificationConverter.js";

const descriptorId: DescriptorId = generateId();
const eserviceId: EServiceId = generateId();
const producerId: TenantId = generateId();
const documentId: EServiceDocumentId = generateId();
const interfaceId: EServiceDocumentId = generateId();
const asyncExchangeCallbackInterfaceId: EServiceDocumentId = generateId();

const document = {
  id: documentId,
  name: "document.pdf",
  contentType: "application/pdf",
  prettyName: "Document",
  path: `eservices/docs/${documentId}/document.pdf`,
  checksum: "document-checksum",
  uploadDate: new Date("2026-05-22T08:02:00.000Z"),
};

const interfaceDocument = {
  id: interfaceId,
  name: "interface.yaml",
  contentType: "application/yaml",
  prettyName: "Interface",
  path: `eservices/docs/${interfaceId}/interface.yaml`,
  checksum: "interface-checksum",
  uploadDate: new Date("2026-05-22T08:00:00.000Z"),
};

const asyncExchangeCallbackInterfaceDocument = {
  id: asyncExchangeCallbackInterfaceId,
  name: "callback.yaml",
  contentType: "application/yaml",
  prettyName: "Callback interface",
  path: `eservices/docs/${asyncExchangeCallbackInterfaceId}/callback.yaml`,
  checksum: "callback-checksum",
  uploadDate: new Date("2026-05-22T08:05:00.000Z"),
};

const eservice = toEServiceV2({
  id: eserviceId,
  producerId,
  name: "eservice name",
  description: "eservice description",
  technology: technology.rest,
  descriptors: [
    {
      id: descriptorId,
      version: "1",
      interface: interfaceDocument,
      asyncExchangeCallbackInterface: asyncExchangeCallbackInterfaceDocument,
      docs: [document],
      state: descriptorState.draft,
      audience: [],
      voucherLifespan: 60,
      dailyCallsPerConsumer: 1,
      dailyCallsTotal: 1,
      agreementApprovalPolicy: "Automatic",
      createdAt: new Date("2026-05-22T07:50:00.000Z"),
      serverUrls: ["https://example.com/callback"],
      attributes: {
        certified: [],
        declared: [],
        verified: [],
      },
    },
  ],
  createdAt: new Date("2026-05-22T07:45:00.000Z"),
  riskAnalysis: [],
  mode: eserviceMode.deliver,
});

const getEnvelope = (
  type: "EServiceDescriptorAsyncExchangeCallbackInterfaceAdded"
): EServiceEventEnvelopeV2 => ({
  sequence_num: 1,
  stream_id: eserviceId,
  version: 1,
  correlation_id: generateId(),
  log_date: new Date("2026-05-22T08:10:00.000Z"),
  event_version: 2,
  type,
  data: {
    descriptorId,
    documentId: asyncExchangeCallbackInterfaceId,
    eservice,
  },
});

const getDocumentUpdatedEnvelope = (
  documentId: EServiceDocumentId
): EServiceEventEnvelopeV2 => ({
  sequence_num: 1,
  stream_id: eserviceId,
  version: 1,
  correlation_id: generateId(),
  log_date: new Date("2026-05-22T08:10:00.000Z"),
  event_version: 2,
  type: "EServiceDescriptorDocumentUpdated",
  data: {
    descriptorId,
    documentId,
    eservice,
  },
});

const toDocumentV1 = <T extends { uploadDate: Date }>(doc: T) => ({
  ...doc,
  uploadDate: doc.uploadDate.toISOString(),
});

describe("toCatalogItemEventNotification", () => {
  it("should convert async exchange callback interface added events using the callback interface document", () => {
    const result = toCatalogItemEventNotification(
      getEnvelope("EServiceDescriptorAsyncExchangeCallbackInterfaceAdded")
    );

    expect(result).toEqual({
      eServiceId: eserviceId,
      descriptorId,
      document: {
        ...asyncExchangeCallbackInterfaceDocument,
        uploadDate:
          asyncExchangeCallbackInterfaceDocument.uploadDate.toISOString(),
      },
      isInterface: true,
      serverUrls: [],
    });
  });

  it("should convert document updated events resolving the document from the descriptor docs", () => {
    const result = toCatalogItemEventNotification(
      getDocumentUpdatedEnvelope(documentId)
    );

    expect(result).toEqual({
      eServiceId: eserviceId,
      descriptorId,
      documentId,
      updatedDocument: toDocumentV1(document),
      serverUrls: ["https://example.com/callback"],
    });
  });

  it("should convert document updated events resolving the document from the descriptor interface", () => {
    const result = toCatalogItemEventNotification(
      getDocumentUpdatedEnvelope(interfaceId)
    );

    expect(result).toEqual({
      eServiceId: eserviceId,
      descriptorId,
      documentId: interfaceId,
      updatedDocument: toDocumentV1(interfaceDocument),
      serverUrls: ["https://example.com/callback"],
    });
  });

  it("should convert document updated events resolving the document from the async exchange callback interface", () => {
    const result = toCatalogItemEventNotification(
      getDocumentUpdatedEnvelope(asyncExchangeCallbackInterfaceId)
    );

    expect(result).toEqual({
      eServiceId: eserviceId,
      descriptorId,
      documentId: asyncExchangeCallbackInterfaceId,
      updatedDocument: toDocumentV1(asyncExchangeCallbackInterfaceDocument),
      serverUrls: ["https://example.com/callback"],
    });
  });
});
