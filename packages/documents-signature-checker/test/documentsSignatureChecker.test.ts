/* eslint-disable functional/no-let */
import { beforeAll, describe, expect, it, vi } from "vitest";
import {
  generateId,
  AgreementDocument,
  AgreementDocumentId,
  AgreementSignedContract,
  agreementState,
  DelegationContractDocument,
  DelegationContractId,
  DelegationId,
  DelegationSignedContractDocument,
  delegationKind,
  delegationState,
  PurposeVersion,
  PurposeVersionDocument,
  PurposeVersionDocumentId,
  PurposeVersionId,
  PurposeVersionSignedDocument,
  purposeVersionState,
} from "pagopa-interop-models";
import type { Logger } from "pagopa-interop-commons";
import {
  getMockAgreement,
  getMockDelegation,
  getMockPurpose,
  getMockPurposeVersion,
  getMockPurposeVersionDocument,
  getMockPurposeVersionSignedDocument,
} from "pagopa-interop-commons-test";
import {
  readModelDB,
  seedAgreement,
  seedDelegation,
  seedPurposeForDocumentCheck,
  uploadToS3,
  fileManager,
} from "./utils.js";
import {
  createCorruptedP7m,
  createP7mWithEmptyContent,
  createValidP7m,
} from "./p7mTestHelper.js";
import { config } from "../src/config/config.js";
import { documentsSignatureCheckerServiceBuilder } from "../src/services/documentsSignatureCheckerService.js";

const UNSIGNED_PDF = Buffer.from(
  "%PDF-1.4 test unsigned document for signature verification"
);
const DIFFERENT_UNSIGNED_PDF = Buffer.from(
  "%PDF-1.4 test unsigned document with different content"
);
const REFERENCE_DATE = new Date(2026, 3, 15, 18, 30, 0, 0);

let validP7m: Buffer;
let emptyContentP7m: Buffer;
let mismatchedP7m: Buffer;

type LoggerSpy = Logger & {
  debug: ReturnType<typeof vi.fn>;
  info: ReturnType<typeof vi.fn>;
  warn: ReturnType<typeof vi.fn>;
  error: ReturnType<typeof vi.fn>;
};

function dateAtDayOffset(daysToSubtract: number, hour: number): Date {
  const date = new Date(REFERENCE_DATE);
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() - daysToSubtract);
  date.setHours(hour, 0, 0, 0);
  return date;
}

interface ScenarioOptions {
  documentDate: Date;
  includeSignedRecord?: boolean;
  uploadUnsigned?: boolean;
  uploadSigned?: boolean;
  unsignedS3Content?: Buffer;
  signedS3Content?: Buffer;
}

interface ScenarioResult {
  entityId: string;
  unsignedPath: string;
  signedPath?: string;
}

function makeLogger(): LoggerSpy {
  return {
    isDebugEnabled: vi.fn().mockReturnValue(false),
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  } as unknown as LoggerSpy;
}

function makeService(logger: Logger, documentsLookBackDays = 1) {
  return documentsSignatureCheckerServiceBuilder(
    readModelDB,
    fileManager,
    logger,
    documentsLookBackDays,
    config.s3Bucket,
    config.s3BucketSigned
  );
}

async function setupAgreementScenario(
  opts: ScenarioOptions
): Promise<ScenarioResult> {
  const base = getMockAgreement(undefined, undefined, agreementState.active);
  const unsignedDocId = generateId<AgreementDocumentId>();
  const unsignedPath = `agreements/${base.id}/${unsignedDocId}/contract.pdf`;

  const contract: AgreementDocument = {
    id: unsignedDocId,
    name: "contract.pdf",
    prettyName: "Contract",
    contentType: "application/pdf",
    path: unsignedPath,
    createdAt: opts.documentDate,
  };

  let signedContract: AgreementSignedContract | undefined;
  let signedPath: string | undefined;

  if (opts.includeSignedRecord !== false) {
    const signedDocId = generateId<AgreementDocumentId>();
    signedPath = `agreements/${base.id}/${signedDocId}/signed.p7m`;
    signedContract = {
      id: signedDocId,
      name: "signed.p7m",
      prettyName: "Signed contract",
      contentType: "application/pkcs7-mime",
      path: signedPath,
      createdAt: opts.documentDate,
      signedAt: opts.documentDate,
    };
  }

  await seedAgreement({ ...base, contract, signedContract });
  if (opts.uploadUnsigned !== false) {
    await uploadToS3(
      config.s3Bucket,
      unsignedPath,
      opts.unsignedS3Content ?? UNSIGNED_PDF
    );
  }

  if (signedPath && opts.uploadSigned !== false && opts.signedS3Content) {
    await uploadToS3(config.s3BucketSigned, signedPath, opts.signedS3Content);
  }

  return { entityId: base.id, unsignedPath, signedPath };
}

