/* eslint-disable @typescript-eslint/explicit-function-return-type */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable functional/immutable-data */
import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import {
  AgreementAddedV2,
  generateId,
  AgreementEventEnvelopeV2,
  toAgreementV2,
} from "pagopa-interop-models";
import { FileManager, initFileManager } from "pagopa-interop-commons";
import {
  buildDynamoDBTables,
  deleteDynamoDBTables,
  getMockAgreement,
} from "pagopa-interop-commons-test";
import {
  SafeStorageService,
  createSafeStorageApiClient,
  SignatureServiceBuilder,
  signatureServiceBuilder,
} from "pagopa-interop-commons";
import { config } from "../../src/config/config.js";
import { dynamoDBClient } from "../utils/utils.js";
import { handleAgreementMessageV2 } from "../../src/handlers/handleAgreementMessageV2.js";

const fileManager: FileManager = initFileManager(config);
const safeStorageService: SafeStorageService =
  createSafeStorageApiClient(config);
const signatureService: SignatureServiceBuilder = signatureServiceBuilder(
  dynamoDBClient,
  config
);

const mockSafeStorageId = generateId();

describe("handleAgreementMessageV2 - Integration Test", () => {
  vi.mock("../../src/handlers/s3UploaderHandler.js", () => ({
    uploadPreparedFileToS3: vi.fn(() => ({
      fileContentBuffer: Buffer.from("test content"),
      fileName: "test-file.ndjson.gz",
      correlationId: "correlation-id",
      filename: "filename.gz",
    })),
  }));

  beforeEach(async () => {
    vi.clearAllMocks();
    await buildDynamoDBTables(dynamoDBClient);
  });

  afterEach(async () => {
    await deleteDynamoDBTables(dynamoDBClient);
  });

  it("should process an AgreementActivated event and save a reference in DynamoDB", async () => {
    const mock = getMockAgreement();

    const addMsg: AgreementEventEnvelopeV2 = {
      sequence_num: 1,
      stream_id: mock.id,
      version: 1,
      event_version: 2,
      type: "AgreementSubmitted",
      data: { agreement: toAgreementV2(mock) } as AgreementAddedV2,
      log_date: new Date(),
    };

    const eventsWithTimestamp = [
      {
        agreementV2: addMsg,
        timestamp: new Date().toISOString(),
      },
    ];

    safeStorageService.createFile = vi.fn().mockResolvedValue({
      uploadUrl: "mock-upload-url",
      secret: "mock-secret",
      key: mockSafeStorageId,
    });
    safeStorageService.uploadFileContent = vi.fn().mockResolvedValue(undefined);

    await handleAgreementMessageV2(
      eventsWithTimestamp,
      fileManager,
      signatureService,
      safeStorageService
    );

    const retrievedReference = await signatureService.readSignatureReference(
      mockSafeStorageId
    );

    expect(retrievedReference).toEqual({
      safeStorageId: mockSafeStorageId,
      fileKind: "EVENT_JOURNAL",
      fileName: expect.stringMatching(/.ndjson.gz$/),
      correlationId: expect.any(String),
      creationTimestamp: expect.any(Number),
    });
  });
  it("should not process an AgreementAdded event", async () => {
    const mock = getMockAgreement();
    const addMsg: AgreementEventEnvelopeV2 = {
      sequence_num: 1,
      stream_id: mock.id,
      version: 1,
      event_version: 2,
      type: "AgreementAdded",
      data: { agreement: toAgreementV2(mock) } as AgreementAddedV2,
      log_date: new Date(),
    };

    const eventsWithTimestamp = [
      {
        agreementV2: addMsg,
        timestamp: new Date().toISOString(),
      },
    ];

    const safeStorageCreateFileSpy = vi.spyOn(safeStorageService, "createFile");
    const safeStorageUploadFileSpy = vi.spyOn(
      safeStorageService,
      "uploadFileContent"
    );

    await handleAgreementMessageV2(
      eventsWithTimestamp,
      fileManager,
      signatureService,
      safeStorageService
    );

    expect(safeStorageCreateFileSpy).not.toHaveBeenCalled();
    expect(safeStorageUploadFileSpy).not.toHaveBeenCalled();

    const retrievedReference = await signatureService.readSignatureReference(
      generateId()
    );
    expect(retrievedReference).toBeUndefined();
  });
  it("should throw an error if file creation fails", async () => {
    const mock = getMockAgreement();
    const addMsg: AgreementEventEnvelopeV2 = {
      sequence_num: 1,
      stream_id: mock.id,
      version: 1,
      event_version: 2,
      type: "AgreementSubmitted",
      data: { agreement: toAgreementV2(mock) } as AgreementAddedV2,
      log_date: new Date(),
    };

    const eventsWithTimestamp = [
      {
        agreementV2: addMsg,
        timestamp: new Date().toISOString(),
      },
    ];

    vi.spyOn(safeStorageService, "createFile").mockRejectedValue(
      new Error("Safe Storage API error")
    );

    await expect(
      handleAgreementMessageV2(
        eventsWithTimestamp,
        fileManager,
        signatureService,
        safeStorageService
      )
    ).rejects.toThrow("Failed to process Safe Storage/DynamoDB for file");
  });
});
