import type { FileManager, Logger } from "pagopa-interop-commons";

import { beforeAll, describe, expect, it, vi } from "vitest";

import type { ReadModelServiceSQL } from "../src/services/readModelServiceSQL.js";

import { documentsSignatureCheckerServiceBuilder } from "../src/services/documentsSignatureCheckerService.js";
import { createValidP7m } from "./p7mTestHelper.js";

const UNSIGNED_PDF = Buffer.from("%PDF-1.4 unit test document");
const UNSIGNED_BUCKET = "unsigned-bucket";
const SIGNED_BUCKET = "signed-bucket";
const UNSIGNED_PATH = "agreements/agreement-id/contract.pdf";
const SIGNED_PATH = "agreements/agreement-id/contract.p7m";

/** 09:00 UTC of 2026-04-15: window is the whole of 2026-04-14. */
const REFERENCE_DATE = new Date("2026-04-15T09:00:00.000Z");
const DOCUMENT_DATE = "2026-04-14T10:00:00.000Z";

let validP7m: Buffer;

type LoggerSpy = Logger & {
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

function makeAgreementRecord(
  overrides?: Partial<{
    createdAt: string;
    signedId: string | null;
    signedPath: string | null;
  }>
) {
  return {
    agreementId: "agreement-id",
    unsignedPath: UNSIGNED_PATH,
    createdAt: DOCUMENT_DATE,
    signedId: "signed-id",
    signedPath: SIGNED_PATH,
    ...overrides,
  };
}

function makeReadModelService(
  agreements: ReturnType<typeof makeAgreementRecord>[] = [makeAgreementRecord()]
): ReadModelServiceSQL {
  return {
    getAgreementContracts: vi.fn().mockResolvedValue(agreements),
    getPurposeVersionDocuments: vi.fn().mockResolvedValue([]),
    getDelegationContracts: vi.fn().mockResolvedValue([]),
  } as unknown as ReadModelServiceSQL;
}

function makeFileManager(
  get: (bucket: string, path: string) => Promise<Uint8Array>
): FileManager {
  return { get: vi.fn(get) } as unknown as FileManager;
}

/** File manager serving a matching unsigned PDF and signed P7M pair. */
function makeConformingFileManager(): FileManager {
  return makeFileManager(async (bucket) =>
    bucket === UNSIGNED_BUCKET ? UNSIGNED_PDF : validP7m
  );
}

function makeService({
  readModelService = makeReadModelService(),
  fileManager = makeConformingFileManager(),
  logger = makeLogger(),
  documentsBatchSize = 25,
  signingGracePeriodMinutes = 60,
}: {
  readModelService?: ReadModelServiceSQL;
  fileManager?: FileManager;
  logger?: Logger;
  documentsBatchSize?: number;
  signingGracePeriodMinutes?: number;
} = {}) {
  return documentsSignatureCheckerServiceBuilder({
    readModelService,
    fileManager,
    logger,
    unsignedBucket: UNSIGNED_BUCKET,
    signedBucket: SIGNED_BUCKET,
    documentsLookBackDays: 1,
    documentsBatchSize,
    signingGracePeriodMinutes,
  });
}

describe("documentsSignatureCheckerService", () => {
  beforeAll(async () => {
    validP7m = await createValidP7m(UNSIGNED_PDF);
  });

  it("should query the three entity types on a window ending at midnight UTC of the reference date, regardless of the machine time zone", async () => {
    const readModelService = makeReadModelService([]);

    await makeService({ readModelService }).verify(
      new Date("2026-04-15T23:45:30.125Z")
    );

    const expectedRange = {
      from: new Date("2026-04-14T00:00:00.000Z"),
      to: new Date("2026-04-15T00:00:00.000Z"),
    };
    expect(readModelService.getAgreementContracts).toHaveBeenCalledWith(
      expectedRange
    );
    expect(readModelService.getPurposeVersionDocuments).toHaveBeenCalledWith(
      expectedRange
    );
    expect(readModelService.getDelegationContracts).toHaveBeenCalledWith(
      expectedRange
    );
  });

  it("should count a document whose signed P7M wraps the unsigned PDF as conforming", async () => {
    const report = await makeService().verify(REFERENCE_DATE);

    expect(report).toEqual({
      processedCount: 1,
      conformingCount: 1,
      nonConformingCount: 0,
      pendingCount: 0,
      notCheckedCount: 0,
      issueCount: 0,
      countsByEntityType: {
        agreement: {
          conforming: 1,
          nonConforming: 0,
          pending: 0,
          notChecked: 0,
        },
        purpose: { conforming: 0, nonConforming: 0, pending: 0, notChecked: 0 },
        delegation: {
          conforming: 0,
          nonConforming: 0,
          pending: 0,
          notChecked: 0,
        },
      },
      issues: [],
    });
  });

  it("should report a document as notChecked when S3 fails for a reason other than a missing object", async () => {
    const logger = makeLogger();
    const fileManager = makeFileManager(() => {
      throw new Error(
        "Error getting file path in bucket b: Access Denied: request not authorized"
      );
    });

    const report = await makeService({ fileManager, logger }).verify(
      REFERENCE_DATE
    );

    expect(report.notCheckedCount).toBe(1);
    expect(report.nonConformingCount).toBe(0);
    expect(report.issues.map((issue) => issue.code)).toEqual([
      "UNSIGNED_FILE_DOWNLOAD_ERROR",
      "SIGNED_FILE_DOWNLOAD_ERROR",
    ]);
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining("[UNSIGNED_FILE_DOWNLOAD_ERROR]")
    );
  });

  it("should report a document as non conforming when S3 answers that the object does not exist", async () => {
    const fileManager = makeFileManager(async (bucket) => {
      if (bucket === UNSIGNED_BUCKET) {
        return UNSIGNED_PDF;
      }
      throw new Error(
        `Error getting file ${SIGNED_PATH} in bucket ${SIGNED_BUCKET}: NoSuchKey: The specified key does not exist.`
      );
    });

    const report = await makeService({ fileManager }).verify(REFERENCE_DATE);

    expect(report.nonConformingCount).toBe(1);
    expect(report.notCheckedCount).toBe(0);
    expect(report.issues.map((issue) => issue.code)).toEqual([
      "SIGNED_FILE_MISSING",
    ]);
  });

  it("should report a document still within the signing grace period as pending and log it as a warning", async () => {
    const logger = makeLogger();
    const readModelService = makeReadModelService([
      makeAgreementRecord({
        createdAt: "2026-04-14T23:59:00.000Z",
        signedId: null,
        signedPath: null,
      }),
    ]);

    const report = await makeService({ readModelService, logger }).verify(
      new Date("2026-04-15T00:20:00.000Z")
    );

    expect(report.pendingCount).toBe(1);
    expect(report.nonConformingCount).toBe(0);
    expect(report.issues.map((issue) => issue.code)).toEqual([
      "SIGNING_PENDING",
    ]);
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining("[SIGNING_PENDING]")
    );
    expect(logger.error).not.toHaveBeenCalled();
  });

  it("should report a document with no signed record as non conforming once the grace period has elapsed", async () => {
    const logger = makeLogger();
    const readModelService = makeReadModelService([
      makeAgreementRecord({ signedId: null, signedPath: null }),
    ]);

    const report = await makeService({ readModelService, logger }).verify(
      REFERENCE_DATE
    );

    expect(report.nonConformingCount).toBe(1);
    expect(report.pendingCount).toBe(0);
    expect(report.issues.map((issue) => issue.code)).toEqual([
      "SIGNED_RECORD_MISSING",
    ]);
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining("[SIGNED_RECORD_MISSING]")
    );
  });

  it("should not hide a real anomaly behind the grace period when the document has other issues too", async () => {
    const readModelService = makeReadModelService([
      makeAgreementRecord({
        createdAt: "2026-04-14T23:59:00.000Z",
        signedId: null,
        signedPath: null,
      }),
    ]);
    const fileManager = makeFileManager(async () =>
      Buffer.from("not-a-pdf-at-all")
    );

    const report = await makeService({ readModelService, fileManager }).verify(
      new Date("2026-04-15T00:20:00.000Z")
    );

    expect(report.pendingCount).toBe(0);
    expect(report.nonConformingCount).toBe(1);
    expect(report.issues.map((issue) => issue.code)).toEqual([
      "UNSIGNED_FILE_INVALID",
      "SIGNED_RECORD_MISSING",
    ]);
  });

  it("should never keep more documents in flight than the configured batch size", async () => {
    const readModelService = makeReadModelService(
      Array.from({ length: 7 }, (_, index) => ({
        ...makeAgreementRecord(),
        agreementId: `agreement-${index}`,
      }))
    );

    let inFlight = 0;
    let maxInFlight = 0;
    const fileManager = makeFileManager(async (bucket) => {
      inFlight += 1;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await new Promise((resolve) => setTimeout(resolve, 1));
      inFlight -= 1;
      return bucket === UNSIGNED_BUCKET ? UNSIGNED_PDF : validP7m;
    });

    const report = await makeService({
      readModelService,
      fileManager,
      documentsBatchSize: 2,
    }).verify(REFERENCE_DATE);

    expect(report.processedCount).toBe(7);
    // Two documents per batch, each downloading its unsigned and signed file
    expect(maxInFlight).toBeLessThanOrEqual(4);
  });

  it("should confine an unexpected failure to the document that caused it and report it as notChecked", async () => {
    const logger = makeLogger();
    // Stands in for any unexpected runtime failure while inspecting the bytes
    const unreadableContent = Object.create(Uint8Array.prototype, {
      byteLength: {
        get: () => {
          throw new Error("unreadable content");
        },
      },
    }) as Uint8Array;
    const fileManager = makeFileManager(async (bucket) =>
      bucket === UNSIGNED_BUCKET ? unreadableContent : validP7m
    );

    const report = await makeService({ fileManager, logger }).verify(
      REFERENCE_DATE
    );

    expect(report.notCheckedCount).toBe(1);
    expect(report.issues).toMatchObject([{ code: "UNEXPECTED_CHECK_ERROR" }]);
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining("[UNEXPECTED_CHECK_ERROR]")
    );
  });

  it("should log a summary with the totals and one line per entity type", async () => {
    const logger = makeLogger();

    await makeService({ logger }).verify(REFERENCE_DATE);

    expect(logger.info).toHaveBeenCalledWith(
      expect.stringContaining(
        "Documents signature checker summary processed=1 conforming=1 nonConforming=0 pending=0 notChecked=0 issues=0"
      )
    );
    expect(logger.info).toHaveBeenCalledWith(
      expect.stringContaining(
        "summary by entity type entityType=agreement conforming=1"
      )
    );
  });
});
