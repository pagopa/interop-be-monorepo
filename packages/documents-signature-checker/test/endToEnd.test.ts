/**
 * Runs the real entry point as a child process against the testcontainers, so
 * that the log lines and the exit code asserted here are byte for byte the ones
 * the job produces in production.
 */
import { spawnSync } from "node:child_process";
import { getMockAgreement } from "pagopa-interop-commons-test";
import {
  generateId,
  AgreementDocument,
  AgreementDocumentId,
  AgreementSignedContract,
  agreementState,
} from "pagopa-interop-models";
import { beforeAll, describe, expect, inject, it } from "vitest";

import { config } from "../src/config/config.js";
import {
  createCorruptedP7m,
  createP7mWithEmptyContent,
  createValidP7m,
} from "./p7mTestHelper.js";
import { seedAgreement, uploadToS3 } from "./utils.js";

/** Yesterday at noon UTC: always inside the default one day look back window. */
const DOCUMENT_DATE = new Date();
DOCUMENT_DATE.setUTCDate(DOCUMENT_DATE.getUTCDate() - 1);
DOCUMENT_DATE.setUTCHours(12, 0, 0, 0);

const UNSIGNED_PDF = Buffer.from("%PDF-1.4 end to end unsigned document");
const DIFFERENT_PDF = Buffer.from("%PDF-1.4 end to end different content");
const NOT_A_PDF = Buffer.from("this is not a pdf file at all");

let validP7m: Buffer;
let differentP7m: Buffer;
let notAPdfP7m: Buffer;
let emptyPayloadP7m: Buffer;

type AgreementScenario = {
  unsignedPath?: string;
  unsignedContent?: Buffer;
  signedRecord?: "none" | "emptyPath" | "present";
  signedContent?: Buffer;
};

/**
 * Seeds one agreement and uploads the files the scenario asks for. Every
 * scenario is built so that it triggers exactly one issue code.
 */
async function seedScenario({
  unsignedPath,
  unsignedContent,
  signedRecord = "present",
  signedContent,
}: AgreementScenario): Promise<void> {
  const base = getMockAgreement(undefined, undefined, agreementState.active);
  const unsignedDocId = generateId<AgreementDocumentId>();
  const resolvedUnsignedPath =
    unsignedPath ?? `agreements/${base.id}/${unsignedDocId}/contract.pdf`;

  const contract: AgreementDocument = {
    id: unsignedDocId,
    name: "contract.pdf",
    prettyName: "Contract",
    contentType: "application/pdf",
    path: resolvedUnsignedPath,
    createdAt: DOCUMENT_DATE,
  };

  const signedDocId = generateId<AgreementDocumentId>();
  const signedPath =
    signedRecord === "emptyPath"
      ? ""
      : `agreements/${base.id}/${signedDocId}/signed.p7m`;

  const signedContract: AgreementSignedContract | undefined =
    signedRecord === "none"
      ? undefined
      : {
          id: signedDocId,
          name: "signed.p7m",
          prettyName: "Signed contract",
          contentType: "application/pkcs7-mime",
          path: signedPath,
          createdAt: DOCUMENT_DATE,
          signedAt: DOCUMENT_DATE,
        };

  await seedAgreement({ ...base, contract, signedContract });

  if (unsignedContent) {
    await uploadToS3(config.s3Bucket, resolvedUnsignedPath, unsignedContent);
  }

  if (signedContent && signedPath !== "") {
    await uploadToS3(config.s3BucketSigned, signedPath, signedContent);
  }
}

function runJob(extraEnv: Record<string, string> = {}): {
  output: string;
  exitCode: number | null;
} {
  const readModelSQLConfig = inject("readModelSQLConfig");
  const fileManagerConfig = inject("fileManagerConfig");

  const result = spawnSync("npx", ["tsx", "src/index.ts"], {
    encoding: "utf8",
    env: {
      ...process.env,
      NODE_ENV: "production",
      READMODEL_SQL_DB_PORT: String(readModelSQLConfig?.readModelSQLDbPort),
      S3_SERVER_PORT: String(fileManagerConfig?.s3ServerPort),
      ...extraEnv,
    },
  });

  return {
    // Winston writes errors to stderr and everything else to stdout
    output: `${result.stdout}${result.stderr}`,
    exitCode: result.status,
  };
}

