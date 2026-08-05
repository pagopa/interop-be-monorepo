import AdmZip from "adm-zip";
import {
  genericLogger,
  verifyAndUploadImportedDocument,
} from "pagopa-interop-commons";
import {
  contentTooLargeError,
  genericError,
  invalidImportedInterfaceFileDetected,
  Technology,
} from "pagopa-interop-models";
import { describe, it, expect } from "vitest";

import { fileManager, s3Bucket } from "./utils.js";

describe("verifyAndUploadImportedDocument", () => {
  const technology = Technology.Enum.Rest;
  const kind = "INTERFACE";
  const noLimitFileSizePolicy = {
    maxFileSizeBytes: Number.MAX_SAFE_INTEGER,
  };

  const createMockZipEntry = (
    content: string,
    path: string
  ): AdmZip.IZipEntry => {
    const zip = new AdmZip();
    zip.addFile(path, Buffer.from(content));
    const entries = zip.getEntries();
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    return entries.find((entry) => entry.entryName === path)!;
  };

  it("should successfully upload a document from a zip entry and return its info", async () => {
    const fileContent = JSON.stringify({
      openapi: "3.0.2",
      servers: [{ url: "https://example.com" }],
      info: { title: "Test API" },
    });
    const filePath = "test.openapi.3.0.2.json";
    const prettyName = "Test Document";

    const zipEntry = createMockZipEntry(fileContent, filePath);
    const entriesMap = new Map<string, AdmZip.IZipEntry>([
      [filePath, zipEntry],
    ]);

    const uploaded = await verifyAndUploadImportedDocument(
      fileManager,
      technology,
      entriesMap,
      {
        prettyName,
        path: filePath,
      },
      kind,
      s3Bucket.toString(),
      "document-path",
      noLimitFileSizePolicy,
      genericLogger
    );

    expect(uploaded).toMatchObject({
      fileName: filePath,
      prettyName,
      contentType: "application/json",
      serverUrls: ["https://example.com"],
    });
    expect(uploaded.documentId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
    );
    expect(uploaded.filePath).toContain("document-path");
    expect(uploaded.checksum).toEqual(expect.any(String));
  });

  it("should throw genericError if the file path is not found in entries", async () => {
    const entriesMap = new Map<string, AdmZip.IZipEntry>();

    await expect(
      verifyAndUploadImportedDocument(
        fileManager,
        technology,
        entriesMap,
        {
          prettyName: "Test Document",
          path: "non-existent.json",
        },
        kind,
        s3Bucket.toString(),
        "document-path",
        noLimitFileSizePolicy,
        genericLogger
      )
    ).rejects.toThrow(genericError("Invalid file"));
  });

  it("should throw contentTooLargeError when imported file size exceeds limit", async () => {
    const fileContent = JSON.stringify({
      openapi: "3.0.2",
      servers: [{ url: "https://example.com" }],
      info: { title: "Test API" },
    });
    const filePath = "test.openapi.3.0.2.json";

    const zipEntry = createMockZipEntry(fileContent, filePath);
    const entriesMap = new Map<string, AdmZip.IZipEntry>([
      [filePath, zipEntry],
    ]);

    const maxFileSizeBytes = zipEntry.getData().byteLength - 1;

    await expect(
      verifyAndUploadImportedDocument(
        fileManager,
        technology,
        entriesMap,
        {
          prettyName: "Test Document",
          path: filePath,
        },
        kind,
        s3Bucket.toString(),
        "document-path",
        { maxFileSizeBytes },
        genericLogger
      )
    ).rejects.toThrow(
      contentTooLargeError(
        `File size ${zipEntry.getData().byteLength} bytes exceeds maximum allowed size of ${maxFileSizeBytes} bytes`
      )
    );
  });

  it.each([
    {
      description: "empty servers array",
      fileContent: JSON.stringify({
        openapi: "3.0.2",
        servers: [],
        info: { title: "Test API" },
      }),
    },
    {
      description: "missing servers field",
      fileContent: JSON.stringify({
        openapi: "3.0.2",
        info: { title: "Test API" },
      }),
    },
  ])(
    "should throw invalidImportedInterfaceFileDetected for an imported REST interface with $description",
    async ({ fileContent }) => {
      const filePath = "test.openapi.3.0.2.json";
      const zipEntry = createMockZipEntry(fileContent, filePath);
      const entriesMap = new Map<string, AdmZip.IZipEntry>([
        [filePath, zipEntry],
      ]);

      await expect(
        verifyAndUploadImportedDocument(
          fileManager,
          technology,
          entriesMap,
          {
            prettyName: "Test Document",
            path: filePath,
          },
          kind,
          s3Bucket.toString(),
          "document-path",
          noLimitFileSizePolicy,
          genericLogger
        )
      ).rejects.toThrow(invalidImportedInterfaceFileDetected(filePath));
    }
  );
});
