import { describe, it, expect, vi, beforeEach } from "vitest";
import { AgreementId, generateId, unsafeBrandId } from "pagopa-interop-models";
import {
  getMockWithMetadata,
  getMockedApiAgreementDocument,
} from "pagopa-interop-commons-test";
import { genericLogger } from "pagopa-interop-commons";
import {
  agreementService,
  expectApiClientGetToHaveBeenCalledWith,
  fileManager,
  mockInteropBeClients,
} from "../../integrationUtils.js";
import { PagoPAInteropBeClients } from "../../../src/clients/clientsProvider.js";
import { getMockM2MAdminAppContext } from "../../mockUtils.js";
import { config } from "../../../src/config/config.js";
import { DownloadedDocument } from "../../../src/utils/fileDownload.js";

describe("getAgreementConsumerDocument", () => {
  const testFileContent =
    "This is a mock file content for testing purposes.\nOn multiple lines.";

  const mockAgreementId = generateId<AgreementId>();
  const mockDocumentId = generateId();
  const mockDocumentName = "consumerDoc.txt";
  const mockDocument = getMockedApiAgreementDocument({
    id: mockDocumentId,
    name: mockDocumentName,
    path: `${config.consumerDocumentsPath}/${mockDocumentId}/${mockDocumentName}`,
  });

  const mockAgreementProcessResponse = getMockWithMetadata(mockDocument);
  const mockGetAgreementConsumerDocument = vi
    .fn()
    .mockResolvedValue(mockAgreementProcessResponse);

  mockInteropBeClients.agreementProcessClient = {
    getAgreementConsumerDocument: mockGetAgreementConsumerDocument,
  } as unknown as PagoPAInteropBeClients["agreementProcessClient"];

  beforeEach(() => {
    // Clear mock counters and call information before each test
    mockGetAgreementConsumerDocument.mockClear();
  });

  it("Should succeed, perform API clients calls, and retrieve the file", async () => {
    await fileManager.storeBytes(
      {
        bucket: config.consumerDocumentsContainer,
        path: config.consumerDocumentsPath,
        resourceId: mockDocument.id,
        name: mockDocument.name,
        content: Buffer.from(testFileContent),
      },
      genericLogger
    );

    expect(
      (
        await fileManager.listFiles(
          config.consumerDocumentsContainer,
          genericLogger
        )
      ).at(0)
    ).toEqual(mockDocument.path);

    const result = await agreementService.getAgreementConsumerDocument(
      mockAgreementId,
      unsafeBrandId(mockDocument.id),
      getMockM2MAdminAppContext()
    );

    const expectedServiceResponse: DownloadedDocument = {
      file: new File([Buffer.from(testFileContent)], mockDocument.name, {
        type: mockDocument.contentType,
      }),
      prettyName: mockDocument.prettyName,
    };
    expect(result).toEqual(expectedServiceResponse);
    expectApiClientGetToHaveBeenCalledWith({
      mockGet:
        mockInteropBeClients.agreementProcessClient
          .getAgreementConsumerDocument,
      params: { agreementId: mockAgreementId, documentId: mockDocument.id },
    });
  });
});
