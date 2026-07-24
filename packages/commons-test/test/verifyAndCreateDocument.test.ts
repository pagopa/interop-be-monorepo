import {
  genericLogger,
  interpolateTemplateApiSpec,
  verifyAndCreateDocument,
} from "pagopa-interop-commons";
import {
  contentTooLargeError,
  generateId,
  invalidContentTypeDetected,
  invalidFileUploadError,
  technology,
} from "pagopa-interop-models";
import { describe, expect, it, vi } from "vitest";

import {
  getMockedPdfBuffer,
  getMockEService,
  getPaddedMockedPdfBuffer,
  readFileContent,
  readFileContentAsBuffer,
} from "../src/index.js";
import { fileManager, s3Bucket } from "./utils.js";

describe("verifyAndCreateDocument", async () => {
  const eservice = getMockEService();
  const resource = { id: eservice.id, isEserviceTemplate: false };
  const fileContent: string = await readFileContent("test.openapi.3.0.2.json");

  const interfaceFileInfo = {
    id: generateId(),
    name: "test.json",
    contentType: "application/json",
    prettyName: "Test Interface",
  };

  const serverUrls = [
    { url: "http://server1.example.com" },
    { url: "http://server2.example.com" },
  ];

  const eserviceInstanceInterfaceRestData = {
    contactName: "Test User",
    contactEmail: "Test email",
    contactUrl: "http://example.com",
    termsAndConditionsUrl: "http://example.com",
  };

  const file: File = await interpolateTemplateApiSpec(
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
  const noLimitFileSizePolicy = {
    maxFileSizeBytes: Number.MAX_SAFE_INTEGER,
  };

  it("should create a document", async () => {
    const mockCreateDocumentHandler = vi
      .fn()
      .mockResolvedValue({ id: documentId });

    await verifyAndCreateDocument(
      fileManager,
      resource,
      technology.rest,
      kind,
      file,
      documentId,
      s3Bucket.toString(),
      filePath,
      prettyName,
      mockCreateDocumentHandler,
      noLimitFileSizePolicy,
      genericLogger
    );

    expect(mockCreateDocumentHandler).toHaveBeenCalledWith(
      documentId,
      fileName,
      `document-path/${documentId}/${interfaceFileInfo.name}`,
      prettyName,
      kind,
      serverUrls.map((server) => server.url),
      contentType,
      expect.any(String)
    );
  });

  it.each([
    {
      content: getPaddedMockedPdfBuffer(),
      name: "test.pdf",
      type: "application/pdf",
    },
    {
      content: '"good string"',
      name: "test.json",
      type: "application/json",
    },
    {
      content: Buffer.from("hello"),
      name: "test.txt",
      type: "text/plain",
    },
  ])(
    "should create documents when file extensions and formats are valid",
    async ({ content, name, type }) => {
      const validFile = new File([content], name, {
        type: type,
        lastModified: file.lastModified,
      });

      const mockCreateDocumentHandler = vi
        .fn()
        .mockResolvedValue({ id: documentId });

      await verifyAndCreateDocument(
        fileManager,
        resource,
        technology.rest,
        "DOCUMENT",
        validFile,
        documentId,
        s3Bucket.toString(),
        filePath,
        name,
        mockCreateDocumentHandler,
        noLimitFileSizePolicy,
        genericLogger
      );

      expect(mockCreateDocumentHandler).toHaveBeenCalledWith(
        documentId,
        name,
        `document-path/${documentId}/${name}`,
        name,
        "DOCUMENT",
        [],
        type,
        expect.any(String)
      );
    }
  );
  it("should throw invalidContentTypeDetected if the content type is not valid", async () => {
    const invalidFile = new File([file], file.name, {
      type: "",
      lastModified: file.lastModified,
    });
    await expect(
      verifyAndCreateDocument(
        fileManager,
        resource,
        technology.rest,
        kind,
        invalidFile,
        documentId,
        "document-container",
        filePath,
        prettyName,
        () => Promise.resolve(),
        noLimitFileSizePolicy,
        genericLogger
      )
    ).rejects.toThrowError(
      invalidContentTypeDetected(resource, "invalid", technology.rest)
    );
  });
  it.each([
    {
      content: getPaddedMockedPdfBuffer(1024),
      name: "test.pdf",
      type: "application/pdf",
    },
    {
      content: "bad string",
      name: "test.json",
      type: "application/json",
    },
    {
      content: Buffer.from([0x00, 0xff, 0x7a, 0x80, 0x00, 0x01]),
      name: "test.info",
      type: "text/plain",
    },
  ])(
    "should throw invalidFileUploadError on wrong file format",
    async ({ content, name, type }) => {
      const invalidFile = new File([content], name, {
        type: type,
        lastModified: file.lastModified,
      });
      await expect(
        verifyAndCreateDocument(
          fileManager,
          resource,
          technology.rest,
          "DOCUMENT",
          invalidFile,
          documentId,
          s3Bucket.toString(),
          filePath,
          prettyName,
          () => Promise.resolve(),
          noLimitFileSizePolicy,
          genericLogger
        )
      ).rejects.toThrowError(invalidFileUploadError());
    }
  );
  it.each(["exe", "py", "sh", "ts", "js"])(
    "should throw invalidFileUploadError if extension is not allowed",
    async (ext) => {
      const invalidFile = new File([file], `testFile.${ext}`, {
        type: "application/pdf",
        lastModified: file.lastModified,
      });
      await expect(
        verifyAndCreateDocument(
          fileManager,
          resource,
          technology.rest,
          "DOCUMENT",
          invalidFile,
          documentId,
          s3Bucket.toString(),
          filePath,
          prettyName,
          () => Promise.resolve(),
          noLimitFileSizePolicy,
          genericLogger
        )
      ).rejects.toThrowError(invalidFileUploadError());
    }
  );

  it.each([
    readFileContentAsBuffer("empty.pdf"),
    getMockedPdfBuffer(),
    getPaddedMockedPdfBuffer(),
  ])("should not throw with a valid PDF file", async (mockFile) => {
    const pdfContent = await mockFile;
    const validPDF = new File([pdfContent], "empty.pdf", {
      type: "application/pdf",
      lastModified: file.lastModified,
    });

    const mockCreateDocumentHandler = vi
      .fn()
      .mockResolvedValue({ id: documentId });

    await expect(
      verifyAndCreateDocument(
        fileManager,
        resource,
        technology.rest,
        "DOCUMENT",
        validPDF,
        documentId,
        s3Bucket.toString(),
        filePath,
        prettyName,
        mockCreateDocumentHandler,
        noLimitFileSizePolicy,
        genericLogger
      )
    ).resolves.toEqual({ id: documentId });
  });

  it("should throw contentTooLargeError if file size is greater than max file size", async () => {
    const maxFileSizeBytes = file.size - 1;

    await expect(
      verifyAndCreateDocument(
        fileManager,
        resource,
        technology.rest,
        kind,
        file,
        documentId,
        s3Bucket.toString(),
        filePath,
        prettyName,
        () => Promise.resolve(),
        { maxFileSizeBytes },
        genericLogger
      )
    ).rejects.toThrowError(
      contentTooLargeError(
        `File size ${file.size} bytes exceeds maximum allowed size of ${maxFileSizeBytes} bytes`
      )
    );
  });
  it("should prioritize interface-specific limit over global limit", async () => {
    const maxFileSizeBytes = file.size;
    const maxInterfaceFileSizeBytes = file.size - 1;

    await expect(
      verifyAndCreateDocument(
        fileManager,
        resource,
        technology.rest,
        kind,
        file,
        documentId,
        s3Bucket.toString(),
        filePath,
        prettyName,
        () => Promise.resolve(),
        {
          maxFileSizeBytes,
          maxInterfaceFileSizeBytes,
        },
        genericLogger
      )
    ).rejects.toThrowError(
      contentTooLargeError(
        `File size ${file.size} bytes exceeds maximum allowed size of ${maxInterfaceFileSizeBytes} bytes`
      )
    );
  });
  it("should not throw when max file size is undefined", async () => {
    const mockCreateDocumentHandler = vi
      .fn()
      .mockResolvedValue({ id: documentId });

    await expect(
      verifyAndCreateDocument(
        fileManager,
        resource,
        technology.rest,
        kind,
        file,
        documentId,
        s3Bucket.toString(),
        filePath,
        prettyName,
        mockCreateDocumentHandler,
        noLimitFileSizePolicy,
        genericLogger
      )
    ).resolves.toEqual({ id: documentId });
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
        resource,
        technology.rest,
        kind,
        file,
        documentId,
        s3Bucket.toString(),
        filePath,
        prettyName,
        mockCreateDocumentHandler,
        noLimitFileSizePolicy,
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