function countOccurrences(output: string, code: string): number {
  return output.split(`[${code}]`).length - 1;
}

describe("documents-signature-checker end to end", () => {
  beforeAll(async () => {
    validP7m = await createValidP7m(UNSIGNED_PDF);
    differentP7m = await createValidP7m(DIFFERENT_PDF);
    notAPdfP7m = await createValidP7m(NOT_A_PDF);
    emptyPayloadP7m = await createP7mWithEmptyContent();
  });

  it("should log one line per issue code, summarize the run and exit with 0 when every document was checked", async () => {
    await seedScenario({
      // UNSIGNED_PATH_MISSING
      unsignedPath: "",
      signedContent: validP7m,
    });
    await seedScenario({
      // UNSIGNED_FILE_MISSING: path in readmodel, file never uploaded
      signedContent: validP7m,
    });
    await seedScenario({
      // UNSIGNED_FILE_INVALID: the signed envelope wraps the same broken bytes
      unsignedContent: NOT_A_PDF,
      signedContent: notAPdfP7m,
    });
    await seedScenario({
      // SIGNED_RECORD_MISSING
      unsignedContent: UNSIGNED_PDF,
      signedRecord: "none",
    });
    await seedScenario({
      // SIGNED_PATH_MISSING
      unsignedContent: UNSIGNED_PDF,
      signedRecord: "emptyPath",
    });
    await seedScenario({
      // SIGNED_FILE_MISSING: path in readmodel, file never uploaded
      unsignedContent: UNSIGNED_PDF,
    });
    await seedScenario({
      // SIGNED_FILE_INVALID_CMS
      unsignedContent: UNSIGNED_PDF,
      signedContent: createCorruptedP7m(),
    });
    await seedScenario({
      // SIGNED_FILE_EMPTY_PAYLOAD
      unsignedContent: UNSIGNED_PDF,
      signedContent: emptyPayloadP7m,
    });
    await seedScenario({
      // SIGNED_CONTENT_MISMATCH
      unsignedContent: UNSIGNED_PDF,
      signedContent: differentP7m,
    });
    await seedScenario({
      // Conforming
      unsignedContent: UNSIGNED_PDF,
      signedContent: validP7m,
    });

    const { output, exitCode } = runJob();

    const issueCodes = [
      "UNSIGNED_PATH_MISSING",
      "UNSIGNED_FILE_MISSING",
      "UNSIGNED_FILE_INVALID",
      "SIGNED_RECORD_MISSING",
      "SIGNED_PATH_MISSING",
      "SIGNED_FILE_MISSING",
      "SIGNED_FILE_INVALID_CMS",
      "SIGNED_FILE_EMPTY_PAYLOAD",
      "SIGNED_CONTENT_MISMATCH",
    ];

    expect(
      Object.fromEntries(
        issueCodes.map((code) => [code, countOccurrences(output, code)])
      )
    ).toEqual(Object.fromEntries(issueCodes.map((code) => [code, 1])));
    expect(output).toContain(
      "Documents signature checker summary processed=10 conforming=1 nonConforming=9 pending=0 notChecked=0 issues=9"
    );
    expect(exitCode).toBe(0);
  });

  it("should exit with 1 when S3 cannot be read, so that the run is not mistaken for a clean one", async () => {
    await seedScenario({
      unsignedContent: UNSIGNED_PDF,
      signedContent: validP7m,
    });

    const { output, exitCode } = runJob({
      S3_BUCKET: "bucket-that-does-not-exist",
    });

    expect(countOccurrences(output, "UNSIGNED_FILE_DOWNLOAD_ERROR")).toBe(1);
    expect(output).toContain("notChecked=1");
    expect(exitCode).toBe(1);
  });
});
