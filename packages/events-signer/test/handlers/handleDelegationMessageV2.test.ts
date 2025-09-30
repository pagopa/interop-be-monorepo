/* eslint-disable @typescript-eslint/explicit-function-return-type */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable functional/immutable-data */
import { describe, it, expect, beforeEach, vi, beforeAll } from "vitest";
import {
  DelegationEventEnvelopeV2,
  generateId,
  toDelegationV2,
  unsafeBrandId,
  TenantId,
  EServiceId,
} from "pagopa-interop-models";
import {
  FileManager,
  initFileManager,
  SafeStorageService,
  createSafeStorageApiClient,
  DbServiceBuilder,
  dbServiceBuilder,
} from "pagopa-interop-commons";
import {
  getMockDelegation,
} from "pagopa-interop-commons-test";
import { config } from "../../src/config/config.js";
import { createTableIfNotExists, dynamoDBClient, waitForTable } from "../utils/utils.js";
import { handleDelegationMessageV2 } from "../../src/handlers/handleDelegationMessageV2.js";

const fileManager: FileManager = initFileManager(config);
const safeStorageService: SafeStorageService =
  createSafeStorageApiClient(config);
const dbService: DbServiceBuilder = dbServiceBuilder(dynamoDBClient, config);

const mockSafeStorageId = generateId();

describe("handleDelegationMessageV2 - Integration Test", () => {
  vi.mock("../../src/handlers/s3UploaderHandler.js", () => ({
    uploadPreparedFileToS3: vi.fn(() => ({
      fileContentBuffer: Buffer.from("test content"),
      fileName: "test-file.ndjson.gz",
    })),
  }));

  beforeAll(async () => {
    await createTableIfNotExists(config.signatureReferencesTableName);
    await waitForTable(config.signatureReferencesTableName);
  });

  beforeEach(async () => {
    vi.clearAllMocks();
  });


  it("should process a ProducerDelegationApproved event and save a reference in DynamoDB", async () => {
    const mockDelegation = getMockDelegation({
      delegatorId: unsafeBrandId<TenantId>(generateId()),
      kind: "DelegatedProducer",
      state: "Active",
      eserviceId: unsafeBrandId<EServiceId>(generateId()),
    });

    const message: DelegationEventEnvelopeV2 = {
      sequence_num: 1,
      stream_id: mockDelegation.id,
      version: 1,
      event_version: 2,
      type: "ProducerDelegationApproved",
      data: {
        delegation: toDelegationV2(mockDelegation as any),
      },
      log_date: new Date(),
    };

    const eventsWithTimestamp = [
      {
        delegationV2: message,
        timestamp: new Date().toISOString(),
      },
    ];

    vi.spyOn(safeStorageService, "createFile").mockResolvedValue({
      uploadMethod: "POST",
      uploadUrl: "mock-upload-url",
      secret: "mock-secret",
      key: mockSafeStorageId,
    });
    vi.spyOn(safeStorageService, "uploadFileContent").mockResolvedValue(
      undefined
    );

    await handleDelegationMessageV2(
      eventsWithTimestamp,
      fileManager,
      dbService,
      safeStorageService
    );

    const retrievedReference = await dbService.readSignatureReference(
      mockSafeStorageId
    );

    expect(retrievedReference).toEqual({
      safeStorageId: mockSafeStorageId,
      fileKind: "EVENT_JOURNAL",
      fileName: expect.stringMatching(/.ndjson.gz$/),
      correlationId: expect.any(String),
    });
  });

  it("should not process a ProducerDelegationSubmitted event", async () => {
    const mockDelegation = getMockDelegation({
      delegatorId: unsafeBrandId<TenantId>(generateId()),
      kind: "DelegatedProducer",
      state: "Active",
      eserviceId: unsafeBrandId<EServiceId>(generateId()),
    });

    const message: DelegationEventEnvelopeV2 = {
      sequence_num: 1,
      stream_id: mockDelegation.id,
      version: 1,
      event_version: 2,
      type: "ProducerDelegationSubmitted",
      data: {
        delegation: toDelegationV2(mockDelegation as any),
      },
      log_date: new Date(),
    };

    const eventsWithTimestamp = [
      {
        delegationV2: message,
        timestamp: new Date().toISOString(),
      },
    ];

    const safeStorageCreateFileSpy = vi.spyOn(safeStorageService, "createFile");
    const safeStorageUploadFileSpy = vi.spyOn(
      safeStorageService,
      "uploadFileContent"
    );

    await handleDelegationMessageV2(
      eventsWithTimestamp,
      fileManager,
      dbService,
      safeStorageService
    );

    expect(safeStorageCreateFileSpy).not.toHaveBeenCalled();
    expect(safeStorageUploadFileSpy).not.toHaveBeenCalled();

    const retrievedReference = await dbService.readSignatureReference(
      generateId()
    );
    expect(retrievedReference).toBeUndefined();
  });

  it("should throw an error if file creation fails", async () => {
    const mockDelegation = getMockDelegation({
      delegatorId: unsafeBrandId<TenantId>(generateId()),
      kind: "DelegatedProducer",
      state: "Active",
      eserviceId: unsafeBrandId<EServiceId>(generateId()),
    });

    const message: DelegationEventEnvelopeV2 = {
      sequence_num: 1,
      stream_id: mockDelegation.id,
      version: 1,
      event_version: 2,
      type: "ProducerDelegationApproved",
      data: {
        delegation: toDelegationV2(mockDelegation as any),
      },
      log_date: new Date(),
    };

    const eventsWithTimestamp = [
      {
        delegationV2: message,
        timestamp: new Date().toISOString(),
      },
    ];

    vi.spyOn(safeStorageService, "createFile").mockRejectedValue(
      new Error("Safe Storage API error")
    );

    await expect(
      handleDelegationMessageV2(
        eventsWithTimestamp,
        fileManager,
        dbService,
        safeStorageService
      )
    ).rejects.toThrow("Failed to process Safe Storage/DynamoDB for file");
  });
});
