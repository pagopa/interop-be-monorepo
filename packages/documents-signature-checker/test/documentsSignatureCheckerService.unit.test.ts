import type { FileManager, Logger } from "pagopa-interop-commons";
import type { DrizzleReturnType } from "pagopa-interop-readmodel-models";
import { beforeEach, describe, expect, it, vi } from "vitest";

const getAgreementsContracts = vi.fn();
const getPurposeDocuments = vi.fn();
const getDelegationContracts = vi.fn();

const assertUnsignedPathPresent = vi.fn();
const assertUnsignedFileExists = vi.fn();
const assertUnsignedFileValid = vi.fn();
const assertSignedMetadataPresent = vi.fn();
const assertSignedPathPresent = vi.fn();
const assertSignedFileExists = vi.fn();
const assertSignedFileValidCms = vi.fn();
const assertSignedFileNotEmptyPayload = vi.fn();
const assertSignedContentMatchesUnsigned = vi.fn();

vi.mock("../src/services/readModelServiceSQL.js", () => ({
  readModelServiceBuilderSQL: vi.fn(() => ({
    getAgreementsContracts,
    getPurposeDocuments,
    getDelegationContracts,
  })),
}));

vi.mock("../src/services/validators.js", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../src/services/validators.js")>();
  return {
    ...actual,
    assertUnsignedPathPresent,
    assertUnsignedFileExists,
    assertUnsignedFileValid,
    assertSignedMetadataPresent,
    assertSignedPathPresent,
    assertSignedFileExists,
    assertSignedFileValidCms,
    assertSignedFileNotEmptyPayload,
    assertSignedContentMatchesUnsigned,
  };
});

const { documentsSignatureCheckerServiceBuilder } =
  await import("../src/services/documentsSignatureCheckerService.js");

type LoggerSpy = Logger & {
  debug: ReturnType<typeof vi.fn>;
  info: ReturnType<typeof vi.fn>;
  warn: ReturnType<typeof vi.fn>;
  error: ReturnType<typeof vi.fn>;
};

function makeLogger(): LoggerSpy {
  return {
    isDebugEnabled: vi.fn().mockReturnValue(false),
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  } as unknown as LoggerSpy;
}

function makeFileManager(): FileManager {
  return {
    get: vi.fn().mockResolvedValue(Buffer.from("document-content")),
  } as unknown as FileManager;
}

function resetAssertionMocks(): void {
  [
    assertUnsignedPathPresent,
    assertUnsignedFileExists,
    assertUnsignedFileValid,
    assertSignedMetadataPresent,
    assertSignedPathPresent,
    assertSignedFileExists,
    assertSignedFileValidCms,
    assertSignedFileNotEmptyPayload,
    assertSignedContentMatchesUnsigned,
  ].forEach((assertionMock) => {
    assertionMock.mockResolvedValue(undefined);
  });
}

describe("documentsSignatureCheckerServiceBuilder", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetAssertionMocks();

    getAgreementsContracts.mockResolvedValue([
      {
        unsigned: {
          agreementId: "agreement-id",
          path: "agreements/agreement-id/contract.pdf",
        },
        signed: {
          path: "agreements/agreement-id/contract.p7m",
        },
      },
    ]);
    getPurposeDocuments.mockResolvedValue([]);
    getDelegationContracts.mockResolvedValue([]);
  });

  it("should query all three entity tables with a range from midnight N days before the reference date to midnight on the reference date", async () => {
    const referenceDate = new Date(2026, 5, 10, 18, 45, 30, 125);
    const expectedTo = new Date(referenceDate);
    expectedTo.setHours(0, 0, 0, 0);
    const expectedFrom = new Date(expectedTo);
    expectedFrom.setDate(expectedFrom.getDate() - 365);

    const service = documentsSignatureCheckerServiceBuilder(
      {} as DrizzleReturnType,
      makeFileManager(),
      makeLogger(),
      365,
      "unsigned-bucket",
      "signed-bucket",
      25
    );

    const report = await service.verify(referenceDate);

    expect(getAgreementsContracts).toHaveBeenCalledWith(
      expectedFrom,
      expectedTo
    );
    expect(getPurposeDocuments).toHaveBeenCalledWith(expectedFrom, expectedTo);
    expect(getDelegationContracts).toHaveBeenCalledWith(
      expectedFrom,
      expectedTo
    );
    expect(report).toMatchObject({
      processedCount: 1,
      successCount: 1,
      issueCount: 0,
      countsByEntityType: {
        agreement: { conforming: 1, nonConforming: 0 },
        purpose: { conforming: 0, nonConforming: 0 },
        delegation: { conforming: 0, nonConforming: 0 },
      },
    });
  });

  it("should wrap an unexpected assertion throw in UNEXPECTED_CHECK_ERROR and log it at ERROR level", async () => {
    const logger = makeLogger();
    const error = new Error("boom");
    assertSignedFileValidCms.mockRejectedValue(error);

    const service = documentsSignatureCheckerServiceBuilder(
      {} as DrizzleReturnType,
      makeFileManager(),
      logger,
      1,
      "unsigned-bucket",
      "signed-bucket",
      25
    );

    const report = await service.verify(new Date(2026, 5, 10, 9, 0, 0, 0));

    expect(report).toMatchObject({
      processedCount: 1,
      successCount: 0,
      issueCount: 1,
      countsByEntityType: {
        agreement: { conforming: 0, nonConforming: 1 },
        purpose: { conforming: 0, nonConforming: 0 },
        delegation: { conforming: 0, nonConforming: 0 },
      },
      issues: [
        {
          code: "UNEXPECTED_CHECK_ERROR",
          entityType: "agreement",
          entityId: "agreement-id",
          unsignedPath: "agreements/agreement-id/contract.pdf",
          signedPath: "agreements/agreement-id/contract.p7m",
          details: {
            error: "boom",
          },
        },
      ],
    });
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining("[UNEXPECTED_CHECK_ERROR]")
    );
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining("entityId=agreement-id")
    );
  });
});
