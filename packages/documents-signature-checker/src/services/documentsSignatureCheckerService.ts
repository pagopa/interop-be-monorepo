import type { FileManager, Logger } from "pagopa-interop-commons";

import { stringToDate } from "pagopa-interop-models";

import type {
  DocumentCheckIssue,
  DocumentEntityType,
  DocumentOutcome,
  EntityTypeReport,
  JobReport,
} from "../models/report.js";
import type { ReadModelServiceSQL, TimeRange } from "./readModelServiceSQL.js";
import type { CmsInspection, DownloadOutcome } from "./validators.js";

import {
  isCheckFailure,
  isExplainedByPendingSigning,
  issueSeverityByCode,
} from "../models/report.js";
import { inspectSignedCms } from "../utils/signedCmsUtils.js";
import {
  documentAssertions,
  isMissingPath,
  makeIssue,
  type DocumentToCheck,
} from "./validators.js";

/**
 * Messages of the S3 errors that mean "the object is not there". Every other
 * failure (credentials, throttling, network) must not be mistaken for a missing
 * file: `pagopa-interop-commons` flattens the AWS error into the message of a
 * single `FileManagerError`, so the message is all there is to match on. An
 * unrecognized message is reported as a check failure, never as a missing file.
 */
const NOT_FOUND_ERROR_PATTERN =
  /NoSuchKey|specified key does not exist|status code: 404/i;

const MINUTE_IN_MS = 60 * 1000;

const entityTypes = ["agreement", "purpose", "delegation"] as const;

export type DocumentsSignatureCheckerServiceBuilderParams = {
  readModelService: ReadModelServiceSQL;
  fileManager: FileManager;
  logger: Logger;
  unsignedBucket: string;
  signedBucket: string;
  documentsLookBackDays: number;
  documentsBatchSize: number;
  signingGracePeriodMinutes: number;
};

type DocumentInput = {
  entityType: DocumentEntityType;
  entityId: string;
  createdAt: Date;
  unsignedPath: string;
  signedRecord: { path: string } | null;
  extraFields?: Record<string, string | number | undefined>;
};

type DocumentEvaluation = {
  outcome: DocumentOutcome;
  issues: DocumentCheckIssue[];
};

function serializeLogFields(
  fields: Record<string, string | number | boolean | null | undefined>
): string {
  return Object.entries(fields)
    .filter(([, value]) => value != null)
    .map(([key, value]) => `${key}=${String(value)}`)
    .join(" ");
}

/**
 * Half open interval `[from, to)` ending at midnight UTC of `referenceDate`.
 * The bounds are UTC so that the checked window does not depend on the time
 * zone of the machine running the job.
 */
function getTimeRange(
  documentsLookBackDays: number,
  referenceDate: Date
): TimeRange {
  const to = new Date(referenceDate);
  to.setUTCHours(0, 0, 0, 0);

  const from = new Date(to);
  from.setUTCDate(from.getUTCDate() - documentsLookBackDays);

  return { from, to };
}

/**
 * The left join leaves every signed column null when the readmodel holds no
 * signed record: `signedId` is not nullable in the schema, so it tells a missing
 * record apart from a record carrying an empty path.
 */
function toSignedRecord(record: {
  signedId: string | null;
  signedPath: string | null;
}): { path: string } | null {
  return record.signedId !== null ? { path: record.signedPath ?? "" } : null;
}

function emptyEntityTypeReport(): EntityTypeReport {
  return { conforming: 0, nonConforming: 0, pending: 0, notChecked: 0 };
}

function emptyReport(): JobReport {
  return {
    processedCount: 0,
    conformingCount: 0,
    nonConformingCount: 0,
    pendingCount: 0,
    notCheckedCount: 0,
    issueCount: 0,
    countsByEntityType: {
      agreement: emptyEntityTypeReport(),
      purpose: emptyEntityTypeReport(),
      delegation: emptyEntityTypeReport(),
    },
    issues: [],
  };
}

