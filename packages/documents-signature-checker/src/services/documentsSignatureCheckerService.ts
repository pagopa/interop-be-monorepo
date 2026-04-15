import type { FileManager, Logger } from "pagopa-interop-commons";
import type { DrizzleReturnType } from "pagopa-interop-readmodel-models";
import type {
  DocumentCheckIssue,
  DocumentEntityType,
  EntityTypeReport,
  JobReport,
} from "../models/report.js";
import { readModelServiceBuilderSQL } from "./readModelServiceSQL.js";
import {
  assertSignedContentMatchesUnsigned,
  assertSignedFileExists,
  assertSignedFileNotEmptyPayload,
  assertSignedFileValidCms,
  assertSignedMetadataPresent,
  assertSignedPathPresent,
  assertUnsignedFileExists,
  assertUnsignedFileValid,
  assertUnsignedPathPresent,
  makeIssue,
  type DocumentToCheck,
} from "./validators.js";

type TimeRange = {
  from: Date;
  to: Date;
};

type DocumentInput = {
  entityType: DocumentEntityType;
  entityId: string;
  unsignedPath: string | null | undefined;
  signedRecord: { path?: string | null } | null;
  extraFields?: Record<string, string | number | undefined>;
};

type DocumentAssertion = (
  document: DocumentToCheck
) => Promise<DocumentCheckIssue | undefined> | DocumentCheckIssue | undefined;

const documentAssertions: readonly DocumentAssertion[] = [
  assertUnsignedPathPresent,
  assertUnsignedFileExists,
  assertUnsignedFileValid,
  assertSignedMetadataPresent,
  assertSignedPathPresent,
  assertSignedFileExists,
  assertSignedFileValidCms,
  assertSignedFileNotEmptyPayload,
  assertSignedContentMatchesUnsigned,
];

function serializeLogFields(
  fields: Record<string, string | number | boolean | null | undefined>
): string {
  return Object.entries(fields)
    .filter(([, value]) => value != null)
    .map(([key, value]) => `${key}=${String(value)}`)
    .join(" ");
}

function getTimeRange(
  documentsLookBackDays: number,
  referenceDate: Date
): TimeRange {
  const to = new Date(referenceDate);
  to.setHours(0, 0, 0, 0);

  const from = new Date(to);
  from.setDate(from.getDate() - documentsLookBackDays);

  return { from, to };
}

async function collectIssues(
  document: DocumentToCheck
): Promise<DocumentCheckIssue[]> {
  const results = await Promise.all(
    documentAssertions.map((assertion) => assertion(document))
  );

  return results.filter(
    (result): result is DocumentCheckIssue => result !== undefined
  );
}

async function downloadDocument(
  fileManager: FileManager,
  logger: Logger,
  bucket: string,
  path: string | null | undefined
): Promise<Uint8Array | undefined> {
  if (!path || path.trim() === "") {
    return undefined;
  }

  try {
    return await fileManager.get(bucket, path, logger);
  } catch {
    return undefined;
  }
}

async function prepareDocument(
  fileManager: FileManager,
  logger: Logger,
  unsignedBucket: string,
  signedBucket: string,
  input: DocumentInput
): Promise<DocumentToCheck> {
  const [unsignedContent, signedContent] = await Promise.all([
    downloadDocument(fileManager, logger, unsignedBucket, input.unsignedPath),
    downloadDocument(
      fileManager,
      logger,
      signedBucket,
      input.signedRecord?.path
    ),
  ]);

  return {
    entityType: input.entityType,
    entityId: input.entityId,
    unsignedDocument: {
      path: input.unsignedPath,
      content: unsignedContent,
    },
    signedDocument: {
      existsInReadmodel: input.signedRecord != null,
      path: input.signedRecord?.path,
      content: signedContent,
    },
    extraFields: input.extraFields,
  };
}

