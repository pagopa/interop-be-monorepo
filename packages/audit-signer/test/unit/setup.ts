/* eslint-disable functional/immutable-data */
process.env.CATALOG_TOPIC = "mock-catalog-topic";
process.env.AGREEMENT_TOPIC = "mock-agreement-topic";
process.env.AUTHORIZATION_TOPIC = "mock-authorization-topic";
process.env.PURPOSE_TOPIC = "mock-purpose-topic";
process.env.DELEGATION_TOPIC = "mock-delegation-topic";
process.env.SIGNATURE_REFERENCES_TABLE_NAME = "mock-table";
process.env.AVERAGE_KAFKA_MESSAGE_SIZE_IN_BYTES = "1024";
process.env.MESSAGES_TO_READ_PER_BATCH = "10";
process.env.MAX_WAIT_KAFKA_BATCH_MILLIS = "500";

import { vi } from "vitest";
import { Logger, FileManager } from "pagopa-interop-commons";

export const mockLoggerInstance: Logger = {
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn(),
  debug: vi.fn(),
  isDebugEnabled: vi.fn(),
};

export const mockFileManager: FileManager = {
  get: vi.fn(),
  delete: vi.fn(),
  copy: vi.fn(),
  storeBytes: vi.fn(),
  storeBytesByKey: vi.fn(),
  listFiles: vi.fn(),
  generateGetPresignedUrl: vi.fn(),
  generatePutPresignedUrl: vi.fn(),
  resumeOrStoreBytes: vi.fn(),
};

export const mockDbService = {
  saveSignatureReference: vi.fn(),
  saveDocumentSignatureReference: vi.fn(),
  readSignatureReference: vi.fn(),
  deleteSignatureReference: vi.fn(),
  readDocumentSignatureReference: vi.fn(),
  readSignatureReferenceById: vi.fn(),
};

export const mockSafeStorageService = {
  createFile: vi.fn(),
  uploadFileContent: vi.fn(),
  getFile: vi.fn(),
  downloadFileContent: vi.fn(),
};

vi.mock("pagopa-interop-models", async (importOriginal) => {
  const actual = await importOriginal<typeof import("pagopa-interop-models")>();
  return { ...actual, generateId: vi.fn() };
});

vi.mock("pagopa-interop-commons", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("pagopa-interop-commons")>();
  return { ...actual, logger: vi.fn(() => mockLoggerInstance) };
});

vi.mock("../src/utils/decodeSQSEventMessage.js");
vi.mock("../src/utils/compression.js");
vi.mock("../src/utils/checksum.js");

vi.mock("../src/config/config.js", async () => ({
  config: {
    serviceName: "mock-service",
    s3Bucket: "mock-bucket",
    signatureReferencesTableName: "mock-table",
    CATALOG_TOPIC: "mock-catalog-topic",
    AGREEMENT_TOPIC: "mock-agreement-topic",
    AUTHORIZATION_TOPIC: "mock-authorization-topic",
    PURPOSE_TOPIC: "mock-purpose-topic",
    DELEGATION_TOPIC: "mock-delegation-topic",
    AVERAGE_KAFKA_MESSAGE_SIZE_IN_BYTES: 1024,
    MESSAGES_TO_READ_PER_BATCH: 10,
    MAX_WAIT_KAFKA_BATCH_MILLIS: 500,
  },
  safeStorageApiConfig: {
    safeStorageDocType: "AUDIT_EVENTS",
    safeStorageDocStatus: "CREATED",
  },
}));