async function downloadFile(
  fileManager: FileManager,
  logger: Logger,
  bucket: string,
  path: string
): Promise<DownloadOutcome> {
  if (isMissingPath(path)) {
    return { status: "skipped" };
  }

  try {
    return {
      status: "downloaded",
      content: await fileManager.get(bucket, path, logger),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    return NOT_FOUND_ERROR_PATTERN.test(message)
      ? { status: "notFound" }
      : { status: "failed", error: message };
  }
}

async function inspectDownloadedCms(
  download: DownloadOutcome
): Promise<CmsInspection | undefined> {
  if (download.status !== "downloaded") {
    return undefined;
  }

  try {
    return { status: "valid", ...(await inspectSignedCms(download.content)) };
  } catch (error) {
    return {
      status: "invalid",
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Downloads both files of a document and parses the signed one, so that every
 * assertion runs on already resolved data: the CMS envelope is parsed and its
 * signatures verified exactly once per document.
 */
async function prepareDocument(
  fileManager: FileManager,
  logger: Logger,
  unsignedBucket: string,
  signedBucket: string,
  input: DocumentInput
): Promise<DocumentToCheck> {
  const signedPath = input.signedRecord?.path ?? "";

  const [unsignedDownload, signedDownload] = await Promise.all([
    downloadFile(fileManager, logger, unsignedBucket, input.unsignedPath),
    downloadFile(fileManager, logger, signedBucket, signedPath),
  ]);

  return {
    entityType: input.entityType,
    entityId: input.entityId,
    createdAt: input.createdAt,
    unsignedDocument: {
      path: input.unsignedPath,
      download: unsignedDownload,
    },
    signedDocument: {
      existsInReadmodel: input.signedRecord !== null,
      path: signedPath,
      download: signedDownload,
      cms: await inspectDownloadedCms(signedDownload),
    },
    extraFields: input.extraFields,
  };
}

/**
 * Turns the issues collected on a document into a single verdict.
 *
 * A document the job could not read is `notChecked` rather than non conforming:
 * the anomaly is on the checker side. A document whose only problem is that its
 * signed counterpart is not there yet, and that is younger than the grace
 * period, is `pending`: SafeStorage signs asynchronously, so within that window
 * a missing signature is expected and must not raise an alarm.
 */
function evaluateDocument(
  document: DocumentToCheck,
  issues: DocumentCheckIssue[],
  referenceDate: Date,
  signingGracePeriodMinutes: number
): DocumentEvaluation {
  if (issues.length === 0) {
    return { outcome: "conforming", issues };
  }

  if (issues.some((issue) => isCheckFailure(issue.code))) {
    return { outcome: "notChecked", issues };
  }

  const ageInMinutes =
    (referenceDate.getTime() - document.createdAt.getTime()) / MINUTE_IN_MS;

  if (
    ageInMinutes < signingGracePeriodMinutes &&
    issues.every((issue) => isExplainedByPendingSigning(issue.code))
  ) {
    return {
      outcome: "pending",
      issues: [
        makeIssue(
          document,
          "SIGNING_PENDING",
          "Signed document is not available yet, within the signing grace period",
          {
            pendingCodes: issues.map((issue) => issue.code).join(","),
            ageInMinutes: Math.floor(ageInMinutes),
            signingGracePeriodMinutes,
          }
        ),
      ],
    };
  }

  return { outcome: "nonConforming", issues };
}

export function documentsSignatureCheckerServiceBuilder({
  readModelService,
  fileManager,
  logger,
  unsignedBucket,
  signedBucket,
  documentsLookBackDays,
  documentsBatchSize,
  signingGracePeriodMinutes,
}: DocumentsSignatureCheckerServiceBuilderParams) {
  function logIssue(issue: DocumentCheckIssue): void {
    const extraFieldsStr = issue.extraFields
      ? ` ${serializeLogFields(issue.extraFields)}`
      : "";
    const detailsStr = issue.details
      ? ` ${serializeLogFields(issue.details)}`
      : "";
    const message = `Document check [${issue.code}]: entityType=${issue.entityType} entityId=${issue.entityId} unsignedPath=${issue.unsignedPath} signedPath=${issue.signedPath}${extraFieldsStr} message="${issue.message}"${detailsStr}`;

    if (issueSeverityByCode[issue.code] === "warning") {
      logger.warn(message);
      return;
    }

    logger.error(message);
  }

  function recordEvaluation(
    report: JobReport,
    entityType: DocumentEntityType,
    evaluation: DocumentEvaluation
  ): void {
    report.processedCount += 1;
    report.issueCount += evaluation.issues.length;
    report.issues.push(...evaluation.issues);
    report.countsByEntityType[entityType][evaluation.outcome] += 1;

    switch (evaluation.outcome) {
      case "conforming":
        report.conformingCount += 1;
        break;
      case "nonConforming":
        report.nonConformingCount += 1;
        break;
      case "pending":
        report.pendingCount += 1;
        break;
      case "notChecked":
        report.notCheckedCount += 1;
        break;
    }

    evaluation.issues.forEach(logIssue);
  }

  async function fetchDocumentInputs(
    range: TimeRange
  ): Promise<DocumentInput[]> {
    const [agreements, purposes, delegations] = await Promise.all([
      readModelService.getAgreementContracts(range),
      readModelService.getPurposeVersionDocuments(range),
      readModelService.getDelegationContracts(range),
    ]);

    logger.info(
      `Documents signature checker fetched records agreements=${agreements.length} purposes=${purposes.length} delegations=${delegations.length}`
    );

    return [
      ...agreements.map(
        (record): DocumentInput => ({
          entityType: "agreement",
          entityId: record.agreementId,
          createdAt: stringToDate(record.createdAt),
          unsignedPath: record.unsignedPath,
          signedRecord: toSignedRecord(record),
        })
      ),
      ...purposes.map(
        (record): DocumentInput => ({
          entityType: "purpose",
          entityId: record.purposeId,
          createdAt: stringToDate(record.createdAt),
          unsignedPath: record.unsignedPath,
          signedRecord: toSignedRecord(record),
          extraFields: { purposeVersionId: record.purposeVersionId },
        })
      ),
      ...delegations.map(
        (record): DocumentInput => ({
          entityType: "delegation",
          entityId: record.delegationId,
          createdAt: stringToDate(record.createdAt),
          unsignedPath: record.unsignedPath,
          signedRecord: toSignedRecord(record),
          extraFields: { kind: record.kind },
        })
      ),
    ];
  }

  /**
   * Runs the assertion pipeline on a single document and turns the outcome into
   * a verdict. An unexpected failure is confined to the document that caused it,
   * reported as `UNEXPECTED_CHECK_ERROR`, so that one broken document cannot
   * abort the audit of all the others.
   */
  function checkDocument(
    document: DocumentToCheck,
    referenceDate: Date
  ): DocumentEvaluation {
    try {
      const issues = documentAssertions
        .map((assertion) => assertion(document))
        .filter((issue): issue is DocumentCheckIssue => issue !== undefined);

      return evaluateDocument(
        document,
        issues,
        referenceDate,
        signingGracePeriodMinutes
      );
    } catch (error) {
      return {
        outcome: "notChecked",
        issues: [
          makeIssue(
            document,
            "UNEXPECTED_CHECK_ERROR",
            "Unexpected error during document verification",
            { error: error instanceof Error ? error.message : String(error) }
          ),
        ],
      };
    }
  }

  function logSummary(report: JobReport, range: TimeRange): void {
    logger.info(
      `Documents signature checker summary processed=${report.processedCount} conforming=${report.conformingCount} nonConforming=${report.nonConformingCount} pending=${report.pendingCount} notChecked=${report.notCheckedCount} issues=${report.issueCount} documentsLookBackDays=${documentsLookBackDays} from=${range.from.toISOString()} to=${range.to.toISOString()}`
    );

    entityTypes.forEach((entityType) => {
      const counts = report.countsByEntityType[entityType];
      logger.info(
        `Documents signature checker summary by entity type entityType=${entityType} conforming=${counts.conforming} nonConforming=${counts.nonConforming} pending=${counts.pending} notChecked=${counts.notChecked}`
      );
    });
  }

  return {
    /**
     * Fetches every agreement, purpose and delegation document created in the
     * configured look back window ending at midnight UTC of `referenceDate`,
     * downloads the unsigned and signed files from S3 in batches, and runs the
     * full assertion pipeline on each one.
     *
     * @param referenceDate - Upper bound of the window, exclusive, and the
     *   instant the signing grace period is measured from. Defaults to now.
     * @returns A {@link JobReport} with the counts and the issues found. A non
     *   zero `notCheckedCount` means the run is incomplete and must be retried.
     */
    async verify(referenceDate: Date = new Date()): Promise<JobReport> {
      const range = getTimeRange(documentsLookBackDays, referenceDate);

      logger.info(
        `Documents signature checker started documentsLookBackDays=${documentsLookBackDays} documentsBatchSize=${documentsBatchSize} signingGracePeriodMinutes=${signingGracePeriodMinutes} from=${range.from.toISOString()} to=${range.to.toISOString()}`
      );

      const documentInputs = await fetchDocumentInputs(range);
      const report = emptyReport();

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

        documents.forEach((document) => {
          recordEvaluation(
            report,
            document.entityType,
            checkDocument(document, referenceDate)
          );
        });
      }

      logSummary(report, range);

      return report;
    },
  };
}

export type DocumentsSignatureCheckerService = ReturnType<
  typeof documentsSignatureCheckerServiceBuilder
>;