export function documentsSignatureCheckerServiceBuilder(
  readModelDB: DrizzleReturnType,
  fileManager: FileManager,
  logger: Logger,
  documentsLookBackDays: number,
  unsignedBucket: string,
  signedBucket: string,
  documentsBatchSize: number
) {
  const readModelService = readModelServiceBuilderSQL(readModelDB);

  function logIssue(issue: DocumentCheckIssue): void {
    const extraFieldsStr = issue.extraFields
      ? ` ${serializeLogFields(issue.extraFields)}`
      : "";
    const detailsStr = issue.details
      ? ` ${serializeLogFields(issue.details)}`
      : "";
    logger.error(
      `Document check [${issue.code}]: entityType=${issue.entityType} entityId=${issue.entityId} unsignedPath=${issue.unsignedPath} signedPath=${issue.signedPath}${extraFieldsStr} message="${issue.message}"${detailsStr}`
    );
  }

  return {
    /**
     * Fetches all documents (agreements, purposes, delegations) created in the
     * configured look-back window ending at midnight of `referenceDate`, downloads
     * their unsigned and signed files from S3, and runs the full assertion pipeline
     * on each one.
     *
     * @param referenceDate - The upper bound of the time window (exclusive).
     *   Defaults to today at midnight.
     * @returns A {@link JobReport} with the total counts and the list of issues found.
     */
    async verify(referenceDate: Date = new Date()): Promise<JobReport> {
      const { from, to } = getTimeRange(documentsLookBackDays, referenceDate);

      logger.info(
        `Documents signature checker started documentsLookBackDays=${documentsLookBackDays} from=${from.toISOString()} to=${to.toISOString()}`
      );

      const [agreements, purposes, delegations] = await Promise.all([
        readModelService.getAgreementsContracts(from, to),
        readModelService.getPurposeDocuments(from, to),
        readModelService.getDelegationContracts(from, to),
      ]);

      logger.info(
        `Documents signature checker fetched records agreements=${agreements.length} purposes=${purposes.length} delegations=${delegations.length}`
      );

      const documentInputs: DocumentInput[] = [
        ...agreements.map(
          (record): DocumentInput => ({
            entityType: "agreement",
            entityId: record.unsigned.agreementId,
            unsignedPath: record.unsigned.path,
            signedRecord: record.signed,
          })
        ),
        ...purposes.map(
          (record): DocumentInput => ({
            entityType: "purpose",
            entityId: record.unsigned.purposeId,
            unsignedPath: record.unsigned.path,
            signedRecord: record.signed,
            extraFields: {
              purposeVersionId: record.unsigned.purposeVersionId,
            },
          })
        ),
        ...delegations.map(
          (record): DocumentInput => ({
            entityType: "delegation",
            entityId: record.unsigned.delegationId,
            unsignedPath: record.unsigned.path,
            signedRecord: record.signed,
            extraFields: { kind: record.unsigned.kind },
          })
        ),
      ];

      const countsByEntityType: Record<DocumentEntityType, EntityTypeReport> = {
        agreement: { conforming: 0, nonConforming: 0 },
        purpose: { conforming: 0, nonConforming: 0 },
        delegation: { conforming: 0, nonConforming: 0 },
      };

      const report: JobReport = {
        processedCount: documentInputs.length,
        successCount: 0,
        issueCount: 0,
        countsByEntityType,
        issues: [],
      };

      for (
        let batchStart = 0;
        batchStart < documentInputs.length;
        batchStart += documentsBatchSize
      ) {
        const batch = documentInputs.slice(
          batchStart,
          batchStart + documentsBatchSize
        );

        const documents = await Promise.all(
          batch.map((input) =>
            prepareDocument(
              fileManager,
              logger,
              unsignedBucket,
              signedBucket,
              input
            )
          )
        );

        for (const document of documents) {
          try {
            const issues = await collectIssues(document);

            if (issues.length === 0) {
              report.successCount += 1;
              countsByEntityType[document.entityType].conforming += 1;
              continue;
            }

            report.issueCount += issues.length;
            report.issues.push(...issues);
            countsByEntityType[document.entityType].nonConforming += 1;
            issues.forEach((issue) => logIssue(issue));
          } catch (error) {
            const issue = makeIssue(
              document,
              "UNEXPECTED_CHECK_ERROR",
              "Unexpected error during document verification",
              { error: error instanceof Error ? error.message : String(error) }
            );
            report.issueCount += 1;
            report.issues.push(issue);
            countsByEntityType[document.entityType].nonConforming += 1;
            logIssue(issue);
          }
        }
      }

      const perTypeSummary = (["agreement", "purpose", "delegation"] as const)
        .map((entityType) => {
          const counts = countsByEntityType[entityType];
          return `${entityType}Conforming=${counts.conforming} ${entityType}NonConforming=${counts.nonConforming}`;
        })
        .join(" ");

      logger.info(
        `Documents signature checker summary processed=${report.processedCount} successful=${report.successCount} issues=${report.issueCount} ${perTypeSummary} documentsLookBackDays=${documentsLookBackDays} from=${from.toISOString()} to=${to.toISOString()}`
      );

      return report;
    },
  };
}
