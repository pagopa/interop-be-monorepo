import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  DescriptorId,
  EServiceId,
  generateId,
  unsafeBrandId,
} from "pagopa-interop-models";
import {
  getMockedApiEserviceDoc,
  getMockWithMetadata,
} from "pagopa-interop-commons-test";
import { genericLogger } from "pagopa-interop-commons";
import {
  eserviceService,
  expectApiClientGetToHaveBeenCalledWith,
  fileManager,
  mockInteropBeClients,
} from "../../integrationUtils.js";
import { PagoPAInteropBeClients } from "../../../src/clients/clientsProvider.js";
import { getMockM2MAdminAppContext } from "../../mockUtils.js";
import { config } from "../../../src/config/config.js";
import { expectDownloadedDocumentToBeEqual } from "../../multipartTestUtils.js";

describe("downloadEServiceDescriptorDocument", () => {
  const testFileContent =
    "This is a mock file content for testing purposes.\nOn multiple lines.";

  const mockDocumentId = generateId();
  const mockDocumentName = "doc.pdf";
  const mockDocument = getMockedApiEserviceDoc({
    id: mockDocumentId,
    name: mockDocumentName,
    path: `${config.eserviceDocumentsPath}/${mockDocumentId}/${mockDocumentName}`,
  });
  const mockCatalogProcessResponse = getMockWithMetadata(mockDocument);
  const mockGetEserviceDocumentById = vi
    .fn()
    .mockResolvedValue(mockCatalogProcessResponse);

  mockInteropBeClients.catalogProcessClient = {
    getEServiceDocumentById: mockGetEserviceDocumentById,
  } as unknown as PagoPAInteropBeClients["catalogProcessClient"];

  beforeEach(() => {
    // Clear mock counters and call information before each test
    mockGetEserviceDocumentById.mockClear();
  });

  it("Should succeed, perform API clients calls, and retrieve the file", async () => {
    await fileManager.storeBytes(
      {
        bucket: config.eserviceDocumentsContainer,
        path: config.eserviceDocumentsPath,
        resourceId: mockDocument.id,
        name: mockDocument.name,
        content: Buffer.from(testFileContent),
      },
      genericLogger
    );

    expect(
      (
        await fileManager.listFiles(
          config.eserviceDocumentsContainer,
          genericLogger
        )
      ).at(0)
    ).toStrictEqual(mockDocument.path);

    const eserviceId = generateId<EServiceId>();
    const descriptorId = generateId<DescriptorId>();
    const result = await eserviceService.downloadEServiceDescriptorDocument(
      eserviceId,
      descriptorId,
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
        mockInteropBeClients.catalogProcessClient.getEServiceDocumentById,
      params: {
        eServiceId: eserviceId,
        descriptorId,
        documentId: mockDocument.id,
      },
    });
  });
});
