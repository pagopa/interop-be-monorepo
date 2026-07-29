import { describe, expect, it } from "vitest";

import type { DocumentToCheck } from "../src/services/validators.js";

import {
  assertSignedContentMatchesUnsigned,
  assertSignedFileDownloaded,
  assertSignedFileExists,
  assertSignedFileNotEmptyPayload,
  assertSignedFileValidCms,
  assertSignedPathPresent,
  assertSignedRecordPresent,
  assertUnsignedFileDownloaded,
  assertUnsignedFileExists,
  assertUnsignedFileValid,
  assertUnsignedPathPresent,
  documentAssertions,
} from "../src/services/validators.js";

const UNSIGNED_PDF = new Uint8Array(
  Buffer.from("%PDF-1.4 validator unsigned document")
);
const DIFFERENT_PDF = new Uint8Array(
  Buffer.from("%PDF-1.4 validator unsigned document with different content")
);

type DocumentOverrides = {
  createdAt?: Date;
  unsignedDocument?: Partial<DocumentToCheck["unsignedDocument"]>;
  signedDocument?: Partial<DocumentToCheck["signedDocument"]>;
};

function makeDocument(overrides?: DocumentOverrides): DocumentToCheck {
  return {
    entityType: "agreement",
    entityId: "agreement-id",
    createdAt: overrides?.createdAt ?? new Date("2026-04-14T10:00:00.000Z"),
    unsignedDocument: {
      path: "agreements/agreement-id/contract.pdf",
      download: { status: "downloaded", content: UNSIGNED_PDF },
      ...overrides?.unsignedDocument,
    },
    signedDocument: {
      existsInReadmodel: true,
      path: "agreements/agreement-id/contract.p7m",
      download: {
        status: "downloaded",
        content: new Uint8Array(Buffer.from("p7m-bytes")),
      },
      cms: { status: "valid", payload: UNSIGNED_PDF },
      ...overrides?.signedDocument,
    },
  };
}

