/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable functional/no-let */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { genericInternalError } from "pagopa-interop-models";
import { handlePurposeTemplateDocument } from "../../src/handlers/handlePurposeTemplateDocument.js";
import { calculateSha256Base64 } from "../../src/utils/checksum.js";

vi.mock("../../src/utils/checksum.js", () => ({
  calculateSha256Base64: vi.fn().mockResolvedValue("fake-checksum"),
}));

describe("handlePurposeTemplateDocument", () => {
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

  it("should handle RiskAnalysisTemplateDocumentGenerated with valid path", async () => {
    const event = {
      sequence_num: 1,
      stream_id: "template-id",
      version: 1,
      log_date: new Date(),
      correlation_id: "test-correlation-id",
      type: "RiskAnalysisTemplateDocumentGenerated",
      data: {
        purposeTemplate: {
          id: "template-id",
          purposeRiskAnalysisForm: {
            document: { path: "risk-analysis-template/file.pdf" },
          },
          createdAt: BigInt(120323424),
        },
      },
      event_version: 2,
    } as Parameters<typeof handlePurposeTemplateDocument>[0];

    await handlePurposeTemplateDocument(
      event,
      signatureServiceMock,
      safeStorageServiceMock,
      fileManagerMock,
      loggerMock
    );

    expect(fileManagerMock.get).toHaveBeenCalledWith(
      expect.any(String),
      "risk-analysis-template/file.pdf",
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
        fileKind: "RISK_ANALYSIS_TEMPLATE_DOCUMENT",
        streamId: "template-id",
        subObjectId: "",
        path: "risk-analysis-template/file.pdf",
        fileName: "file.pdf",
        version: 2,
        correlationId: "test-correlation-id",
      }),
      expect.any(Object)
    );
  });

  it("should throw if riskAnalysis path is missing", async () => {
    const event = {
      sequence_num: 1,
      stream_id: "template-id",
      version: 1,
      log_date: new Date(),
      correlation_id: "test-correlation-id",
      type: "RiskAnalysisTemplateDocumentGenerated",
      data: {
        purposeTemplate: {
          id: "template-id",
          purposeRiskAnalysisForm: {
            document: { path: undefined },
          },
          createdAt: BigInt(120323424),
        },
      },
      event_version: 2,
    } as unknown as Parameters<typeof handlePurposeTemplateDocument>[0];

    await expect(
      handlePurposeTemplateDocument(
        event,
        signatureServiceMock,
        safeStorageServiceMock,
        fileManagerMock,
        loggerMock
      )
    ).rejects.toEqual(
      genericInternalError(
        "Handle Purpose Template Document - riskAnalysis path not found for purpose template id: template-id"
      )
    );

    expect(fileManagerMock.get).not.toHaveBeenCalled();
    expect(safeStorageServiceMock.createFile).not.toHaveBeenCalled();
    expect(
      signatureServiceMock.saveDocumentSignatureReference
    ).not.toHaveBeenCalled();
  });

  it("should not log info for irrelevant events", async () => {
    const event = {
      type: "PurposeTemplatePublished",
      data: { purposeTemplate: { id: "template-id" } },
    } as Parameters<typeof handlePurposeTemplateDocument>[0];

    await handlePurposeTemplateDocument(
      event,
      signatureServiceMock,
      safeStorageServiceMock,
      fileManagerMock,
      loggerMock
    );

    expect(fileManagerMock.get).not.toHaveBeenCalled();
    expect(safeStorageServiceMock.createFile).not.toHaveBeenCalled();
    expect(
      signatureServiceMock.saveDocumentSignatureReference
    ).not.toHaveBeenCalled();
  });
});
