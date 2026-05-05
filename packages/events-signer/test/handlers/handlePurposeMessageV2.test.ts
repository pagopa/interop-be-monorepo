/* eslint-disable @typescript-eslint/explicit-function-return-type */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable functional/immutable-data */
import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import {
  PurposeEventEnvelopeV2,
  generateId,
  PurposeAddedV2,
  PurposeActivatedV2,
  PurposeArchivedV2,
  NewPurposeVersionActivatedV2,
  DraftPurposeUpdatedV2,
  toPurposeV2,
  PurposeVersion,
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
  getMockPurpose,
  getMockPurposeVersion,
} from "pagopa-interop-commons-test";
import { config } from "../../src/config/config.js";
import { dynamoDBClient } from "../utils/utils.js";
import { handlePurposeMessageV2 } from "../../src/handlers/handlePurposeMessageV2.js";

const fileManager: FileManager = initFileManager(config);
const safeStorageService: SafeStorageService =
  createSafeStorageApiClient(config);
const signatureService: SignatureServiceBuilder = signatureServiceBuilder(
  dynamoDBClient,
  config
);

const mockSafeStorageId = generateId();

describe("handlePurposeMessageV2 - Integration Test", () => {
  vi.mock("../../src/handlers/s3UploaderHandler.js", () => ({
    uploadPreparedFileToS3: vi.fn(() => ({
      fileContentBuffer: Buffer.from("test content"),
      fileName: "test-file.ndjson.gz",
      path: "path/to",
    })),
  }));

  beforeEach(async () => {
    vi.clearAllMocks();
    await buildDynamoDBTables(dynamoDBClient);
  });

  afterEach(async () => {
    await deleteDynamoDBTables(dynamoDBClient);
  });

  it("should process a PurposeAdded event and save a reference in DynamoDB", async () => {
    const mockPurpose = getMockPurpose();
    const mockVersion = getMockPurposeVersion();
    mockPurpose.versions = [mockVersion];

    const message: PurposeEventEnvelopeV2 = {
      sequence_num: 1,
      stream_id: mockPurpose.id,
      version: 1,
      event_version: 2,
      type: "PurposeAdded",
      data: {
        purpose: toPurposeV2(mockPurpose),
      } as PurposeAddedV2,
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

    await handlePurposeMessageV2(
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
      path: "path/to",
    });
  });

  it("should process a NewPurposeVersionActivated event and save a reference in DynamoDB", async () => {
    const mockPurpose = getMockPurpose();
    const mockVersion1: PurposeVersion = {
      ...getMockPurposeVersion(),
      id: generateId(),
    };
    const mockVersion2: PurposeVersion = {
      ...getMockPurposeVersion(),
      id: generateId(),
    };
    mockPurpose.versions = [mockVersion1, mockVersion2];

    const message: PurposeEventEnvelopeV2 = {
      sequence_num: 1,
      stream_id: mockPurpose.id,
      version: 1,
      event_version: 2,
      type: "NewPurposeVersionActivated",
      data: {
        purpose: toPurposeV2(mockPurpose),
        versionId: mockVersion2.id,
      } as NewPurposeVersionActivatedV2,
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

    await handlePurposeMessageV2(
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
      path: "path/to",
    });
  });

  it("should process a PurposeArchived event and save a reference in DynamoDB", async () => {
    const mockPurpose = getMockPurpose();
    const mockVersion1: PurposeVersion = {
      ...getMockPurposeVersion(),
      id: generateId(),
    };
    const mockVersion2: PurposeVersion = {
      ...getMockPurposeVersion(),
      id: generateId(),
    };
    mockPurpose.versions = [mockVersion1, mockVersion2];

    const message: PurposeEventEnvelopeV2 = {
      sequence_num: 1,
      stream_id: mockPurpose.id,
      version: 1,
      event_version: 2,
      type: "PurposeArchived",
      data: {
        purpose: toPurposeV2({
          ...mockPurpose,
          versions: mockPurpose.versions,
        }),
      } as PurposeArchivedV2,
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

    await handlePurposeMessageV2(
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
      path: "path/to",
    });
  });

  it("should not process a DraftPurposeUpdated event", async () => {
    const mockPurpose = getMockPurpose();

    const message: PurposeEventEnvelopeV2 = {
      sequence_num: 1,
      stream_id: mockPurpose.id,
      version: 1,
      event_version: 2,
      type: "DraftPurposeUpdated",
      data: { purpose: toPurposeV2(mockPurpose) } as DraftPurposeUpdatedV2,
      log_date: new Date(),
    };

    const eventsWithTimestamp = [{ purposeV2: message, timestamp: new Date() }];

    const safeStorageCreateFileSpy = vi.spyOn(safeStorageService, "createFile");
    const safeStorageUploadFileSpy = vi.spyOn(
      safeStorageService,
      "uploadFileContent"
    );

    await handlePurposeMessageV2(
      eventsWithTimestamp,
      fileManager,
      signatureService,
      safeStorageService
    );

    expect(safeStorageCreateFileSpy).not.toHaveBeenCalled();
    expect(safeStorageUploadFileSpy).not.toHaveBeenCalled();

    const retrievedReference = await signatureService.readSignatureReference(
      generateId(),
      genericLogger
    );
    expect(retrievedReference).toBeUndefined();
  });

  it("should throw an error if file creation fails", async () => {
    const mockPurpose = getMockPurpose();
    const mockVersion = getMockPurposeVersion();
    mockPurpose.versions = [mockVersion];

    const message: PurposeEventEnvelopeV2 = {
      sequence_num: 1,
      stream_id: mockPurpose.id,
      version: 1,
      event_version: 2,
      type: "PurposeActivated",
      data: {
        purpose: toPurposeV2(mockPurpose),
      } as PurposeActivatedV2,
      log_date: new Date(),
    };

    const eventsWithTimestamp = [{ purposeV2: message, timestamp: new Date() }];

    vi.spyOn(safeStorageService, "createFile").mockRejectedValue(
      new Error("Safe Storage API error")
    );

    await expect(
      handlePurposeMessageV2(
        eventsWithTimestamp,
        fileManager,
        signatureService,
        safeStorageService
      )
    ).rejects.toThrow("Failed to process Safe Storage/DynamoDB for file");
  });
});
