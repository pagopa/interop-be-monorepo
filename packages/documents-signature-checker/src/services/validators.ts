import type {
  DocumentCheckIssue,
  DocumentCheckIssueCode,
  DocumentEntityType,
} from "../models/report.js";
import {
  inspectSignedCms,
  type SignedCmsCheckResult,
} from "../utils/signedCmsUtils.js";

type DocumentContext = {
  entityType: DocumentEntityType;
  entityId: string;
};

type DocumentFile = {
  path: string | null | undefined;
  content?: Uint8Array | null;
};

type SignedDocumentFile = DocumentFile & {
  existsInReadmodel: boolean;
};

export type DocumentToCheck = DocumentContext & {
  unsignedDocument: DocumentFile;
  signedDocument: SignedDocumentFile;
  context?: Record<string, string | number | undefined>;
};

const PDF_FILE_SIGNATURE = "%PDF-";
const signedCmsChecksByDocument = new WeakMap<
  DocumentToCheck,
  Promise<SignedCmsCheckResult>
>();

function makeIssue(
  document: DocumentToCheck,
  code: DocumentCheckIssueCode,
  message: string,
  details?: Record<string, string | number | boolean | undefined>
): DocumentCheckIssue {
  return {
    code,
    entityType: document.entityType,
    entityId: document.entityId,
    unsignedPath: document.unsignedDocument.path ?? "",
    signedPath: document.signedDocument.path ?? "",
    message,
    context: document.context,
    details,
  };
}

function isMissingPath(path: string | null | undefined): boolean {
  return path == null || path.trim() === "";
}

function hasPdfSignature(content: Uint8Array): boolean {
  if (content.byteLength < PDF_FILE_SIGNATURE.length) {
    return false;
  }

  return Buffer.from(content)
    .subarray(0, PDF_FILE_SIGNATURE.length)
    .toString("utf8")
    .startsWith(PDF_FILE_SIGNATURE);
}

function hasContent(
  content: Uint8Array | null | undefined
): content is Uint8Array {
  return content != null;
}

async function getSignedCmsCheck(
  document: DocumentToCheck
): Promise<SignedCmsCheckResult> {
  const cached = signedCmsChecksByDocument.get(document);
  if (cached) {
    return cached;
  }

  const signedDocumentContent = document.signedDocument.content;
  if (!hasContent(signedDocumentContent)) {
    throw new Error("Signed document content is missing");
  }

  const check = inspectSignedCms(signedDocumentContent);
  signedCmsChecksByDocument.set(document, check);
  return check;
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

export function assertUnsignedFileExists(
  document: DocumentToCheck
): DocumentCheckIssue | undefined {
  if (
    isMissingPath(document.unsignedDocument.path) ||
    hasContent(document.unsignedDocument.content)
  ) {
    return undefined;
  }

  return makeIssue(
    document,
    "UNSIGNED_FILE_MISSING",
    "Unsigned document file is missing on S3"
  );
}

export function assertUnsignedFileValid(
  document: DocumentToCheck
): DocumentCheckIssue | undefined {
  const unsignedContent = document.unsignedDocument.content;
  if (!hasContent(unsignedContent)) {
    return undefined;
  }

  if (unsignedContent.byteLength > 0 && hasPdfSignature(unsignedContent)) {
    return undefined;
  }

  return makeIssue(
    document,
    "UNSIGNED_FILE_INVALID",
    "Unsigned document file is not a valid PDF",
    {
      byteLength: unsignedContent.byteLength,
    }
  );
}

export function assertSignedMetadataPresent(
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
  if (
    !document.signedDocument.existsInReadmodel ||
    !isMissingPath(document.signedDocument.path)
  ) {
    return undefined;
  }

  return makeIssue(
    document,
    "SIGNED_PATH_MISSING",
    "Signed document path is missing"
  );
}

export function assertSignedFileExists(
  document: DocumentToCheck
): DocumentCheckIssue | undefined {
  if (
    !document.signedDocument.existsInReadmodel ||
    isMissingPath(document.signedDocument.path) ||
    hasContent(document.signedDocument.content)
  ) {
    return undefined;
  }

  return makeIssue(
    document,
    "SIGNED_FILE_MISSING",
    "Signed document file is missing on S3"
  );
}

export async function assertSignedFileValidCms(
  document: DocumentToCheck
): Promise<DocumentCheckIssue | undefined> {
  if (!hasContent(document.signedDocument.content)) {
    return undefined;
  }

  try {
    await getSignedCmsCheck(document);
    return undefined;
  } catch (error) {
    return makeIssue(
      document,
      "SIGNED_FILE_INVALID_CMS",
      "Signed document file is not a valid CMS/P7M",
      {
        error: error instanceof Error ? error.message : String(error),
      }
    );
  }
}

export async function assertSignedFileNotEmptyPayload(
  document: DocumentToCheck
): Promise<DocumentCheckIssue | undefined> {
  if (!hasContent(document.signedDocument.content)) {
    return undefined;
  }

  try {
    const signedCmsCheck = await getSignedCmsCheck(document);
    if (signedCmsCheck.payload.byteLength > 0) {
      return undefined;
    }

    return makeIssue(
      document,
      "SIGNED_FILE_EMPTY_PAYLOAD",
      "Signed document payload is empty",
      {
        byteLength: signedCmsCheck.payload.byteLength,
      }
    );
  } catch {
    return undefined;
  }
}

export async function assertSignedContentMatchesUnsigned(
  document: DocumentToCheck
): Promise<DocumentCheckIssue | undefined> {
  const unsignedContent = document.unsignedDocument.content;
  if (
    !hasContent(unsignedContent) ||
    !hasContent(document.signedDocument.content)
  ) {
    return undefined;
  }

  try {
    const signedCmsCheck = await getSignedCmsCheck(document);

    if (
      signedCmsCheck.payload.byteLength === 0 ||
      Buffer.from(unsignedContent).equals(Buffer.from(signedCmsCheck.payload))
    ) {
      return undefined;
    }

    return makeIssue(
      document,
      "SIGNED_CONTENT_MISMATCH",
      "Signed document payload does not match unsigned content",
      {
        unsignedByteLength: unsignedContent.byteLength,
        signedPayloadByteLength: signedCmsCheck.payload.byteLength,
      }
    );
  } catch {
    return undefined;
  }
}
