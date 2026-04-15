export type DocumentCheckIssueCode =
  | "UNSIGNED_PATH_MISSING"
  | "UNSIGNED_FILE_MISSING"
  | "UNSIGNED_FILE_INVALID"
  | "SIGNED_RECORD_MISSING"
  | "SIGNED_PATH_MISSING"
  | "SIGNED_FILE_MISSING"
  | "SIGNED_FILE_INVALID_CMS"
  | "SIGNED_FILE_EMPTY_PAYLOAD"
  | "SIGNED_CONTENT_MISMATCH"
  | "UNEXPECTED_CHECK_ERROR";

export type DocumentEntityType = "agreement" | "purpose" | "delegation";

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

export type EntityTypeReport = {
  conforming: number;
  nonConforming: number;
};

export type JobReport = {
  processedCount: number;
  successCount: number;
  issueCount: number;
  countsByEntityType: Record<DocumentEntityType, EntityTypeReport>;
  issues: DocumentCheckIssue[];
};
