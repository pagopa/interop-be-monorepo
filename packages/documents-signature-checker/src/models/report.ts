export type DocumentEntityType = "agreement" | "purpose" | "delegation";

export type DocumentCheckIssueCode =
  | "UNSIGNED_PATH_MISSING"
  | "UNSIGNED_FILE_MISSING"
  | "UNSIGNED_FILE_INVALID"
  | "UNSIGNED_FILE_DOWNLOAD_ERROR"
  | "SIGNED_RECORD_MISSING"
  | "SIGNED_PATH_MISSING"
  | "SIGNED_FILE_MISSING"
  | "SIGNED_FILE_DOWNLOAD_ERROR"
  | "SIGNED_FILE_INVALID_CMS"
  | "SIGNED_FILE_EMPTY_PAYLOAD"
  | "SIGNED_CONTENT_MISMATCH"
  | "SIGNING_PENDING"
  | "UNEXPECTED_CHECK_ERROR";

type IssueSeverity = "error" | "warning";

/**
 * Log severity of each issue code. `warning` marks expected transient states
 * that must not raise an alarm; every other code is logged at `ERROR` level and
 * is meant to be caught by monitoring.
 */
export const issueSeverityByCode: Record<
  DocumentCheckIssueCode,
  IssueSeverity
> = {
  UNSIGNED_PATH_MISSING: "error",
  UNSIGNED_FILE_MISSING: "error",
  UNSIGNED_FILE_INVALID: "error",
  UNSIGNED_FILE_DOWNLOAD_ERROR: "error",
  SIGNED_RECORD_MISSING: "error",
  SIGNED_PATH_MISSING: "error",
  SIGNED_FILE_MISSING: "error",
  SIGNED_FILE_DOWNLOAD_ERROR: "error",
  SIGNED_FILE_INVALID_CMS: "error",
  SIGNED_FILE_EMPTY_PAYLOAD: "error",
  SIGNED_CONTENT_MISMATCH: "error",
  SIGNING_PENDING: "warning",
  UNEXPECTED_CHECK_ERROR: "error",
};

/**
 * Codes reporting that the job itself could not complete the verification of a
 * document (S3 unreachable, unexpected exception), as opposed to the document
 * being non conforming. A run producing any of them is not trustworthy: the
 * document is counted as `notChecked` and the process exits with a non zero code.
 */
const checkFailureCodes: ReadonlySet<DocumentCheckIssueCode> = new Set([
  "UNSIGNED_FILE_DOWNLOAD_ERROR",
  "SIGNED_FILE_DOWNLOAD_ERROR",
  "UNEXPECTED_CHECK_ERROR",
]);

export function isCheckFailure(code: DocumentCheckIssueCode): boolean {
  return checkFailureCodes.has(code);
}

/**
 * Codes that a signature still in progress fully explains. When every issue of a
 * document falls in this set and the document is younger than the configured
 * grace period, the document is reported as `SIGNING_PENDING` instead.
 */
const pendingSigningCodes: ReadonlySet<DocumentCheckIssueCode> = new Set([
  "SIGNED_RECORD_MISSING",
  "SIGNED_PATH_MISSING",
  "SIGNED_FILE_MISSING",
]);

export function isExplainedByPendingSigning(
  code: DocumentCheckIssueCode
): boolean {
  return pendingSigningCodes.has(code);
}

export type DocumentCheckIssue = {
  code: DocumentCheckIssueCode;
  entityType: DocumentEntityType;
  entityId: string;
  unsignedPath: string;
  signedPath: string;
  message: string;
  extraFields?: Record<string, string | number | undefined>;
  details?: Record<string, string | number | boolean | undefined>;
};

/**
 * Verdict of the assertion pipeline for a single document.
 *
 * - `conforming`: every assertion passed
 * - `nonConforming`: at least one assertion failed on the document itself
 * - `pending`: the signed document is not there yet, within the grace period
 * - `notChecked`: the job could not verify the document (see {@link isCheckFailure})
 */
export type DocumentOutcome =
  | "conforming"
  | "nonConforming"
  | "pending"
  | "notChecked";

export type EntityTypeReport = Record<DocumentOutcome, number>;

export type JobReport = {
  processedCount: number;
  conformingCount: number;
  nonConformingCount: number;
  pendingCount: number;
  notCheckedCount: number;
  issueCount: number;
  countsByEntityType: Record<DocumentEntityType, EntityTypeReport>;
  issues: DocumentCheckIssue[];
};
