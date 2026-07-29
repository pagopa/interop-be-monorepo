import type {
  DocumentCheckIssue,
  DocumentCheckIssueCode,
  DocumentEntityType,
} from "../models/report.js";
import type { SignedCmsCheckResult } from "../utils/signedCmsUtils.js";

/**
 * Result of trying to fetch a file from S3.
 *
 * `notFound` and `failed` are kept apart on purpose: an object that is really
 * missing is an anomaly of the document, while any other S3 failure (bucket
 * unreachable, credentials, throttling) means the job could not check it.
 */
export type DownloadOutcome =
  | { status: "skipped" }
  | { status: "downloaded"; content: Uint8Array }
  | { status: "notFound" }
  | { status: "failed"; error: string };

export type CmsInspection =
  | ({ status: "valid" } & SignedCmsCheckResult)
  | { status: "invalid"; error: string };

export type UnsignedDocumentToCheck = {
  path: string;
  download: DownloadOutcome;
};

export type SignedDocumentToCheck = UnsignedDocumentToCheck & {
  existsInReadmodel: boolean;
  /** Set only when the signed file was downloaded. */
  cms?: CmsInspection;
};

export type DocumentToCheck = {
  entityType: DocumentEntityType;
  entityId: string;
  createdAt: Date;
  unsignedDocument: UnsignedDocumentToCheck;
  signedDocument: SignedDocumentToCheck;
  extraFields?: Record<string, string | number | undefined>;
};

export type DocumentAssertion = (
  document: DocumentToCheck
) => DocumentCheckIssue | undefined;

const PDF_HEADER = Buffer.from("%PDF-", "latin1");

/** Wraps the bytes without copying them. */
function toBuffer(content: Uint8Array): Buffer {
  return Buffer.from(content.buffer, content.byteOffset, content.byteLength);
}

export function isMissingPath(path: string): boolean {
  return path.trim() === "";
}

function downloadedContent(download: DownloadOutcome): Uint8Array | undefined {
  return download.status === "downloaded" ? download.content : undefined;
}

function hasPdfHeader(content: Uint8Array): boolean {
  return (
    content.byteLength >= PDF_HEADER.byteLength &&
    toBuffer(content).subarray(0, PDF_HEADER.byteLength).equals(PDF_HEADER)
  );
}

export function makeIssue(
  document: DocumentToCheck,
  code: DocumentCheckIssueCode,
  message: string,
  details?: Record<string, string | number | boolean | undefined>
): DocumentCheckIssue {
  return {
    code,
    entityType: document.entityType,
    entityId: document.entityId,
    unsignedPath: document.unsignedDocument.path,
    signedPath: document.signedDocument.path,
    message,
    extraFields: document.extraFields,
    details,
  };
}

export function assertUnsignedPathPresent(
  document: DocumentToCheck
): DocumentCheckIssue | undefined {
  return isMissingPath(document.unsignedDocument.path)
    ? makeIssue(
        document,
        "UNSIGNED_PATH_MISSING",
        "Unsigned document path is missing"
      )
    : undefined;
}

export function assertUnsignedFileDownloaded(
  document: DocumentToCheck
): DocumentCheckIssue | undefined {
  const download = document.unsignedDocument.download;

  return download.status === "failed"
    ? makeIssue(
        document,
        "UNSIGNED_FILE_DOWNLOAD_ERROR",
        "Unsigned document file could not be read from S3",
        { error: download.error }
      )
    : undefined;
}

export function assertUnsignedFileExists(
  document: DocumentToCheck
): DocumentCheckIssue | undefined {
  return document.unsignedDocument.download.status === "notFound"
    ? makeIssue(
        document,
        "UNSIGNED_FILE_MISSING",
        "Unsigned document file is missing on S3"
      )
    : undefined;
}

