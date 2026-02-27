import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  EServiceTemplateVersionId,
  EServiceTemplateId,
  generateId,
  unsafeBrandId,
} from "pagopa-interop-models";
import {
  getMockedApiEserviceDoc,
  getMockWithMetadata,
} from "pagopa-interop-commons-test";
import { genericLogger } from "pagopa-interop-commons";
import {
  eserviceTemplateService,
  expectApiClientGetToHaveBeenCalledWith,
  fileManager,
  mockInteropBeClients,
} from "../../integrationUtils.js";
import { PagoPAInteropBeClients } from "../../../src/clients/clientsProvider.js";
import { getMockM2MAdminAppContext } from "../../mockUtils.js";
import { config } from "../../../src/config/config.js";
import { expectDownloadedDocumentToBeEqual } from "../../multipartTestUtils.js";

describe("downloadEServiceTemplateVersionDocument", () => {
  const testFileContent =
    "This is a mock file content for testing purposes.\nOn multiple lines.";

  const mockDocumentId = generateId();
  const mockDocumentName = "doc.pdf";
  const mockDocument = getMockedApiEserviceDoc({
    id: mockDocumentId,
    name: mockDocumentName,
    path: `${config.eserviceTemplateDocumentsPath}/${mockDocumentId}/${mockDocumentName}`,
  });
  const mockEserviceTemplateProcessResponse = getMockWithMetadata(mockDocument);
  const mockGetEserviceTemplateDocumentById = vi
    .fn()
    .mockResolvedValue(mockEserviceTemplateProcessResponse);

  mockInteropBeClients.eserviceTemplateProcessClient = {
    getEServiceTemplateDocumentById: mockGetEserviceTemplateDocumentById,
  } as unknown as PagoPAInteropBeClients["eserviceTemplateProcessClient"];

  beforeEach(() => {
    // Clear mock counters and call information before each test
    mockGetEserviceTemplateDocumentById.mockClear();
  });

  it("Should succeed, perform API clients calls, and retrieve the file", async () => {
    await fileManager.storeBytes(
      {
        bucket: config.eserviceTemplateDocumentsContainer,
        path: config.eserviceTemplateDocumentsPath,
        resourceId: mockDocument.id,
        name: mockDocument.name,
        content: Buffer.from(testFileContent),
      },
      genericLogger
    );

    expect(
      (
        await fileManager.listFiles(
          config.eserviceTemplateDocumentsContainer,
          genericLogger
        )
      ).at(0)
    ).toStrictEqual(mockDocument.path);

    const templateId = generateId<EServiceTemplateId>();
    const versionId = generateId<EServiceTemplateVersionId>();
    const result =
      await eserviceTemplateService.downloadEServiceTemplateVersionDocument(
        templateId,
        versionId,
        unsafeBrandId(mockDocument.id),
        getMockM2MAdminAppContext()
      );

    const expectedServiceResponse = {
      id: mockDocument.id,
      file: new File([Buffer.from(testFileContent)], mockDocument.name, {
        type: mockDocument.contentType,
      }),
      prettyName: mockDocument.prettyName,
    };
    await expectDownloadedDocumentToBeEqual(result, expectedServiceResponse);
    expectApiClientGetToHaveBeenCalledWith({
      mockGet:
        mockInteropBeClients.eserviceTemplateProcessClient
          .getEServiceTemplateDocumentById,
      params: {
        templateId,
        templateVersionId: versionId,
        documentId: mockDocument.id,
      },
    });
  });
});
