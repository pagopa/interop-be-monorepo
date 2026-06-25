/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable functional/no-let */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { genericInternalError } from "pagopa-interop-models";
import { handlePurposeTemplateDocument } from "../../src/handlers/handlePurposeTemplateDocument.js";
import { calculateSha256Base64 } from "../../src/utils/checksum.js";
import {
  makePurposeTemplate,
  makePurposeTemplatePublishedEvent,
  makeRiskAnalysisTemplateDocumentGeneratedEvent,
} from "../purposeTemplateTestUtils.js";

vi.mock("../../src/utils/checksum.js", () => ({
  calculateSha256Base64: vi.fn().mockResolvedValue("fake-checksum"),
}));

describe("handlePurposeTemplateDocument", () => {
  const fileContent = new Uint8Array([1, 2, 3]);
  const uploadUrl = "http://fake-upload-url";
  const secret = "fake-secret";
  const key = "safe-storage-key";
  const correlationId = "test-correlation-id";

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
    const purposeTemplate = makePurposeTemplate();
    const event = makeRiskAnalysisTemplateDocumentGeneratedEvent({
      purposeTemplate,
      correlationId,
    });

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
        streamId: purposeTemplate.id,
        subObjectId: "",
        path: "risk-analysis-template/file.pdf",
        fileName: "file.pdf",
        version: 2,
        correlationId,
      }),
      expect.any(Object)
    );
  });

  it("should throw if riskAnalysis path is missing", async () => {
    const purposeTemplate = makePurposeTemplate({ documentPath: "" });
    const event = makeRiskAnalysisTemplateDocumentGeneratedEvent({
      purposeTemplate,
      correlationId,
    });

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
        `Handle Purpose Template Document - riskAnalysis path not found for purpose template id: ${purposeTemplate.id}`
      )
    );

    expect(fileManagerMock.get).not.toHaveBeenCalled();
    expect(safeStorageServiceMock.createFile).not.toHaveBeenCalled();
    expect(
      signatureServiceMock.saveDocumentSignatureReference
    ).not.toHaveBeenCalled();
  });

  it("should not log info for irrelevant events", async () => {
    const event = makePurposeTemplatePublishedEvent({ correlationId });

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
