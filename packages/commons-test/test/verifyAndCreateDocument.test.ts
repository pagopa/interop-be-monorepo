import { fileURLToPath } from "url";
import path from "path";
import fs from "fs/promises";
import {
  genericLogger,
  interpolateApiSpec,
  verifyAndCreateDocument,
} from "pagopa-interop-commons";
import { describe, expect, it, vi } from "vitest";
import {
  generateId,
  invalidInterfaceContentTypeDetected,
  Technology,
} from "pagopa-interop-models";
import { getMockEService } from "../src/index.js";
import { fileManager, s3Bucket } from "./utils.js";

const readFileContent = async (fileName: string): Promise<string> => {
  const filename = fileURLToPath(import.meta.url);
  const dirname = path.dirname(filename);
  const templatePath = `./resources/${fileName}`;

  const htmlTemplateBuffer = await fs.readFile(`${dirname}/${templatePath}`);
  return htmlTemplateBuffer.toString();
};

describe("verifyAndCreateDocument", async () => {
  const resourceId = generateId();
  const eservice = getMockEService();
  const fileContent: string = await readFileContent("test.openapi.3.0.2.json");

  const interfaceFileInfo = {
    id: generateId(),
    name: "json",
    contentType: "application/json",
    prettyName: "Test Interface",
  };

  const serverUrls = [
    "http://server1.example.com",
    "http://server2.example.com",
  ];

  const eserviceInstanceInterfaceRestData = {
    contactName: "Test User",
    contactEmail: "Test email",
    contactUrl: "http://example.com",
    termsAndConditionsUrl: "http://example.com",
  };

  const file: File = await interpolateApiSpec(
    eservice,
    fileContent,
    interfaceFileInfo,
    serverUrls,
    eserviceInstanceInterfaceRestData
  );

  const documentId = generateId();
  const filePath = "document-path";
  const prettyName = "pretty-name";
  const kind = "INTERFACE";
  const fileName = interfaceFileInfo.name;
  const contentType = "application/json";

  it("should create a document", async () => {
    const mockCreateDocumentHandler = vi
      .fn()
      .mockResolvedValue({ id: documentId });

    await verifyAndCreateDocument(
      fileManager,
      resourceId,
      Technology.Enum.Rest,
      kind,
      file,
      documentId,
      s3Bucket.toString(),
      filePath,
      prettyName,
      mockCreateDocumentHandler,
      genericLogger
    );

    expect(mockCreateDocumentHandler).toHaveBeenCalledWith(
      documentId,
      fileName,
      `document-path/${documentId}/${interfaceFileInfo.name}`,
      prettyName,
      kind,
      serverUrls,
      contentType,
      expect.any(String)
    );
  });
  it("should throw invalidInterfaceContentTypeDetected if the content type is not valid", async () => {
    const invalidFile = new File([file], file.name, {
      type: "",
      lastModified: file.lastModified,
    });
    await expect(
      verifyAndCreateDocument(
        fileManager,
        resourceId,
        Technology.Enum.Rest,
        kind,
        invalidFile,
        documentId,
        "document-container",
        filePath,
        prettyName,
        () => Promise.resolve(),
        genericLogger
      )
    ).rejects.toThrowError(
      invalidInterfaceContentTypeDetected(
        resourceId,
        "invalid",
        Technology.Enum.Rest
      )
    );
  });
  it("should delete the file and rethrow error if document creation fails", async () => {
    const filePath = "document-path";

    const deleteFileSpy = vi
      .spyOn(fileManager, "delete")
      .mockResolvedValue(undefined);

    const mockCreateDocumentHandler = vi
      .fn()
      .mockRejectedValue(new Error("Document creation failed"));

    await expect(
      verifyAndCreateDocument(
        fileManager,
        resourceId,
        Technology.Enum.Rest,
        kind,
        file,
        documentId,
        s3Bucket.toString(),
        filePath,
        prettyName,
        mockCreateDocumentHandler,
        genericLogger
      )
    ).rejects.toThrow("Document creation failed");

    expect(deleteFileSpy).toHaveBeenCalledWith(
      s3Bucket.toString(),
      `document-path/${documentId}/${interfaceFileInfo.name}`,
      genericLogger
    );
  });
});
