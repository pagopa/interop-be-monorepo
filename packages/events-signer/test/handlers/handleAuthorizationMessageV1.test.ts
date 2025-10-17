/* eslint-disable @typescript-eslint/explicit-function-return-type */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable functional/immutable-data */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  generateId,
  AuthorizationEventEnvelopeV1,
  Client,
  KeysAddedV1,
  toKeyV1,
  ClientAddedV1,
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
import { handleAuthorizationMessageV1 } from "../../src/handlers/handleAuthorizationMessageV1.js";
import {
  SafeStorageService,
  createSafeStorageApiClient,
} from "../../src/services/safeStorageService.js";

const fileManager: FileManager = initFileManager(appConfig);
const safeStorageService: SafeStorageService =
  createSafeStorageApiClient(safeStorageApiConfig);
const dbService: DbServiceBuilder = dbServiceBuilder(dynamoDBClient);

const mockSafeStorageId = generateId();

describe("handleAuthorizationMessageV1 - Integration Test", () => {
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

  it("should process an KeysAdded event and save a reference in DynamoDB", async () => {
    const key = getMockKey();
    const client: Client = {
      ...getMockClient(),
      keys: [key],
    };

    const payload: KeysAddedV1 = {
      clientId: client.id,
      keys: [
        {
          keyId: generateId(),
          value: toKeyV1(key),
        },
      ],
    };
    const message: AuthorizationEventEnvelopeV1 = {
      sequence_num: 1,
      stream_id: client.id,
      version: 1,
      type: "KeysAdded",
      event_version: 1,
      data: payload,
      log_date: new Date(),
    };

    const eventsWithTimestamp = [
      {
        authV1: message,
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

    await handleAuthorizationMessageV1(
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

  it("should process a KeyDeleted event and save a reference in DynamoDB", async () => {
    const clientId = generateId();
    const message: AuthorizationEventEnvelopeV1 = {
      sequence_num: 1,
      stream_id: clientId,
      version: 1,
      type: "KeyDeleted",
      event_version: 1,
      data: {
        clientId,
        keyId: "test-kid",
        deactivationTimestamp: Date.now().toString(),
      },
      log_date: new Date(),
    };

    const eventsWithTimestamp = [
      { authV1: message, timestamp: new Date().toISOString() },
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

    await handleAuthorizationMessageV1(
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
    const clientId = generateId();
    const message: AuthorizationEventEnvelopeV1 = {
      sequence_num: 1,
      stream_id: clientId,
      version: 1,
      type: "ClientAdded",
      event_version: 1,
      data: { clientId } as ClientAddedV1,
      log_date: new Date(),
    };

    const eventsWithTimestamp = [
      { authV1: message, timestamp: new Date().toISOString() },
    ];

    const safeStorageCreateFileSpy = vi.spyOn(safeStorageService, "createFile");
    const safeStorageUploadFileSpy = vi.spyOn(
      safeStorageService,
      "uploadFileContent"
    );

    await handleAuthorizationMessageV1(
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
    const key = getMockKey();
    const client: Client = {
      ...getMockClient(),
      keys: [key],
    };

    const payload: KeysAddedV1 = {
      clientId: client.id,
      keys: [
        {
          keyId: generateId(),
          value: toKeyV1(key),
        },
      ],
    };
    const message: AuthorizationEventEnvelopeV1 = {
      sequence_num: 1,
      stream_id: client.id,
      version: 1,
      type: "KeysAdded",
      event_version: 1,
      data: payload,
      log_date: new Date(),
    };

    const eventsWithTimestamp = [
      { authV1: message, timestamp: new Date().toISOString() },
    ];

    vi.spyOn(safeStorageService, "createFile").mockRejectedValue(
      new Error("Safe Storage API error")
    );

    await expect(
      handleAuthorizationMessageV1(
        eventsWithTimestamp,
        fileManager,
        dbService,
        safeStorageService
      )
    ).rejects.toThrow("Failed to process Safe Storage/DynamoDB for file");
  });
});