describe("validators", () => {
  it("should return UNSIGNED_PATH_MISSING when the unsigned path is whitespace only", () => {
    const document = makeDocument({
      unsignedDocument: { path: "   ", download: { status: "skipped" } },
    });

    expect(assertUnsignedPathPresent(document)).toMatchObject({
      code: "UNSIGNED_PATH_MISSING",
    });
  });

  it("should return UNSIGNED_FILE_DOWNLOAD_ERROR when the unsigned file could not be read from S3", () => {
    const document = makeDocument({
      unsignedDocument: {
        download: { status: "failed", error: "Access Denied" },
      },
    });

    expect(assertUnsignedFileDownloaded(document)).toMatchObject({
      code: "UNSIGNED_FILE_DOWNLOAD_ERROR",
      details: { error: "Access Denied" },
    });
  });

  it("should not report the unsigned file as missing when the download failed for another reason", () => {
    const document = makeDocument({
      unsignedDocument: {
        download: { status: "failed", error: "Access Denied" },
      },
    });

    expect(assertUnsignedFileExists(document)).toBeUndefined();
  });

  it("should return UNSIGNED_FILE_MISSING when the unsigned file does not exist on S3", () => {
    const document = makeDocument({
      unsignedDocument: { download: { status: "notFound" } },
    });

    expect(assertUnsignedFileExists(document)).toMatchObject({
      code: "UNSIGNED_FILE_MISSING",
    });
  });

  it("should return UNSIGNED_FILE_INVALID when the file content does not start with the PDF header", () => {
    const document = makeDocument({
      unsignedDocument: {
        download: {
          status: "downloaded",
          content: new Uint8Array(Buffer.from("not-a-pdf")),
        },
      },
    });

    expect(assertUnsignedFileValid(document)).toMatchObject({
      code: "UNSIGNED_FILE_INVALID",
    });
  });

  it("should return UNSIGNED_FILE_INVALID when the file is shorter than the PDF header", () => {
    const document = makeDocument({
      unsignedDocument: {
        download: {
          status: "downloaded",
          content: new Uint8Array(Buffer.from("%PD")),
        },
      },
    });

    expect(assertUnsignedFileValid(document)).toMatchObject({
      code: "UNSIGNED_FILE_INVALID",
      details: { byteLength: 3 },
    });
  });

  it("should not check the content of an unsigned file that was never downloaded", () => {
    const document = makeDocument({
      unsignedDocument: { download: { status: "notFound" } },
    });

    expect(assertUnsignedFileValid(document)).toBeUndefined();
  });

  it("should return SIGNED_RECORD_MISSING when the signed document record is absent from the readmodel", () => {
    const document = makeDocument({
      signedDocument: {
        existsInReadmodel: false,
        path: "",
        download: { status: "skipped" },
        cms: undefined,
      },
    });

    expect(assertSignedRecordPresent(document)).toMatchObject({
      code: "SIGNED_RECORD_MISSING",
    });
  });

  it("should return SIGNED_PATH_MISSING when the signed record exists but its path is empty", () => {
    const document = makeDocument({
      signedDocument: {
        path: "",
        download: { status: "skipped" },
        cms: undefined,
      },
    });

    expect(assertSignedPathPresent(document)).toMatchObject({
      code: "SIGNED_PATH_MISSING",
    });
  });

  it("should not report a missing signed path when the signed record itself is absent", () => {
    const document = makeDocument({
      signedDocument: {
        existsInReadmodel: false,
        path: "",
        download: { status: "skipped" },
        cms: undefined,
      },
    });

    expect(assertSignedPathPresent(document)).toBeUndefined();
  });

  it("should return SIGNED_FILE_DOWNLOAD_ERROR when the signed file could not be read from S3", () => {
    const document = makeDocument({
      signedDocument: {
        download: { status: "failed", error: "Connection timeout" },
        cms: undefined,
      },
    });

    expect(assertSignedFileDownloaded(document)).toMatchObject({
      code: "SIGNED_FILE_DOWNLOAD_ERROR",
      details: { error: "Connection timeout" },
    });
  });

  it("should return SIGNED_FILE_MISSING when the signed file does not exist on S3", () => {
    const document = makeDocument({
      signedDocument: { download: { status: "notFound" }, cms: undefined },
    });

    expect(assertSignedFileExists(document)).toMatchObject({
      code: "SIGNED_FILE_MISSING",
    });
  });

  it("should return SIGNED_FILE_INVALID_CMS when the signed file is not a parseable CMS envelope", () => {
    const document = makeDocument({
      signedDocument: {
        cms: { status: "invalid", error: "CMS content type is not SignedData" },
      },
    });

    expect(assertSignedFileValidCms(document)).toMatchObject({
      code: "SIGNED_FILE_INVALID_CMS",
      details: { error: "CMS content type is not SignedData" },
    });
  });

  it("should return SIGNED_FILE_EMPTY_PAYLOAD when the CMS envelope encapsulates zero bytes", () => {
    const document = makeDocument({
      signedDocument: {
        cms: { status: "valid", payload: new Uint8Array() },
      },
    });

    expect(assertSignedFileNotEmptyPayload(document)).toMatchObject({
      code: "SIGNED_FILE_EMPTY_PAYLOAD",
      details: { byteLength: 0 },
    });
  });

  it("should return SIGNED_CONTENT_MISMATCH when the CMS payload differs from the unsigned file content", () => {
    const document = makeDocument({
      signedDocument: {
        cms: { status: "valid", payload: DIFFERENT_PDF },
      },
    });

    expect(assertSignedContentMatchesUnsigned(document)).toMatchObject({
      code: "SIGNED_CONTENT_MISMATCH",
      details: {
        unsignedByteLength: UNSIGNED_PDF.byteLength,
        signedPayloadByteLength: DIFFERENT_PDF.byteLength,
      },
    });
  });

  it("should not report a content mismatch when the payload is empty, as the empty payload check already covers it", () => {
    const document = makeDocument({
      signedDocument: {
        cms: { status: "valid", payload: new Uint8Array() },
      },
    });

    expect(assertSignedContentMatchesUnsigned(document)).toBeUndefined();
  });

  it("should not report a content mismatch when the unsigned file was not downloaded", () => {
    const document = makeDocument({
      unsignedDocument: { download: { status: "notFound" } },
    });

    expect(assertSignedContentMatchesUnsigned(document)).toBeUndefined();
  });

  it("should return no issue at all when paths, files, CMS structure and payload are valid", () => {
    const document = makeDocument();

    expect(
      documentAssertions
        .map((assertion) => assertion(document))
        .filter((issue) => issue !== undefined)
    ).toEqual([]);
  });

  it("should carry the entity identity and both paths on every issue it reports", () => {
    const document = makeDocument({
      unsignedDocument: { download: { status: "notFound" } },
    });

    expect(assertUnsignedFileExists(document)).toMatchObject({
      entityType: "agreement",
      entityId: "agreement-id",
      unsignedPath: "agreements/agreement-id/contract.pdf",
      signedPath: "agreements/agreement-id/contract.p7m",
    });
  });
});
