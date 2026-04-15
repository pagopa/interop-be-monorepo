/**
 *
 * Seeds one agreement per issue code, then spawns `tsx src/index.ts` as a
 * child process with the testcontainer ports. The output you see in the
 * terminal is byte-for-byte identical to what the job produces in production.
 *
 */
/* eslint-disable functional/no-let */
import { execSync } from "node:child_process";
import { beforeAll, describe, inject, it } from "vitest";
import {
  generateId,
  AgreementDocument,
  AgreementDocumentId,
  AgreementSignedContract,
  agreementState,
} from "pagopa-interop-models";
import { getMockAgreement } from "pagopa-interop-commons-test";
import { agreementSignedContractInReadmodelAgreement } from "pagopa-interop-readmodel-models";
import { readModelDB, seedAgreement, uploadToS3 } from "./utils.js";
import {
  createCorruptedP7m,
  createP7mWithEmptyContent,
  createValidP7m,
} from "./p7mTestHelper.js";
import { config } from "../src/config/config.js";

// All documents dated yesterday → always within the default look-back window
const DOCUMENT_DATE = new Date();
DOCUMENT_DATE.setDate(DOCUMENT_DATE.getDate() - 1);
DOCUMENT_DATE.setHours(12, 0, 0, 0);

const UNSIGNED_PDF = Buffer.from("%PDF-1.4 smoke test unsigned document");
const DIFFERENT_PDF = Buffer.from("%PDF-1.4 smoke test DIFFERENT content");
const NOT_A_PDF = Buffer.from("this is not a pdf file at all");

let validP7m: Buffer;
let mismatchedP7m: Buffer;
let emptyPayloadP7m: Buffer;
let corruptedP7m: Buffer;

async function seedAnAgreement(
  opts: {
    unsignedPath?: string;
    signedPath?: string | null;
    includeSignedRecord?: boolean;
  } = {}
): Promise<{ agreementId: string; unsignedPath: string; signedPath?: string }> {
  const base = getMockAgreement(undefined, undefined, agreementState.active);
  const agreementId = base.id;

  const unsignedDocId = generateId<AgreementDocumentId>();
  const unsignedPath =
    opts.unsignedPath ??
    `smoke/agreements/${agreementId}/${unsignedDocId}/contract.pdf`;

  const contract: AgreementDocument = {
    id: unsignedDocId,
    name: "contract.pdf",
    prettyName: "Contract",
    contentType: "application/pdf",
    path: unsignedPath,
    createdAt: DOCUMENT_DATE,
  };

  let signedContract: AgreementSignedContract | undefined;
  let signedPath: string | undefined;

  if (opts.includeSignedRecord !== false) {
    const signedDocId = generateId<AgreementDocumentId>();
    signedPath =
      opts.signedPath ??
      `smoke/agreements/${agreementId}/${signedDocId}/signed.p7m`;
    signedContract = {
      id: signedDocId,
      name: "signed.p7m",
      prettyName: "Signed contract",
      contentType: "application/pkcs7-mime",
      path: signedPath,
      createdAt: DOCUMENT_DATE,
      signedAt: DOCUMENT_DATE,
    };
  }

  await seedAgreement({ ...base, contract, signedContract });
  return { agreementId, unsignedPath, signedPath };
}

