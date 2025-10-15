/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable functional/no-let */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { handleAgreementDocument } from "../../src/handlers/handleAgreementDocument.js";

describe("handleAgreementDocument (integration with testcontainers)", () => {
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

  it("should handle AgreementContractAdded with contract", async () => {
    const event = {
      type: "AgreementContractAdded",
      data: {
        agreement: { id: "agreement-id", contract: { path: "contract.pdf" } },
      },
      event_version: 1,
      version: 1,
      stream_id: "stream-1",
    } as Parameters<typeof handleAgreementDocument>[0];

    await handleAgreementDocument(
      event,
      signatureServiceMock,
      safeStorageServiceMock,
      fileManagerMock,
      loggerMock
    );

    expect(fileManagerMock.get).toHaveBeenCalledWith(
      expect.any(String),
      "contract.pdf",
      loggerMock
    );
    expect(safeStorageServiceMock.createFile).toHaveBeenCalled();
    expect(safeStorageServiceMock.uploadFileContent).toHaveBeenCalled();
    expect(
      signatureServiceMock.saveDocumentSignatureReference
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        safeStorageId: key,
        fileKind: "AGREEMENT_CONTRACT",
        streamId: "agreement-id",
        fileName: "contract.pdf",
        version: 1,
      })
    );
  });

  it("should log info for other message types", async () => {
    const event = { type: "AgreementDeleted" } as Parameters<
      typeof handleAgreementDocument
    >[0];

    await handleAgreementDocument(
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
