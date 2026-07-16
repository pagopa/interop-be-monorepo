import {
  DescriptorId,
  EServiceDescriptorStateV2,
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
import { describe, expect, it } from "vitest";

import { toCatalogItemEventNotification } from "../src/models/catalog/catalogItemEventNotificationConverter.js";

const descriptorId: DescriptorId = generateId();
const eserviceId: EServiceId = generateId();
const producerId: TenantId = generateId();
const interfaceId: EServiceDocumentId = generateId();
const asyncExchangeCallbackInterfaceId: EServiceDocumentId = generateId();

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
      docs: [],
      state: descriptorState.draft,
      audience: [],
      voucherLifespan: 60,
      dailyCallsPerConsumer: 1,
      dailyCallsTotal: 1,
      agreementApprovalPolicy: "Automatic",
      createdAt: new Date("2026-05-22T07:50:00.000Z"),
      serverUrls: ["https://example.com/callback"],
      serverUrlsDescriptions: [],
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
  type:
    | "EServiceDescriptorAsyncExchangeCallbackInterfaceAdded"
    | "EServiceDescriptorAsyncExchangeCallbackInterfaceUpdated"
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

const getDescriptorStateEnvelope = (
  state:
    | typeof EServiceDescriptorStateV2.ARCHIVING
    | typeof EServiceDescriptorStateV2.ARCHIVING_SUSPENDED
): EServiceEventEnvelopeV2 => {
  const eserviceWithDescriptorState = {
    ...eservice,
    descriptors: eservice.descriptors.map((descriptor) => ({
      ...descriptor,
      state,
    })),
  };

  return {
    sequence_num: 1,
    stream_id: eserviceId,
    version: 1,
    correlation_id: generateId(),
    log_date: new Date("2026-05-22T08:10:00.000Z"),
    event_version: 2,
    type: "EServiceDescriptorArchivingScheduled",
    data: {
      descriptorId,
      eservice: eserviceWithDescriptorState,
    },
  };
};

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

  it("should convert async exchange callback interface updated events using the callback interface document", () => {
    const result = toCatalogItemEventNotification(
      getEnvelope("EServiceDescriptorAsyncExchangeCallbackInterfaceUpdated")
    );

    expect(result).toEqual({
      eServiceId: eserviceId,
      descriptorId,
      documentId: asyncExchangeCallbackInterfaceId,
      updatedDocument: {
        ...asyncExchangeCallbackInterfaceDocument,
        uploadDate:
          asyncExchangeCallbackInterfaceDocument.uploadDate.toISOString(),
      },
      serverUrls: [],
    });
  });

  it("should map descriptor state archiving to Deprecated for v1 compatibility", () => {
    const result = toCatalogItemEventNotification(
      getDescriptorStateEnvelope(EServiceDescriptorStateV2.ARCHIVING)
    );

    expect(result).toMatchObject({
      eServiceId: eserviceId,
      catalogDescriptor: {
        id: descriptorId,
        state: "Deprecated",
      },
    });
  });

  it("should map descriptor state archivingSuspended to Suspended for v1 compatibility", () => {
    const result = toCatalogItemEventNotification(
      getDescriptorStateEnvelope(EServiceDescriptorStateV2.ARCHIVING_SUSPENDED)
    );

    expect(result).toMatchObject({
      eServiceId: eserviceId,
      catalogDescriptor: {
        id: descriptorId,
        state: "Suspended",
      },
    });
  });
});
