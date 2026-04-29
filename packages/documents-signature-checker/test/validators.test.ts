/* eslint-disable functional/no-let */
import { beforeAll, describe, expect, it } from "vitest";
import type { DocumentToCheck } from "../src/services/validators.js";
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
} from "../src/services/validators.js";
import {
  createCorruptedP7m,
  createP7mWithEmptyContent,
  createValidP7m,
} from "./p7mTestHelper.js";

const VALID_UNSIGNED_PDF = Buffer.from("%PDF-1.4 validator unsigned document");
const DIFFERENT_UNSIGNED_PDF = Buffer.from(
  "%PDF-1.4 validator unsigned document with different content"
);

let validP7m: Buffer;
let emptyPayloadP7m: Buffer;
let mismatchedP7m: Buffer;
const corruptedP7m = createCorruptedP7m();

type DocumentOverrides = Partial<
  Pick<DocumentToCheck, "entityType" | "entityId">
> & {
  unsignedDocument?: Partial<DocumentToCheck["unsignedDocument"]>;
  signedDocument?: Partial<DocumentToCheck["signedDocument"]>;
};

function makeDocument(overrides?: DocumentOverrides): DocumentToCheck {
  const unsignedDocumentOverrides = overrides?.unsignedDocument ?? {};
  const signedDocumentOverrides = overrides?.signedDocument ?? {};

  return {
    entityType: overrides?.entityType ?? "agreement",
    entityId: overrides?.entityId ?? "agreement-id",
    unsignedDocument: {
      path: "agreements/agreement-id/contract.pdf",
      content: VALID_UNSIGNED_PDF,
      ...unsignedDocumentOverrides,
    },
    signedDocument: {
      existsInReadmodel: true,
      path: "agreements/agreement-id/contract.p7m",
      content: validP7m,
      ...signedDocumentOverrides,
    },
  };
}

describe("validators", () => {
  beforeAll(async () => {
    validP7m = await createValidP7m(VALID_UNSIGNED_PDF);
    emptyPayloadP7m = await createP7mWithEmptyContent();
    mismatchedP7m = await createValidP7m(DIFFERENT_UNSIGNED_PDF);
  });

  it("should return UNSIGNED_PATH_MISSING when the path is null, undefined, or whitespace-only", () => {
    expect(
      assertUnsignedPathPresent(
        makeDocument({ unsignedDocument: { path: "   " } })
      )
    ).toMatchObject({ code: "UNSIGNED_PATH_MISSING" });
  });

  it("should return UNSIGNED_FILE_MISSING when unsigned file content was not downloaded from S3", () => {
    expect(
      assertUnsignedFileExists(
        makeDocument({ unsignedDocument: { content: undefined } })
      )
    ).toMatchObject({ code: "UNSIGNED_FILE_MISSING" });
  });

  it("should return UNSIGNED_FILE_INVALID when the file content does not start with the PDF header", () => {
    expect(
      assertUnsignedFileValid(
        makeDocument({
          unsignedDocument: { content: Buffer.from("not-a-pdf") },
        })
      )
    ).toMatchObject({ code: "UNSIGNED_FILE_INVALID" });
  });

  it("should return UNSIGNED_FILE_INVALID when the file is shorter than the PDF header signature", () => {
    expect(
      assertUnsignedFileValid(
        makeDocument({ unsignedDocument: { content: Buffer.from("%PD") } })
      )
    ).toMatchObject({ code: "UNSIGNED_FILE_INVALID" });
  });

  it("should return no issue when unsigned content is absent (download failed or skipped)", () => {
    expect(
      assertUnsignedFileValid(
        makeDocument({ unsignedDocument: { content: undefined } })
      )
    ).toBeUndefined();
  });

  it("should return SIGNED_RECORD_MISSING when the signed document record is absent from the readmodel", () => {
    expect(
      assertSignedMetadataPresent(
        makeDocument({ signedDocument: { existsInReadmodel: false } })
      )
    ).toMatchObject({ code: "SIGNED_RECORD_MISSING" });
  });

  it("should return SIGNED_PATH_MISSING when the signed record exists but its path is empty", () => {
    expect(
      assertSignedPathPresent(
        makeDocument({ signedDocument: { path: "", existsInReadmodel: true } })
      )
    ).toMatchObject({ code: "SIGNED_PATH_MISSING" });
  });

  it("should return SIGNED_FILE_MISSING when signed file content was not downloaded from S3", () => {
    expect(
      assertSignedFileExists(
        makeDocument({
          signedDocument: { content: undefined, existsInReadmodel: true },
        })
      )
    ).toMatchObject({ code: "SIGNED_FILE_MISSING" });
  });

  it("should return SIGNED_FILE_INVALID_CMS when the signed file is corrupted and not parseable as CMS", async () => {
    await expect(
      assertSignedFileValidCms(
        makeDocument({ signedDocument: { content: corruptedP7m } })
      )
    ).resolves.toMatchObject({ code: "SIGNED_FILE_INVALID_CMS" });
  });

  it("should return SIGNED_FILE_EMPTY_PAYLOAD when the CMS envelope contains a zero-byte payload", async () => {
    await expect(
      assertSignedFileNotEmptyPayload(
        makeDocument({ signedDocument: { content: emptyPayloadP7m } })
      )
    ).resolves.toMatchObject({ code: "SIGNED_FILE_EMPTY_PAYLOAD" });
  });

  it("should return SIGNED_CONTENT_MISMATCH when the CMS payload differs from the unsigned file content", async () => {
    await expect(
      assertSignedContentMatchesUnsigned(
        makeDocument({ signedDocument: { content: mismatchedP7m } })
      )
    ).resolves.toMatchObject({ code: "SIGNED_CONTENT_MISMATCH" });
  });

  it("should return no issue when document paths, file contents, CMS structure, and payload are all valid", async () => {
    const document = makeDocument();

    expect(assertUnsignedPathPresent(document)).toBeUndefined();
    expect(assertUnsignedFileExists(document)).toBeUndefined();
    expect(assertUnsignedFileValid(document)).toBeUndefined();
    expect(assertSignedMetadataPresent(document)).toBeUndefined();
    expect(assertSignedPathPresent(document)).toBeUndefined();
    expect(assertSignedFileExists(document)).toBeUndefined();
    await expect(assertSignedFileValidCms(document)).resolves.toBeUndefined();
    await expect(
      assertSignedFileNotEmptyPayload(document)
    ).resolves.toBeUndefined();
    await expect(
      assertSignedContentMatchesUnsigned(document)
    ).resolves.toBeUndefined();
  });
});
