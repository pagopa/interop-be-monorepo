/* eslint-disable @typescript-eslint/explicit-function-return-type */
/* eslint-disable functional/immutable-data */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  AuthorizationEventEnvelopeV2,
  generateId,
  Key,
  ClientV2,
  PurposeId,
  UserId,
  toClientV2,
} from "pagopa-interop-models";
import { FileManager, initFileManager } from "pagopa-interop-commons";
import {
  buildDynamoDBTables,
  deleteDynamoDBTables,
  getMockClient,
  getMockKey,
} from "pagopa-interop-commons-test";
import {
  config as appConfig,
  safeStorageApiConfig,
} from "../../src/config/config.js";
import {
  DbServiceBuilder,
  dbServiceBuilder,
} from "../../src/services/dbService.js";
import { dynamoDBClient } from "../utils/utils.js";
import { readSignatureReference } from "../utils/dbServiceUtils.js";
import { handleAuthorizationMessageV2 } from "../../src/handlers/handleAuthorizationMessageV2.js";
import {
  SafeStorageService,
  createSafeStorageApiClient,
} from "../../src/services/safeStorageService.js";

const fileManager: FileManager = initFileManager(appConfig);
const safeStorageService: SafeStorageService =
  createSafeStorageApiClient(safeStorageApiConfig);
const dbService: DbServiceBuilder = dbServiceBuilder(dynamoDBClient);

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
    await handleAuthorizationMessageV2(
      eventsWithTimestamp,
      fileManager,
      dbService,
      safeStorageService
    );

    const retrievedReference = await readSignatureReference(
      mockSafeStorageId,
      dynamoDBClient
    );

    expect(retrievedReference).toEqual({
      PK: mockSafeStorageId,
      safeStorageId: mockSafeStorageId,
      fileKind: "PLATFORM_EVENTS",
      fileName: expect.stringMatching(/.ndjson.gz$/),
      correlationId: expect.any(String),
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

    const eventsWithTimestamp = [
      { authV2: message, timestamp: new Date().toISOString() },
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
      dbService,
      safeStorageService
    );

    const retrievedReference = await readSignatureReference(
      mockSafeStorageId,
      dynamoDBClient
    );

    expect(retrievedReference).toEqual({
      PK: mockSafeStorageId,
      safeStorageId: mockSafeStorageId,
      fileKind: "PLATFORM_EVENTS",
      fileName: expect.stringMatching(/.ndjson.gz$/),
      correlationId: expect.any(String),
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

    const eventsWithTimestamp = [
      { authV2: message, timestamp: new Date().toISOString() },
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
      dbService,
      safeStorageService
    );

    const retrievedReference = await readSignatureReference(
      mockSafeStorageId,
      dynamoDBClient
    );

    expect(retrievedReference).toEqual({
      PK: mockSafeStorageId,
      safeStorageId: mockSafeStorageId,
      fileKind: "PLATFORM_EVENTS",
      fileName: expect.stringMatching(/.ndjson.gz$/),
      correlationId: expect.any(String),
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

    const eventsWithTimestamp = [
      { authV2: message, timestamp: new Date().toISOString() },
    ];

    const safeStorageCreateFileSpy = vi.spyOn(safeStorageService, "createFile");
    const safeStorageUploadFileSpy = vi.spyOn(
      safeStorageService,
      "uploadFileContent"
    );

    await handleAuthorizationMessageV2(
      eventsWithTimestamp,
      fileManager,
      dbService,
      safeStorageService
    );

    expect(safeStorageCreateFileSpy).not.toHaveBeenCalled();
    expect(safeStorageUploadFileSpy).not.toHaveBeenCalled();

    const retrievedReference = await readSignatureReference(
      mockSafeStorageId,
      dynamoDBClient
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

    const eventsWithTimestamp = [
      { authV2: message, timestamp: new Date().toISOString() },
    ];

    vi.spyOn(safeStorageService, "createFile").mockRejectedValue(
      new Error("Safe Storage API error")
    );

    await expect(
      handleAuthorizationMessageV2(
        eventsWithTimestamp,
        fileManager,
        dbService,
        safeStorageService
      )
    ).rejects.toThrow("Failed to process Safe Storage/DynamoDB for file");
  });
});
