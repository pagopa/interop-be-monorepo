/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable functional/no-let */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { genericInternalError } from "pagopa-interop-models";
import { handlePurposeDocument } from "../../src/handlers/handlePurposeDocument.js";
import { calculateSha256Base64 } from "../../src/utils/checksum.js";

vi.mock("../../src/utils/checksum.js", () => ({
  calculateSha256Base64: vi.fn().mockResolvedValue("fake-checksum"),
}));

describe("handlePurposeDocument (integration with testcontainers)", () => {
  const fileContent = new Uint8Array([1, 2, 3]);
  const uploadUrl = "http://fake-upload-url";
  const secret = "fake-secret";
  const key = "safe-storage-key";

  let fileManagerMock: any;
  let safeStorageServiceMock: any;
  let signatureServiceMock: any;
  let loggerMock: any;

  beforeEach(() => {
    fileManagerMock = { get: vi.fn().mockResolvedValue(fileContent) };
    safeStorageServiceMock = {
      createFile: vi.fn().mockResolvedValue({ uploadUrl, secret, key }),
      uploadFileContent: vi.fn().mockResolvedValue(undefined),
    };
    signatureServiceMock = {
      saveDocumentSignatureReference: vi.fn().mockResolvedValue(undefined),
    };
    loggerMock = { info: vi.fn() };
  });

  it("should handle RiskAnalysisDocumentAdded with valid version", async () => {
    const event = {
      type: "RiskAnalysisDocumentAdded",
      data: {
        purpose: {
          id: "purpose-id",
          versions: [
            {
              id: "version-123",
              riskAnalysis: { path: "risk-analysis/file.pdf" },
            },
          ],
        },
        versionId: "version-123",
      },
      event_version: 1,
    } as Parameters<typeof handlePurposeDocument>[0];

    await handlePurposeDocument(
      event,
      signatureServiceMock,
      safeStorageServiceMock,
      fileManagerMock,
      loggerMock
    );

    expect(fileManagerMock.get).toHaveBeenCalledWith(
      expect.any(String),
      "risk-analysis/file.pdf",
      loggerMock
    );
    expect(calculateSha256Base64).toHaveBeenCalledWith(
      Buffer.from(fileContent)
    );
    expect(safeStorageServiceMock.createFile).toHaveBeenCalled();
    expect(safeStorageServiceMock.uploadFileContent).toHaveBeenCalled();
    expect(
      signatureServiceMock.saveDocumentSignatureReference
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        fileKind: "RISK_ANALYSIS_DOCUMENT",
        streamId: "purpose-id",
        subObjectId: "version-123",
      })
    );
  });

  it("should throw if versionId does not match any version", async () => {
    const event = {
      type: "RiskAnalysisDocumentAdded",
      data: {
        purpose: {
          id: "purpose-id",
          versions: [
            {
              id: "other-version",
              riskAnalysis: { path: "risk-analysis/file.pdf" },
            },
          ],
        },
        versionId: "version-123",
      },
      event_version: 1,
    } as Parameters<typeof handlePurposeDocument>[0];

    await expect(
      handlePurposeDocument(
        event,
        signatureServiceMock,
        safeStorageServiceMock,
        fileManagerMock,
        loggerMock
      )
    ).rejects.toEqual(
      genericInternalError(
        "Handle Purpose Document - version not found for id: version-123"
      )
    );

    expect(fileManagerMock.get).not.toHaveBeenCalled();
    expect(safeStorageServiceMock.createFile).not.toHaveBeenCalled();
    expect(
      signatureServiceMock.saveDocumentSignatureReference
    ).not.toHaveBeenCalled();
  });

  it("should log info for irrelevant events", async () => {
    const event = {
      type: "PurposeAdded",
      data: { purpose: { id: "purpose-id" } },
    } as Parameters<typeof handlePurposeDocument>[0];

    await handlePurposeDocument(
      event,
      signatureServiceMock,
      safeStorageServiceMock,
      fileManagerMock,
      loggerMock
    );

    expect(loggerMock.info).toHaveBeenCalledWith(
      "Skipping not relevant event type: PurposeAdded"
    );
    expect(fileManagerMock.get).not.toHaveBeenCalled();
    expect(safeStorageServiceMock.createFile).not.toHaveBeenCalled();
    expect(
      signatureServiceMock.saveDocumentSignatureReference
    ).not.toHaveBeenCalled();
  });

  it("should throw if versionId does not match any version", async () => {
    const event = {
      type: "RiskAnalysisDocumentAdded",
      data: {
        purpose: {
          id: "purpose-id",
          versions: [
            {
              id: "other-version",
              riskAnalysis: { path: "risk-analysis/file.pdf" },
            },
          ],
        },
        versionId: "version-123",
      },
      event_version: 1,
    } as Parameters<typeof handlePurposeDocument>[0];

    await expect(
      handlePurposeDocument(
        event,
        signatureServiceMock,
        safeStorageServiceMock,
        fileManagerMock,
        loggerMock
      )
    ).rejects.toMatchObject({
      code: "genericError",
      detail: "Handle Purpose Document - version not found for id: version-123",
    });

    expect(fileManagerMock.get).not.toHaveBeenCalled();
    expect(safeStorageServiceMock.createFile).not.toHaveBeenCalled();
    expect(
      signatureServiceMock.saveDocumentSignatureReference
    ).not.toHaveBeenCalled();
  });
});
