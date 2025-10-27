/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable functional/no-let */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { handleDelegationDocument } from "../../src/handlers/handleDelegationDocument.js";
import { calculateSha256Base64 } from "../../src/utils/checksum.js";

vi.mock("../../src/utils/checksum.js", () => ({
  calculateSha256Base64: vi.fn().mockResolvedValue("fake-checksum"),
}));

describe("handleDelegationDocument (integration with testcontainers)", () => {
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

  it("should handle ProducerDelegationApproved with activationContract", async () => {
    const event = {
      type: "DelegationContractGenerated",
      data: {
        delegation: {
          id: "delegation-id",
          activationContract: { path: "contracts/delegation.pdf" },
          state: "APPROVED",
          createdAt: new Date(),
          updatedAt: new Date(),
          producerId: "producer-id",
          consumerId: "consumer-id",
          delegatorId: "delegator-id",
          delegateId: "delegate-id",
          eserviceId: "eservice-id",
          kind: "DELEGATION",
        },
      },
      event_version: 2,
    } as undefined as Parameters<typeof handleDelegationDocument>[0];

    await handleDelegationDocument(
      event,
      signatureServiceMock,
      safeStorageServiceMock,
      fileManagerMock,
      loggerMock
    );

    expect(fileManagerMock.get).toHaveBeenCalledWith(
      expect.any(String),
      "contracts/delegation.pdf",
      loggerMock
    );
    expect(calculateSha256Base64).toHaveBeenCalledWith(
      Buffer.from(fileContent)
    );
    expect(safeStorageServiceMock.createFile).toHaveBeenCalledWith(
      expect.objectContaining({
        contentType: "application/gzip",
        checksumValue: "fake-checksum",
      })
    );
    expect(safeStorageServiceMock.uploadFileContent).toHaveBeenCalledWith(
      uploadUrl,
      Buffer.from(fileContent),
      "application/pdf",
      secret,
      "fake-checksum"
    );
    expect(
      signatureServiceMock.saveDocumentSignatureReference
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        safeStorageId: key,
        fileKind: "DELEGATION_CONTRACT",
        streamId: "delegation-id",
        fileName: "delegation.pdf",
        version: 2,
      })
    );
  });

  it("should not log info for irrelevant events", async () => {
    const event = {
      type: "DelegationContractGenerated",
      data: { delegation: { id: "delegation-id" } },
    } as Parameters<typeof handleDelegationDocument>[0];

    await handleDelegationDocument(
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

  it("should do nothing when activationContract is missing", async () => {
    const event = {
      type: "ProducerDelegationApproved",
      data: {
        delegation: {
          id: "delegation-id",
        },
      },
      event_version: 2,
    } as Parameters<typeof handleDelegationDocument>[0];

    await handleDelegationDocument(
      event,
      signatureServiceMock,
      safeStorageServiceMock,
      fileManagerMock,
      loggerMock
    );

    expect(fileManagerMock.get).not.toHaveBeenCalled();
    expect(safeStorageServiceMock.createFile).not.toHaveBeenCalled();
    expect(safeStorageServiceMock.uploadFileContent).not.toHaveBeenCalled();
    expect(
      signatureServiceMock.saveDocumentSignatureReference
    ).not.toHaveBeenCalled();
  });
});
