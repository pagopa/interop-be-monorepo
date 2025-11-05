import { describe, it, expect, vi, Mock, beforeEach } from "vitest";
import {
  FileManager,
  RefreshableInteropToken,
  SafeStorageService,
} from "pagopa-interop-commons";
import { Message } from "@aws-sdk/client-sqs";
import { SignatureServiceBuilder } from "pagopa-interop-commons";
import { S3ServiceException } from "@aws-sdk/client-s3";
import { sqsMessageHandler } from "../src/handlers/sqsMessageHandler.js";

const mockFileManager: Partial<FileManager> = {
  resumeOrStoreBytes: vi.fn(),
};

const testToken = "mockToken";
const mockRefreshableToken: RefreshableInteropToken = {
  get: () => Promise.resolve({ serialized: testToken }),
} as unknown as RefreshableInteropToken;

const mockDbService: SignatureServiceBuilder = {
  saveSignatureReference: vi.fn(),
  readSignatureReference: vi.fn(),
  saveDocumentSignatureReference: vi.fn(),
  deleteSignatureReference: vi.fn(),
  readDocumentSignatureReference: vi.fn(),
};

const mockSafeStorageService: SafeStorageService = {
  createFile: vi.fn(),
  uploadFileContent: vi.fn(),
  getFile: vi.fn(),
  downloadFileContent: vi.fn(),
};

describe("sqsMessageHandler - S3 409 Conflict", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should handle S3 409 Conflict gracefully for RISK_ANALYSIS_DOCUMENT", async () => {
    const sqsMessageBody = {
      version: "0",
      id: "6e902b1c-7f55-4074-a036-749e75551f33",
      "detail-type": "Object Created",
      source: "aws.s3",
      account: "123456789012",
      time: "2025-01-01T10:00:00Z",
      region: "eu-central-1",
      resources: ["arn:aws:s3:::some-bucket"],
      detail: {
        key: "conflict-file.pdf",
        versionId: "12345",
        documentType: "RISK_ANALYSIS_DOCUMENT",
        documentStatus: "SAVED",
        contentType: "application/pdf",
        checksum: "mock-checksum",
        retentionUntil: "2026-01-01T10:00:00Z",
        tags: null,
        client_short_code: "12345",
      },
    };

    const sqsMessagePayload: Message = {
      Body: JSON.stringify(sqsMessageBody),
    };

    const mockFileReference = { download: { url: "http://mock-url.com/file" } };
    const mockFileContent = Buffer.from("test content");

    (mockSafeStorageService.getFile as Mock).mockResolvedValue(
      mockFileReference
    );
    (mockSafeStorageService.downloadFileContent as Mock).mockResolvedValue(
      mockFileContent
    );

    // Simula S3 409 Conflict
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const conflictError = new S3ServiceException({} as any);
    // eslint-disable-next-line functional/immutable-data
    conflictError.$metadata = { httpStatusCode: 409 };
    // eslint-disable-next-line functional/immutable-data
    conflictError.name = "Conflict";
    (mockFileManager.resumeOrStoreBytes as Mock).mockRejectedValueOnce(
      conflictError
    );

    // Mock of signature read
    (
      mockDbService.readDocumentSignatureReference as Mock
    ).mockResolvedValueOnce({
      id: sqsMessageBody.id,
      key: sqsMessageBody.detail.key,
      fileKind: sqsMessageBody.detail.documentType,
      createdAt: BigInt(123456),
      contentType: "application/pdf",
      subObjectId: "sub-object-id",
      streamId: "stream-id",
      correlationId: "corr-id",
      fileName: "conflict-file.pdf",
    });

    (mockDbService.deleteSignatureReference as Mock).mockResolvedValueOnce(
      void 0
    );

    // Mock metadata function
    vi.mock("../src/utils/metadata/riskAnalysis.js", () => ({
      addPurposeRiskAnalysisSignedDocument: vi
        .fn()
        .mockResolvedValue(undefined),
    }));

    await sqsMessageHandler(
      sqsMessagePayload,
      mockFileManager as FileManager,
      mockDbService,
      mockSafeStorageService,
      mockRefreshableToken
    );

    // Check that resumeOrStoreBytes has been called
    expect(mockFileManager.resumeOrStoreBytes).toHaveBeenCalled();

    // Verify that the signature was deleted despite the 409
    expect(mockDbService.deleteSignatureReference).toHaveBeenCalledWith(
      sqsMessageBody.id
    );
  });
});
