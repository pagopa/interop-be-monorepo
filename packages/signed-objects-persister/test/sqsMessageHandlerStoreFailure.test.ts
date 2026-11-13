import { Message } from "@aws-sdk/client-sqs";
import {
  FileManager,
  FileManagerError,
  fileManagerStoreBytesError,
  RefreshableInteropToken,
  SafeStorageService,
} from "pagopa-interop-commons";
import { SignatureServiceBuilder } from "pagopa-interop-commons";
import { InternalError } from "pagopa-interop-models";
import { describe, it, expect, vi, Mock, beforeEach } from "vitest";

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
  readSignatureReferenceById: vi.fn(),
};

const mockSafeStorageService: SafeStorageService = {
  createFile: vi.fn(),
  uploadFileContent: vi.fn(),
  getFile: vi.fn(),
  downloadFileContent: vi.fn(),
};

describe("sqsMessageHandler - S3 store failure", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should retry the message when the file manager fails to store the signed file", async () => {
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
        key: "document.pdf",
        versionId: "12345",
        documentType: "INTEROP_LEGAL_FACTS",
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

    // The file manager wraps every S3 failure into a FileManagerError.
    (mockFileManager.resumeOrStoreBytes as Mock).mockRejectedValueOnce(
      fileManagerStoreBytesError(
        "path/to/document_signed.pdf",
        "signed-documents-bucket",
        new Error("AccessDenied")
      )
    );

    (mockDbService.readSignatureReferenceById as Mock).mockResolvedValueOnce({
      id: sqsMessageBody.id,
      key: sqsMessageBody.detail.key,
      fileKind: "RISK_ANALYSIS_DOCUMENT",
      createdAt: BigInt(123456),
      contentType: "application/pdf",
      subObjectId: "sub-object-id",
      streamId: "stream-id",
      correlationId: "corr-id",
      fileName: "document.pdf",
      path: "path/to",
    });

    const error = await sqsMessageHandler(
      sqsMessagePayload,
      mockFileManager as FileManager,
      mockDbService,
      mockSafeStorageService,
      mockRefreshableToken
    ).catch((e) => e);

    expect(error).toBeInstanceOf(FileManagerError);
    // A FileManagerError is an InternalError, so the SQS runner keeps the
    // message and retries it instead of stopping the consumer.
    expect(error).toBeInstanceOf(InternalError);

    // The signature reference stays in place, so a later delivery can complete
    // the flow.
    expect(mockDbService.deleteSignatureReference).not.toHaveBeenCalled();
  });
});
