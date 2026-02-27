/* eslint-disable @typescript-eslint/explicit-function-return-type */
/* eslint-disable functional/no-let */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable functional/immutable-data */

import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import {
  EServiceEventEnvelopeV2,
  generateId,
  EServiceDescriptorActivatedV2,
  EServiceAddedV2,
  toEServiceV2,
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
  getMockDescriptorPublished,
  getMockEService,
} from "pagopa-interop-commons-test";
import { config } from "../../src/config/config.js";
import { dynamoDBClient } from "../utils/utils.js";
import { handleCatalogMessageV2 } from "../../src/handlers/handleCatalogMessageV2.js";

const fileManager: FileManager = initFileManager(config);
const safeStorageService: SafeStorageService =
  createSafeStorageApiClient(config);
const signatureService: SignatureServiceBuilder = signatureServiceBuilder(
  dynamoDBClient,
  config
);

const mockSafeStorageId = generateId();

describe("handleCatalogMessageV2 - Integration Test", () => {
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

  it("should process an EServiceDescriptorActivated event and save a reference in DynamoDB", async () => {
    const descriptor = getMockDescriptorPublished();
    const mockEService = getMockEService(undefined, undefined, [descriptor]);
    const descriptorId = mockEService.descriptors[0].id;

    const message: EServiceEventEnvelopeV2 = {
      sequence_num: 1,
      stream_id: mockEService.id,
      version: 1,
      event_version: 2,
      type: "EServiceDescriptorActivated",
      data: {
        eservice: toEServiceV2({
          ...mockEService,
          descriptors: [
            {
              ...mockEService.descriptors[0],
              state: "Published",
            },
          ],
        }),
        descriptorId,
      } as EServiceDescriptorActivatedV2,
      log_date: new Date(),
    };

    const eventsWithTimestamp = [
      {
        eserviceV2: message,
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

    await handleCatalogMessageV2(
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

  it("should not process an EServiceAdded event", async () => {
    const descriptor = getMockDescriptorPublished();
    const mockEService = getMockEService(undefined, undefined, [descriptor]);

    const message: EServiceEventEnvelopeV2 = {
      sequence_num: 1,
      stream_id: mockEService.id,
      version: 1,
      event_version: 2,
      type: "EServiceAdded",
      data: {
        eservice: toEServiceV2(mockEService),
      } as EServiceAddedV2,
      log_date: new Date(),
    };

    const eventsWithTimestamp = [
      {
        eserviceV2: message,
        timestamp: new Date(),
      },
    ];

    const safeStorageCreateFileSpy = vi.spyOn(safeStorageService, "createFile");
    const safeStorageUploadFileSpy = vi.spyOn(
      safeStorageService,
      "uploadFileContent"
    );

    await handleCatalogMessageV2(
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
    const descriptor = getMockDescriptorPublished();
    const mockEService = getMockEService(undefined, undefined, [descriptor]);
    const descriptorId = mockEService.descriptors[0].id;

    const message: EServiceEventEnvelopeV2 = {
      sequence_num: 1,
      stream_id: mockEService.id,
      version: 1,
      event_version: 2,
      type: "EServiceDescriptorActivated",
      data: {
        eservice: toEServiceV2({
          ...mockEService,
          descriptors: [
            {
              ...mockEService.descriptors[0],
              state: "Published",
            },
          ],
        }),
        descriptorId,
      } as EServiceDescriptorActivatedV2,
      log_date: new Date(),
    };

    const eventsWithTimestamp = [
      {
        eserviceV2: message,
        timestamp: new Date(),
      },
    ];

    vi.spyOn(safeStorageService, "createFile").mockRejectedValue(
      new Error("Safe Storage API error")
    );

    await expect(
      handleCatalogMessageV2(
        eventsWithTimestamp,
        fileManager,
        signatureService,
        safeStorageService
      )
    ).rejects.toThrow("Failed to process Safe Storage/DynamoDB for file");
  });
});