describe("smoke: all log messages", () => {
  beforeAll(async () => {
    validP7m = await createValidP7m(UNSIGNED_PDF);
    mismatchedP7m = await createValidP7m(DIFFERENT_PDF);
    emptyPayloadP7m = await createP7mWithEmptyContent();
    corruptedP7m = await createCorruptedP7m();
  });

  it("prints one log line per issue code + one conforming case", async () => {
    // — UNSIGNED_PATH_MISSING ———————————————————————————————————
    // Agreement with empty path: inserted via direct drizzle call after seeding
    const emptyPathBase = getMockAgreement(
      undefined,
      undefined,
      agreementState.active
    );
    const emptyPathDocId = generateId<AgreementDocumentId>();
    await seedAgreement({
      ...emptyPathBase,
      contract: {
        id: emptyPathDocId,
        name: "contract.pdf",
        prettyName: "Contract",
        contentType: "application/pdf",
        path: "",
        createdAt: DOCUMENT_DATE,
      },
      signedContract: undefined,
    });

    // — UNSIGNED_FILE_MISSING ———————————————————————————————————
    // Path in readmodel but file never uploaded to S3
    await seedAnAgreement({ includeSignedRecord: false });

    // — UNSIGNED_FILE_INVALID ———————————————————————————————————
    // File uploaded but content is not a PDF
    const invalidPdf = await seedAnAgreement({ includeSignedRecord: false });
    await uploadToS3(config.s3Bucket, invalidPdf.unsignedPath, NOT_A_PDF);

    // — SIGNED_RECORD_MISSING ———————————————————————————————————
    // Unsigned file ok, no signed record in readmodel at all
    const noSigned = await seedAnAgreement({ includeSignedRecord: false });
    await uploadToS3(config.s3Bucket, noSigned.unsignedPath, UNSIGNED_PDF);

    // — SIGNED_PATH_MISSING ————————————————————————————————————
    // Signed record in readmodel but path is empty string
    const signedNoPath = await seedAnAgreement({ includeSignedRecord: false });
    await uploadToS3(config.s3Bucket, signedNoPath.unsignedPath, UNSIGNED_PDF);
    await readModelDB
      .insert(agreementSignedContractInReadmodelAgreement)
      .values({
        id: generateId<AgreementDocumentId>(),
        agreementId: signedNoPath.agreementId,
        metadataVersion: 0,
        name: "signed.p7m",
        prettyName: "Signed contract",
        contentType: "application/pkcs7-mime",
        path: "",
        createdAt: DOCUMENT_DATE.toISOString(),
        signedAt: DOCUMENT_DATE.toISOString(),
      });

    // — SIGNED_FILE_MISSING ————————————————————————————————————
    // Signed path in readmodel but file never uploaded to S3
    const signedFileMissing = await seedAnAgreement();
    await uploadToS3(
      config.s3Bucket,
      signedFileMissing.unsignedPath,
      UNSIGNED_PDF
    );
    // signed path exists in readmodel but nothing uploaded to signed bucket

    // — SIGNED_FILE_INVALID_CMS —————————————————————————————————
    // Signed file is random bytes, not a P7M
    const invalidCms = await seedAnAgreement();
    await uploadToS3(config.s3Bucket, invalidCms.unsignedPath, UNSIGNED_PDF);
    await uploadToS3(
      config.s3BucketSigned,
      invalidCms.signedPath!,
      corruptedP7m
    );

    // — SIGNED_FILE_EMPTY_PAYLOAD ———————————————————————————————
    // Valid P7M structure but wraps zero bytes
    const emptyPayload = await seedAnAgreement();
    await uploadToS3(config.s3Bucket, emptyPayload.unsignedPath, UNSIGNED_PDF);
    await uploadToS3(
      config.s3BucketSigned,
      emptyPayload.signedPath!,
      emptyPayloadP7m
    );

    // — SIGNED_CONTENT_MISMATCH ————————————————————————————————
    // P7M wraps a different document than the unsigned PDF
    const mismatch = await seedAnAgreement();
    await uploadToS3(config.s3Bucket, mismatch.unsignedPath, UNSIGNED_PDF);
    await uploadToS3(
      config.s3BucketSigned,
      mismatch.signedPath!,
      mismatchedP7m
    );

    // — CONFORMING ——————————————————————————————————————————————
    // Everything correct: unsigned PDF + valid P7M wrapping the same content
    const conforming = await seedAnAgreement();
    await uploadToS3(config.s3Bucket, conforming.unsignedPath, UNSIGNED_PDF);
    await uploadToS3(config.s3BucketSigned, conforming.signedPath!, validP7m);

    // ——— Run the real job as a child process (output = production) ——
    const readModelSQLConfig = inject("readModelSQLConfig");
    const fileManagerConfig = inject("fileManagerConfig");

    execSync("npx tsx src/index.ts", {
      stdio: "inherit",
      env: {
        ...process.env,
        NODE_ENV: "production",
        READMODEL_SQL_DB_PORT: String(readModelSQLConfig?.readModelSQLDbPort),
        S3_SERVER_PORT: String(
          fileManagerConfig?.s3CustomServer
            ? fileManagerConfig.s3ServerPort
            : ""
        ),
      },
    });
  });
});
