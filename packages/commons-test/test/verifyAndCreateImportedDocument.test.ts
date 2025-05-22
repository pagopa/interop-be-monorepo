import { describe, it, expect, vi } from "vitest";
import {
  genericLogger,
  verifyAndCreateImportedDocument,
} from "pagopa-interop-commons";
import { generateId, genericError, Technology } from "pagopa-interop-models";
import AdmZip from "adm-zip";
import { getMockEService } from "../src/index.js";
import { fileManager, s3Bucket } from "./utils.js";

describe("verifyAndCreateImportedDocument", () => {
  const eservice = getMockEService();
  const technology = Technology.Enum.Rest;
  const kind = "INTERFACE";
  const documentId = generateId();

  const createMockZipEntry = (
    content: string,
    path: string
  ): AdmZip.IZipEntry => {
    const zip = new AdmZip();
    zip.addFile(path, Buffer.from(content));
    const entries = zip.getEntries();
    return entries.find((entry) => entry.entryName === path)!;
  };

  it("should successfully create a document from a zip entry", async () => {
    const fileContent = JSON.stringify({
      openapi: "3.0.2",
      servers: [],
      info: { title: "Test API" },
    });
    const filePath = "test.openapi.3.0.2.json";
    const prettyName = "Test Document";

    const zipEntry = createMockZipEntry(fileContent, filePath);
    const entriesMap = new Map<string, AdmZip.IZipEntry>([
      [filePath, zipEntry],
    ]);

    const mockCreateDocumentHandler = vi
      .fn()
      .mockResolvedValue({ id: documentId });

    await verifyAndCreateImportedDocument(
      fileManager,
      eservice.id,
      technology,
      entriesMap,
      {
        prettyName,
        path: filePath,
      },
      kind,
      mockCreateDocumentHandler,
      s3Bucket.toString(),
      "document-path",
      genericLogger
    );

    expect(mockCreateDocumentHandler).toHaveBeenCalledOnce();
  });

  it("should throw genericError if the file path is not found in entries", async () => {
    const entriesMap = new Map<string, AdmZip.IZipEntry>();

    await expect(
      verifyAndCreateImportedDocument(
        fileManager,
        eservice.id,
        technology,
        entriesMap,
        {
          prettyName: "Test Document",
          path: "non-existent.json",
        },
        kind,
        () => Promise.resolve(),
        s3Bucket.toString(),
        "document-path",
        genericLogger
      )
    ).rejects.toThrow(genericError("Invalid file"));
  });
});
