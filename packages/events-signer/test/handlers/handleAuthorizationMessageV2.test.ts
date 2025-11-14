/* eslint-disable @typescript-eslint/explicit-function-return-type */
/* eslint-disable functional/immutable-data */

import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import {
  AuthorizationEventEnvelopeV2,
  generateId,
  Key,
  ClientV2,
  PurposeId,
  UserId,
  toClientV2,
} from "pagopa-interop-models";
import {
  FileManager,
  initFileManager,
  SafeStorageService,
  createSafeStorageApiClient,
  SignatureServiceBuilder,
  signatureServiceBuilder,
} from "pagopa-interop-commons";
import {
  buildDynamoDBTables,
  deleteDynamoDBTables,
  getMockClient,
  getMockKey,
} from "pagopa-interop-commons-test";
import { config } from "../../src/config/config.js";
import { dynamoDBClient } from "../utils/utils.js";
import { handleAuthorizationMessageV2 } from "../../src/handlers/handleAuthorizationMessageV2.js";

const fileManager: FileManager = initFileManager(config);
const safeStorageService: SafeStorageService =
  createSafeStorageApiClient(config);
const signatureService: SignatureServiceBuilder = signatureServiceBuilder(
  dynamoDBClient,
  config
);

const mockSafeStorageId = generateId();

describe("handleAuthorizationMessageV2 - Integration Test", () => {
  vi.mock("../../src/handlers/s3UploaderHandler.js", () => ({
    uploadPreparedFileToS3: vi.fn(() => ({
      fileContentBuffer: Buffer.from("test content"),
      fileName: "test-file.ndjson.gz",
    })),
  }));

  beforeEach(async () => {
    vi.clearAllMocks();
    await buildDynamoDBTables(dynamoDBClient);
  });

  afterEach(async () => {
    await deleteDynamoDBTables(dynamoDBClient);
  });

  it("should process a ClientKeyAdded event and save a reference in DynamoDB", async () => {
    const mockClient = getMockClient();
    const userId: UserId = generateId<UserId>();
    const purposeId: PurposeId = generateId();
    const key: Key = { ...getMockKey(), userId };

    const client: ClientV2 = toClientV2({
      ...mockClient,
      users: [userId],
      purposes: [purposeId],
      keys: [key],
    });

    const message: AuthorizationEventEnvelopeV2 = {
      sequence_num: 1,
      stream_id: client.id,
      version: 1,
      type: "ClientKeyAdded",
      event_version: 2,
      data: {
        client,
        kid: key.kid,
      },
      log_date: new Date(),
    };

    const eventsWithTimestamp = [
      {
        authV2: message,
        timestamp: new Date(),
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
    await handleAuthorizationMessageV2(
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

  it("should process a ClientKeyDeleted event and save a reference in DynamoDB", async () => {
    const mockClient = getMockClient();
    const userId: UserId = generateId<UserId>();
    const purposeId: PurposeId = generateId();
    const key: Key = { ...getMockKey(), userId };

    const client: ClientV2 = toClientV2({
      ...mockClient,
      users: [userId],
      purposes: [purposeId],
      keys: [key],
    });

    const message: AuthorizationEventEnvelopeV2 = {
      sequence_num: 1,
      stream_id: client.id,
      version: 1,
      type: "ClientKeyDeleted",
      event_version: 2,
      data: {
        client,
        kid: key.kid,
      },
      log_date: new Date(),
    };

    const eventsWithTimestamp = [{ authV2: message, timestamp: new Date() }];

    vi.spyOn(safeStorageService, "createFile").mockResolvedValue({
      uploadMethod: "POST",
      uploadUrl: "mock-upload-url",
      secret: "mock-secret",
      key: mockSafeStorageId,
    });
    vi.spyOn(safeStorageService, "uploadFileContent").mockResolvedValue(
      undefined
    );
    await handleAuthorizationMessageV2(
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

  it("should process a ClientDeleted event and save a reference in DynamoDB", async () => {
    const mockClient = getMockClient();
    const userId: UserId = generateId<UserId>();
    const purposeId: PurposeId = generateId();
    const key: Key = { ...getMockKey(), userId };

    const client: ClientV2 = toClientV2({
      ...mockClient,
      users: [userId],
      purposes: [purposeId],
      keys: [key],
    });

    const message: AuthorizationEventEnvelopeV2 = {
      sequence_num: 1,
      stream_id: client.id,
      version: 1,
      type: "ClientDeleted",
      event_version: 2,
      data: { client, clientId: generateId() },
      log_date: new Date(),
    };

    const eventsWithTimestamp = [{ authV2: message, timestamp: new Date() }];

    vi.spyOn(safeStorageService, "createFile").mockResolvedValue({
      uploadMethod: "POST",
      uploadUrl: "mock-upload-url",
      secret: "mock-secret",
      key: mockSafeStorageId,
    });
    vi.spyOn(safeStorageService, "uploadFileContent").mockResolvedValue(
      undefined
    );
    await handleAuthorizationMessageV2(
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

  it("should not process a ClientAdded event", async () => {
    const mockClient = getMockClient();
    const userId: UserId = generateId<UserId>();
    const purposeId: PurposeId = generateId();
    const key: Key = { ...getMockKey(), userId };

    const client: ClientV2 = toClientV2({
      ...mockClient,
      users: [userId],
      purposes: [purposeId],
      keys: [key],
    });

    const message: AuthorizationEventEnvelopeV2 = {
      sequence_num: 1,
      stream_id: client.id,
      version: 1,
      type: "ClientAdded",
      event_version: 2,
      data: { client },
      log_date: new Date(),
    };

    const eventsWithTimestamp = [{ authV2: message, timestamp: new Date() }];

    const safeStorageCreateFileSpy = vi.spyOn(safeStorageService, "createFile");
    const safeStorageUploadFileSpy = vi.spyOn(
      safeStorageService,
      "uploadFileContent"
    );

    await handleAuthorizationMessageV2(
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
    const mockClient = getMockClient();
    const userId: UserId = generateId<UserId>();
    const purposeId: PurposeId = generateId();
    const key: Key = { ...getMockKey(), userId };

    const client: ClientV2 = toClientV2({
      ...mockClient,
      users: [userId],
      purposes: [purposeId],
      keys: [key],
    });

    const message: AuthorizationEventEnvelopeV2 = {
      sequence_num: 1,
      stream_id: client.id,
      version: 1,
      type: "ClientKeyAdded",
      event_version: 2,
      data: {
        client,
        kid: key.kid,
      },
      log_date: new Date(),
    };

    const eventsWithTimestamp = [{ authV2: message, timestamp: new Date() }];

    vi.spyOn(safeStorageService, "createFile").mockRejectedValue(
      new Error("Safe Storage API error")
    );

    await expect(
      handleAuthorizationMessageV2(
        eventsWithTimestamp,
        fileManager,
        signatureService,
        safeStorageService
      )
    ).rejects.toThrow("Failed to process Safe Storage/DynamoDB for file");
  });
});