async function setupPurposeScenario(
  opts: ScenarioOptions
): Promise<ScenarioResult> {
  const basePurpose = getMockPurpose();
  const purposeVersionId = generateId<PurposeVersionId>();
  const unsignedDocId = generateId<PurposeVersionDocumentId>();
  const unsignedPath = `purposes/${basePurpose.id}/${purposeVersionId}/${unsignedDocId}/riskAnalysis.pdf`;

  const riskAnalysis: PurposeVersionDocument = {
    ...getMockPurposeVersionDocument(),
    id: unsignedDocId,
    contentType: "application/pdf",
    path: unsignedPath,
    createdAt: opts.documentDate,
  };

  let signedContract: PurposeVersionSignedDocument | undefined;
  let signedPath: string | undefined;

  if (opts.includeSignedRecord !== false) {
    const signedDocId = generateId<PurposeVersionDocumentId>();
    signedPath = `purposes/${basePurpose.id}/${purposeVersionId}/${signedDocId}/signed.p7m`;
    signedContract = {
      ...getMockPurposeVersionSignedDocument(),
      id: signedDocId,
      contentType: "application/pkcs7-mime",
      path: signedPath,
      createdAt: opts.documentDate,
      signedAt: opts.documentDate,
    };
  }

  const purposeVersion: PurposeVersion = {
    ...getMockPurposeVersion(purposeVersionState.active),
    id: purposeVersionId,
    riskAnalysis,
    createdAt: opts.documentDate,
    updatedAt: opts.documentDate,
    firstActivationAt: opts.documentDate,
    signedContract,
  };

  await seedPurposeForDocumentCheck({
    ...basePurpose,
    createdAt: opts.documentDate,
    versions: [purposeVersion],
  });

  if (opts.uploadUnsigned !== false) {
    await uploadToS3(
      config.s3Bucket,
      unsignedPath,
      opts.unsignedS3Content ?? UNSIGNED_PDF
    );
  }

  if (signedPath && opts.uploadSigned !== false && opts.signedS3Content) {
    await uploadToS3(config.s3BucketSigned, signedPath, opts.signedS3Content);
  }

  return { entityId: basePurpose.id, unsignedPath, signedPath };
}

async function setupDelegationScenario(
  opts: ScenarioOptions
): Promise<ScenarioResult> {
  const delegationId = generateId<DelegationId>();
  const unsignedDocId = generateId<DelegationContractId>();
  const unsignedPath = `delegations/${delegationId}/${unsignedDocId}/contract.pdf`;

  const activationContract: DelegationContractDocument = {
    id: unsignedDocId,
    name: "contract.pdf",
    prettyName: "Contract",
    contentType: "application/pdf",
    path: unsignedPath,
    createdAt: opts.documentDate,
  };

  let activationSignedContract: DelegationSignedContractDocument | undefined;
  let signedPath: string | undefined;

  if (opts.includeSignedRecord !== false) {
    const signedDocId = generateId<DelegationContractId>();
    signedPath = `delegations/${delegationId}/${signedDocId}/signed.p7m`;
    activationSignedContract = {
      id: signedDocId,
      name: "signed.p7m",
      prettyName: "Signed contract",
      contentType: "application/pkcs7-mime",
      path: signedPath,
      createdAt: opts.documentDate,
      signedAt: opts.documentDate,
    };
  }

  const delegation = getMockDelegation({
    kind: delegationKind.delegatedConsumer,
    id: delegationId,
    state: delegationState.active,
    activationContract,
    activationSignedContract,
  });

  await seedDelegation(delegation);
  if (opts.uploadUnsigned !== false) {
    await uploadToS3(
      config.s3Bucket,
      unsignedPath,
      opts.unsignedS3Content ?? UNSIGNED_PDF
    );
  }

  if (signedPath && opts.uploadSigned !== false && opts.signedS3Content) {
    await uploadToS3(config.s3BucketSigned, signedPath, opts.signedS3Content);
  }

  return { entityId: delegationId, unsignedPath, signedPath };
}