export function assertUnsignedFileValid(
  document: DocumentToCheck
): DocumentCheckIssue | undefined {
  const content = downloadedContent(document.unsignedDocument.download);

  if (content === undefined || hasPdfHeader(content)) {
    return undefined;
  }

  return makeIssue(
    document,
    "UNSIGNED_FILE_INVALID",
    "Unsigned document file is not a valid PDF",
    { byteLength: content.byteLength }
  );
}

export function assertSignedRecordPresent(
  document: DocumentToCheck
): DocumentCheckIssue | undefined {
  return document.signedDocument.existsInReadmodel
    ? undefined
    : makeIssue(
        document,
        "SIGNED_RECORD_MISSING",
        "Signed document record is missing in readmodel"
      );
}

export function assertSignedPathPresent(
  document: DocumentToCheck
): DocumentCheckIssue | undefined {
  return document.signedDocument.existsInReadmodel &&
    isMissingPath(document.signedDocument.path)
    ? makeIssue(
        document,
        "SIGNED_PATH_MISSING",
        "Signed document path is missing"
      )
    : undefined;
}

export function assertSignedFileDownloaded(
  document: DocumentToCheck
): DocumentCheckIssue | undefined {
  const download = document.signedDocument.download;

  return download.status === "failed"
    ? makeIssue(
        document,
        "SIGNED_FILE_DOWNLOAD_ERROR",
        "Signed document file could not be read from S3",
        { error: download.error }
      )
    : undefined;
}

export function assertSignedFileExists(
  document: DocumentToCheck
): DocumentCheckIssue | undefined {
  return document.signedDocument.download.status === "notFound"
    ? makeIssue(
        document,
        "SIGNED_FILE_MISSING",
        "Signed document file is missing on S3"
      )
    : undefined;
}

export function assertSignedFileValidCms(
  document: DocumentToCheck
): DocumentCheckIssue | undefined {
  const cms = document.signedDocument.cms;

  return cms?.status === "invalid"
    ? makeIssue(
        document,
        "SIGNED_FILE_INVALID_CMS",
        "Signed document file is not a valid CMS/P7M",
        { error: cms.error }
      )
    : undefined;
}

export function assertSignedFileNotEmptyPayload(
  document: DocumentToCheck
): DocumentCheckIssue | undefined {
  const cms = document.signedDocument.cms;

  if (cms?.status !== "valid" || cms.payload.byteLength > 0) {
    return undefined;
  }

  return makeIssue(
    document,
    "SIGNED_FILE_EMPTY_PAYLOAD",
    "Signed document payload is empty",
    { byteLength: cms.payload.byteLength }
  );
}

export function assertSignedContentMatchesUnsigned(
  document: DocumentToCheck
): DocumentCheckIssue | undefined {
  const unsignedContent = downloadedContent(document.unsignedDocument.download);
  const cms = document.signedDocument.cms;

  if (
    unsignedContent === undefined ||
    cms?.status !== "valid" ||
    cms.payload.byteLength === 0
  ) {
    return undefined;
  }

  if (toBuffer(unsignedContent).equals(toBuffer(cms.payload))) {
    return undefined;
  }

  return makeIssue(
    document,
    "SIGNED_CONTENT_MISMATCH",
    "Signed document payload does not match unsigned content",
    {
      unsignedByteLength: unsignedContent.byteLength,
      signedPayloadByteLength: cms.payload.byteLength,
    }
  );
}

/**
 * Every check run on a document, in reporting order. Each assertion is total and
 * independent: it reports its own failure only, and stays silent when an earlier
 * step already explains it (a file that was never downloaded is not "invalid").
 */
export const documentAssertions: readonly DocumentAssertion[] = [
  assertUnsignedPathPresent,
  assertUnsignedFileDownloaded,
  assertUnsignedFileExists,
  assertUnsignedFileValid,
  assertSignedRecordPresent,
  assertSignedPathPresent,
  assertSignedFileDownloaded,
  assertSignedFileExists,
  assertSignedFileValidCms,
  assertSignedFileNotEmptyPayload,
  assertSignedContentMatchesUnsigned,
];
