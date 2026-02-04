import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  generateId,
  PurposeVersionId,
  unsafeBrandId,
} from "pagopa-interop-models";
import {
  getMockedApiPurpose,
  getMockedApiPurposeVersion,
  getMockWithMetadata,
} from "pagopa-interop-commons-test";
import { genericLogger } from "pagopa-interop-commons";
import {
  expectApiClientGetToHaveBeenCalledWith,
  fileManager,
  mockInteropBeClients,
  purposeService,
} from "../../integrationUtils.js";
import { PagoPAInteropBeClients } from "../../../src/clients/clientsProvider.js";
import { getMockM2MAdminAppContext } from "../../mockUtils.js";
import {
  purposeVersionDocumentNotFound,
  purposeVersionNotFound,
} from "../../../src/model/errors.js";
import { config } from "../../../src/config/config.js";
import { expectDownloadedDocumentToBeEqual } from "../../multipartTestUtils.js";

describe("downloadPurposeVersionRiskAnalysisDocument", () => {
  const testFileContent = `This is a mock file content for testing purposes.
It simulates the content of a Purpose version document file.
On multiple lines.`;

  const mockFileName = "riskAnalysis.txt";

  const mockRiskAnalysisId = generateId();
  const mockPurposeVersionDocument = {
    id: mockRiskAnalysisId,
    contentType: "text/plain",
    path: `${config.riskAnalysisDocumentsPath}/${mockRiskAnalysisId}/${mockFileName}`,
    createdAt: new Date().toISOString(),
  };

  const mockApiPurposeVersion = getMockedApiPurposeVersion({
    riskAnalysis: mockPurposeVersionDocument,
  });

  const mockPurposeProcessResponse = getMockWithMetadata(
    getMockedApiPurpose({
      versions: [mockApiPurposeVersion],
    })
  );
  const mockGetPurpose = vi.fn().mockResolvedValue(mockPurposeProcessResponse);

  mockInteropBeClients.purposeProcessClient = {
    getPurpose: mockGetPurpose,
  } as unknown as PagoPAInteropBeClients["purposeProcessClient"];

  beforeEach(() => {
    // Clear mock counters and call information before each test
    mockGetPurpose.mockClear();
  });

  it("Should succeed, perform API clients calls, and retrieve the file", async () => {
    await fileManager.storeBytes(
      {
        bucket: config.riskAnalysisDocumentsContainer,
        path: config.riskAnalysisDocumentsPath,
        resourceId: mockRiskAnalysisId,
        name: mockFileName,
        content: Buffer.from(testFileContent),
      },
      genericLogger
    );

    expect(
      (
        await fileManager.listFiles(
          config.riskAnalysisDocumentsContainer,
          genericLogger
        )
      ).at(0)
    ).toStrictEqual(mockPurposeVersionDocument.path);

    const result =
      await purposeService.downloadPurposeVersionRiskAnalysisDocument(
        unsafeBrandId(mockPurposeProcessResponse.data.id),
        unsafeBrandId(mockApiPurposeVersion.id),
        getMockM2MAdminAppContext()
      );

    const expectedServiceResponse = {
      id: mockRiskAnalysisId,
      file: new File([Buffer.from(testFileContent)], mockFileName, {
        type: mockPurposeVersionDocument.contentType,
      }),
      prettyName: undefined,
    };

    await expectDownloadedDocumentToBeEqual(result, expectedServiceResponse);
    expectApiClientGetToHaveBeenCalledWith({
      mockGet: mockInteropBeClients.purposeProcessClient.getPurpose,
      params: { id: mockPurposeProcessResponse.data.id },
    });
  });

  it("Should throw purposeVersionNotFound in case the returned purpose has no version with the given id", async () => {
    const nonExistingVersionId = generateId<PurposeVersionId>();
    await expect(
      purposeService.downloadPurposeVersionRiskAnalysisDocument(
        unsafeBrandId(mockPurposeProcessResponse.data.id),
        nonExistingVersionId,
        getMockM2MAdminAppContext()
      )
    ).rejects.toThrowError(
      purposeVersionNotFound(
        unsafeBrandId(mockPurposeProcessResponse.data.id),
        nonExistingVersionId
      )
    );
  });

  it("Should throw purposeVersionDocumentNotFound in case the returned purpose version has no risk analysis", async () => {
    mockGetPurpose.mockResolvedValueOnce({
      ...mockPurposeProcessResponse,
      data: {
        ...mockPurposeProcessResponse.data,
        versions: [
          {
            ...mockApiPurposeVersion,
            riskAnalysis: undefined,
          },
        ],
      },
    });
    await expect(
      purposeService.downloadPurposeVersionRiskAnalysisDocument(
        unsafeBrandId(mockPurposeProcessResponse.data.id),
        unsafeBrandId(mockApiPurposeVersion.id),
        getMockM2MAdminAppContext()
      )
    ).rejects.toThrowError(
      purposeVersionDocumentNotFound(
        unsafeBrandId(mockPurposeProcessResponse.data.id),
        unsafeBrandId(mockApiPurposeVersion.id)
      )
    );
  });
});