describe("documents-signature-checker", () => {
  beforeAll(async () => {
    validP7m = await createValidP7m(UNSIGNED_PDF);
    emptyContentP7m = await createP7mWithEmptyContent();
    mismatchedP7m = await createValidP7m(DIFFERENT_UNSIGNED_PDF);
  });

  it("should mark all three entity types as conforming when all documents created the previous day have a valid signed P7M", async () => {
    const logger = makeLogger();
    await Promise.all([
      setupAgreementScenario({
        documentDate: dateAtDayOffset(1, 10),
        signedS3Content: validP7m,
      }),
      setupPurposeScenario({
        documentDate: dateAtDayOffset(1, 11),
        signedS3Content: validP7m,
      }),
      setupDelegationScenario({
        documentDate: dateAtDayOffset(1, 12),
        signedS3Content: validP7m,
      }),
    ]);

    const report = await makeService(logger).verify(REFERENCE_DATE);

    expect(report).toEqual({
      processedCount: 3,
      successCount: 3,
      issueCount: 0,
      countsByEntityType: {
        agreement: { conforming: 1, nonConforming: 0 },
        purpose: { conforming: 1, nonConforming: 0 },
        delegation: { conforming: 1, nonConforming: 0 },
      },
      issues: [],
    });
    expect(logger.info).toHaveBeenCalledWith(
      expect.stringContaining(
        "Documents signature checker summary processed=3 successful=3 issues=0"
      )
    );
    expect(logger.info).toHaveBeenCalledWith(
      expect.stringContaining("agreementConforming=1")
    );
    expect(logger.info).toHaveBeenCalledWith(
      expect.stringContaining("purposeConforming=1")
    );
    expect(logger.info).toHaveBeenCalledWith(
      expect.stringContaining("delegationConforming=1")
    );
  });

  it("should only include documents from the previous full day, excluding documents created today or 2+ days ago", async () => {
    await Promise.all([
      setupAgreementScenario({
        documentDate: dateAtDayOffset(1, 9),
        signedS3Content: validP7m,
      }),
      setupPurposeScenario({
        documentDate: dateAtDayOffset(2, 12),
      }),
      setupDelegationScenario({
        documentDate: dateAtDayOffset(0, 12),
      }),
    ]);

    const report = await makeService(makeLogger()).verify(REFERENCE_DATE);

    expect(report.processedCount).toBe(1);
    expect(report.successCount).toBe(1);
    expect(report.issueCount).toBe(0);
  });

  it("should emit SIGNED_FILE_MISSING and log ERROR when the signed P7M file is not found on S3", async () => {
    const logger = makeLogger();
    const scenario = await setupAgreementScenario({
      documentDate: dateAtDayOffset(1, 14),
      uploadSigned: false,
    });

    const report = await makeService(logger).verify(REFERENCE_DATE);

    expect(report).toMatchObject({
      processedCount: 1,
      successCount: 0,
      issueCount: 1,
      issues: [
        {
          code: "SIGNED_FILE_MISSING",
          entityType: "agreement",
          entityId: scenario.entityId,
        },
      ],
    });
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining("Unable to download signed document from S3")
    );
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining("code=SIGNED_FILE_MISSING")
    );
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining(`entityId=${scenario.entityId}`)
    );
  });

  it("should emit SIGNED_CONTENT_MISMATCH and log ERROR when the P7M decodes to content that differs from the unsigned PDF", async () => {
    const logger = makeLogger();
    const scenario = await setupAgreementScenario({
      documentDate: dateAtDayOffset(1, 15),
      signedS3Content: mismatchedP7m,
    });

    const report = await makeService(logger).verify(REFERENCE_DATE);

    expect(report).toMatchObject({
      processedCount: 1,
      successCount: 0,
      issueCount: 1,
      issues: [
        {
          code: "SIGNED_CONTENT_MISMATCH",
          entityType: "agreement",
          entityId: scenario.entityId,
        },
      ],
    });
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining("code=SIGNED_CONTENT_MISMATCH")
    );
  });

  it("should emit SIGNED_FILE_INVALID_CMS when the signed file bytes are not parseable as a valid CMS/P7M structure", async () => {
    const scenario = await setupAgreementScenario({
      documentDate: dateAtDayOffset(1, 16),
      signedS3Content: createCorruptedP7m(),
    });

    const report = await makeService(makeLogger()).verify(REFERENCE_DATE);

    expect(report).toMatchObject({
      processedCount: 1,
      successCount: 0,
      issueCount: 1,
      issues: [
        {
          code: "SIGNED_FILE_INVALID_CMS",
          entityType: "agreement",
          entityId: scenario.entityId,
        },
      ],
    });
  });

  it("should emit SIGNED_FILE_EMPTY_PAYLOAD when the P7M is a valid CMS envelope but contains zero payload bytes", async () => {
    const scenario = await setupAgreementScenario({
      documentDate: dateAtDayOffset(1, 17),
      signedS3Content: emptyContentP7m,
    });

    const report = await makeService(makeLogger()).verify(REFERENCE_DATE);

    expect(report).toMatchObject({
      processedCount: 1,
      successCount: 0,
      issueCount: 1,
      issues: [
        {
          code: "SIGNED_FILE_EMPTY_PAYLOAD",
          entityType: "agreement",
          entityId: scenario.entityId,
        },
      ],
    });
  });

  it("should return a report with all counts at zero when no documents were created in the checked time window", async () => {
    const logger = makeLogger();
    const report = await makeService(logger).verify(REFERENCE_DATE);

    expect(report).toEqual({
      processedCount: 0,
      successCount: 0,
      issueCount: 0,
      countsByEntityType: {
        agreement: { conforming: 0, nonConforming: 0 },
        purpose: { conforming: 0, nonConforming: 0 },
        delegation: { conforming: 0, nonConforming: 0 },
      },
      issues: [],
    });
    expect(logger.info).toHaveBeenCalledWith(
      expect.stringContaining("processed=0 successful=0 issues=0")
    );
  });

  it("should emit SIGNED_METADATA_MISSING and log ERROR when the agreement has no signed contract record in the readmodel", async () => {
    const logger = makeLogger();
    const scenario = await setupAgreementScenario({
      documentDate: dateAtDayOffset(1, 13),
      includeSignedRecord: false,
    });

    const report = await makeService(logger).verify(REFERENCE_DATE);

    expect(report).toMatchObject({
      processedCount: 1,
      successCount: 0,
      issueCount: 1,
      issues: [
        {
          code: "SIGNED_METADATA_MISSING",
          entityType: "agreement",
          entityId: scenario.entityId,
        },
      ],
    });
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining("code=SIGNED_METADATA_MISSING")
    );
  });

  it("should increment nonConforming count only for the entity type that failed, leaving other types unaffected", async () => {
    const logger = makeLogger();
    await Promise.all([
      // Conforming agreement
      setupAgreementScenario({
        documentDate: dateAtDayOffset(1, 10),
        signedS3Content: validP7m,
      }),
      // Non-conforming purpose (signed file not uploaded to S3)
      setupPurposeScenario({
        documentDate: dateAtDayOffset(1, 11),
        uploadSigned: false,
      }),
      // Conforming delegation
      setupDelegationScenario({
        documentDate: dateAtDayOffset(1, 12),
        signedS3Content: validP7m,
      }),
    ]);

    const report = await makeService(logger).verify(REFERENCE_DATE);

    expect(report.processedCount).toBe(3);
    expect(report.successCount).toBe(2);
    expect(report.countsByEntityType).toEqual({
      agreement: { conforming: 1, nonConforming: 0 },
      purpose: { conforming: 0, nonConforming: 1 },
      delegation: { conforming: 1, nonConforming: 0 },
    });
    expect(logger.info).toHaveBeenCalledWith(
      expect.stringContaining("purposeNonConforming=1")
    );
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining("SIGNED_FILE_MISSING")
    );
  });

  it("should include documents up to DOCUMENTS_DAYS_AGE_TO_CHECK days back and exclude documents older than that threshold", async () => {
    await Promise.all([
      // 1 day ago — within default window
      setupAgreementScenario({
        documentDate: dateAtDayOffset(1, 10),
        signedS3Content: validP7m,
      }),
      // 3 days ago — within the expanded 5-day window
      setupPurposeScenario({
        documentDate: dateAtDayOffset(3, 14),
        signedS3Content: validP7m,
      }),
      // 6 days ago — outside the 5-day window
      setupDelegationScenario({
        documentDate: dateAtDayOffset(6, 8),
        signedS3Content: validP7m,
      }),
    ]);

    const report = await makeService(makeLogger(), 5).verify(REFERENCE_DATE);

    expect(report.processedCount).toBe(2);
    expect(report.successCount).toBe(2);
  });
});
