/* eslint-disable @typescript-eslint/explicit-function-return-type */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable functional/immutable-data */
import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import {
  PurposeTemplateEventEnvelopeV2,
  generateId,
  PurposeTemplateAddedV2,
  PurposeTemplateArchivedV2,
  toPurposeTemplateV2,
} from "pagopa-interop-models";
import {
  FileManager,
  initFileManager,
  SafeStorageService,
  createSafeStorageApiClient,
  SignatureServiceBuilder,
  signatureServiceBuilder,
  genericLogger,
} from "pagopa-interop-commons";
import {
  buildDynamoDBTables,
  deleteDynamoDBTables,
  getMockPurposeTemplate,
} from "pagopa-interop-commons-test";
import { config } from "../../src/config/config.js";
import { dynamoDBClient } from "../utils/utils.js";
import { handlePurposeTemplateMessageV2 } from "../../src/handlers/handlePurposeTemplateMessageV2.js";

const fileManager: FileManager = initFileManager(config);
const safeStorageService: SafeStorageService =
  createSafeStorageApiClient(config);
const signatureService: SignatureServiceBuilder = signatureServiceBuilder(
  dynamoDBClient,
  config
);

const mockSafeStorageId = generateId();

describe("handlePurposeTemplateMessageV2 - Integration Test", () => {
  vi.mock("../../src/handlers/s3UploaderHandler.js", () => ({
    uploadPreparedFileToS3: vi.fn(() => ({
      fileContentBuffer: Buffer.from("test content"),
      fileName: "test-template-file.ndjson.gz",
      path: "templates/path",
    })),
  }));

  beforeEach(async () => {
    vi.clearAllMocks();
    await buildDynamoDBTables(dynamoDBClient);
  });

  afterEach(async () => {
    await deleteDynamoDBTables(dynamoDBClient);
  });

  it("should process a PurposeTemplateAdded event and save a reference in DynamoDB", async () => {
    const mockTemplate = getMockPurposeTemplate();

    const message: PurposeTemplateEventEnvelopeV2 = {
      sequence_num: 1,
      stream_id: mockTemplate.id,
      version: 1,
      event_version: 2,
      type: "PurposeTemplateAdded",
      data: {
        purposeTemplate: toPurposeTemplateV2(mockTemplate),
      } as PurposeTemplateAddedV2,
      log_date: new Date(),
    };

    const eventsWithTimestamp = [{ purposeV2: message, timestamp: new Date() }];

    vi.spyOn(safeStorageService, "createFile").mockResolvedValue({
      uploadMethod: "POST",
      uploadUrl: "mock-upload-url",
      secret: "mock-secret",
      key: mockSafeStorageId,
    });
    vi.spyOn(safeStorageService, "uploadFileContent").mockResolvedValue(
      undefined
    );

    await handlePurposeTemplateMessageV2(
      eventsWithTimestamp,
      fileManager,
      signatureService,
      safeStorageService
    );

    const retrievedReference = await signatureService.readSignatureReference(
      mockSafeStorageId,
      genericLogger
    );

    expect(retrievedReference).toEqual({
      safeStorageId: mockSafeStorageId,
      fileKind: "EVENT_JOURNAL",
      fileName: expect.stringMatching(/.ndjson.gz$/),
      correlationId: expect.any(String),
      creationTimestamp: expect.any(Number),
      path: "templates/path",
    });
  });

  it("should process a PurposeTemplateArchived event", async () => {
    const mockTemplate = getMockPurposeTemplate();

    const message: PurposeTemplateEventEnvelopeV2 = {
      sequence_num: 1,
      stream_id: mockTemplate.id,
      version: 1,
      event_version: 2,
      type: "PurposeTemplateArchived",
      data: {
        purposeTemplate: toPurposeTemplateV2(mockTemplate),
      } as PurposeTemplateArchivedV2,
      log_date: new Date(),
    };

    const eventsWithTimestamp = [{ purposeV2: message, timestamp: new Date() }];

    vi.spyOn(safeStorageService, "createFile").mockResolvedValue({
      uploadMethod: "POST",
      uploadUrl: "mock-upload-url",
      secret: "mock-secret",
      key: mockSafeStorageId,
    });

    await handlePurposeTemplateMessageV2(
      eventsWithTimestamp,
      fileManager,
      signatureService,
      safeStorageService
    );

    const retrievedReference = await signatureService.readSignatureReference(
      mockSafeStorageId,
      genericLogger
    );
    expect(retrievedReference).toBeDefined();
  });

  it("should not process a PurposeTemplateDraftUpdated event", async () => {
    const mockTemplate = getMockPurposeTemplate();

    const message: PurposeTemplateEventEnvelopeV2 = {
      sequence_num: 1,
      stream_id: mockTemplate.id,
      version: 1,
      event_version: 2,
      type: "PurposeTemplateDraftUpdated",
      data: {
        purposeTemplate: toPurposeTemplateV2(mockTemplate),
      } as any,
      log_date: new Date(),
    };

    const eventsWithTimestamp = [{ purposeV2: message, timestamp: new Date() }];

    const safeStorageCreateFileSpy = vi.spyOn(safeStorageService, "createFile");

    await handlePurposeTemplateMessageV2(
      eventsWithTimestamp,
      fileManager,
      signatureService,
      safeStorageService
    );

    expect(safeStorageCreateFileSpy).not.toHaveBeenCalled();
  });

  it("should throw an error if purposeTemplate id is missing", async () => {
    const message: PurposeTemplateEventEnvelopeV2 = {
      sequence_num: 1,
      stream_id: "stream-id",
      version: 1,
      event_version: 2,
      type: "PurposeTemplateAdded",
      data: {
        purposeTemplate: undefined,
      } as any,
      log_date: new Date(),
    };

    const eventsWithTimestamp = [{ purposeV2: message, timestamp: new Date() }];

    await expect(
      handlePurposeTemplateMessageV2(
        eventsWithTimestamp,
        fileManager,
        signatureService,
        safeStorageService
      )
    ).rejects.toThrow(
      "Invalid message: missing data 'id' in PurposeTemplateAdded event"
    );
  });
});
