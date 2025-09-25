/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable functional/no-let */
import "../setup.js";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { handleAgreementDocument } from "../../src/handlers/handleAgreementDocument.js";

describe("handleAgreementDocument (integration with testcontainers)", () => {
  const fileContent = new Uint8Array([1, 2, 3]);
  const uploadUrl = "http://fake-upload-url";
  const secret = "fake-secret";
  const key = "safe-storage-key";

  let fileManagerMock: any;
  let safeStorageServiceMock: any;
  let dbServiceMock: any;
  let loggerMock: any;

  beforeEach(() => {
    fileManagerMock = { get: vi.fn().mockResolvedValue(fileContent) };
    safeStorageServiceMock = {
      createFile: vi.fn().mockResolvedValue({ uploadUrl, secret, key }),
      uploadFileContent: vi.fn().mockResolvedValue(undefined),
    };
    dbServiceMock = {
      saveDocumentReference: vi.fn().mockResolvedValue(undefined),
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
      dbServiceMock,
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
    expect(dbServiceMock.saveDocumentReference).toHaveBeenCalledWith(
      expect.objectContaining({
        safeStorageKey: key,
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
      dbServiceMock,
      safeStorageServiceMock,
      fileManagerMock,
      loggerMock
    );

    expect(loggerMock.info).toHaveBeenCalledWith(
      "No document generation needed for AgreementDeleted message"
    );
    expect(fileManagerMock.get).not.toHaveBeenCalled();
    expect(safeStorageServiceMock.createFile).not.toHaveBeenCalled();
    expect(dbServiceMock.saveDocumentReference).not.toHaveBeenCalled();
  });
});
