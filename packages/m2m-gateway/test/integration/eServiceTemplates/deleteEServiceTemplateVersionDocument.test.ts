import { describe, it, vi, beforeEach, expect } from "vitest";
import {
  pollingMaxRetriesExceeded,
  unsafeBrandId,
} from "pagopa-interop-models";
import {
  getMockWithMetadata,
  getMockedApiEserviceTemplateVersion,
  getMockedApiEserviceDoc,
  getMockedApiEServiceTemplate,
} from "pagopa-interop-commons-test";
import {
  eserviceTemplateService,
  expectApiClientPostToHaveBeenCalledWith,
  expectApiClientGetToHaveBeenCalledWith,
  mockInteropBeClients,
  mockPollingResponse,
} from "../../integrationUtils.js";
import { PagoPAInteropBeClients } from "../../../src/clients/clientsProvider.js";
import { getMockM2MAdminAppContext } from "../../mockUtils.js";
import { missingMetadata } from "../../../src/model/errors.js";
import { config } from "../../../src/config/config.js";

describe("deleteEServiceTemplateVersionDocument", () => {
  const mockDocument = getMockedApiEserviceDoc();
  const mockVersion = { ...getMockedApiEserviceTemplateVersion(), docs: [] };
  const mockEServiceTemplate = getMockedApiEServiceTemplate({
    versions: [mockVersion],
  });

  const mockGetEServiceTemplateResponse =
    getMockWithMetadata(mockEServiceTemplate);

  const mockDeleteEServiceTemplateDocumentById = vi
    .fn()
    .mockResolvedValue(mockGetEServiceTemplateResponse);
  const mockGetEServiceTemplate = vi.fn(
    mockPollingResponse(mockGetEServiceTemplateResponse, 2)
  );

  mockInteropBeClients.eserviceTemplateProcessClient = {
    deleteEServiceTemplateDocumentById: mockDeleteEServiceTemplateDocumentById,
    getEServiceTemplateById: mockGetEServiceTemplate,
  } as unknown as PagoPAInteropBeClients["eserviceTemplateProcessClient"];

  beforeEach(() => {
    mockDeleteEServiceTemplateDocumentById.mockClear();
    mockGetEServiceTemplate.mockClear();
  });

  it("Should succeed and perform API clients calls", async () => {
    mockGetEServiceTemplate.mockResolvedValueOnce(
      mockGetEServiceTemplateResponse
    );

    await eserviceTemplateService.deleteEServiceTemplateVersionDocument(
      unsafeBrandId(mockEServiceTemplate.id),
      unsafeBrandId(mockVersion.id),
      unsafeBrandId(mockDocument.id),
      getMockM2MAdminAppContext()
    );

    expectApiClientPostToHaveBeenCalledWith({
      mockPost:
        mockInteropBeClients.eserviceTemplateProcessClient
          .deleteEServiceTemplateDocumentById,
      params: {
        templateId: mockEServiceTemplate.id,
        templateVersionId: mockVersion.id,
        documentId: mockDocument.id,
      },
    });
    expectApiClientGetToHaveBeenCalledWith({
      mockGet:
        mockInteropBeClients.eserviceTemplateProcessClient
          .getEServiceTemplateById,
      params: { templateId: mockEServiceTemplate.id },
    });
  });

  it("Should throw missingMetadata in case the eservice returned by the document DELETE call has no metadata", async () => {
    mockDeleteEServiceTemplateDocumentById.mockResolvedValueOnce({
      ...mockGetEServiceTemplateResponse,
      metadata: undefined,
    });

    await expect(
      eserviceTemplateService.deleteEServiceTemplateVersionDocument(
        unsafeBrandId(mockGetEServiceTemplateResponse.data.id),
        unsafeBrandId(mockGetEServiceTemplateResponse.data.versions[0].id),
        unsafeBrandId(mockDocument.id),
        getMockM2MAdminAppContext()
      )
    ).rejects.toThrowError(missingMetadata());
  });

  it("Should throw missingMetadata in case the eservice returned by the polling GET call has no metadata", async () => {
    mockGetEServiceTemplate.mockResolvedValueOnce({
      ...mockGetEServiceTemplateResponse,
      metadata: undefined,
    });

    await expect(
      eserviceTemplateService.deleteEServiceTemplateVersionDocument(
        unsafeBrandId(mockGetEServiceTemplateResponse.data.id),
        unsafeBrandId(mockGetEServiceTemplateResponse.data.versions[0].id),
        unsafeBrandId(mockDocument.id),
        getMockM2MAdminAppContext()
      )
    ).rejects.toThrowError(missingMetadata());
  });

  it("Should throw pollingMaxRetriesExceeded in case of polling max attempts", async () => {
    mockGetEServiceTemplate.mockImplementation(
      mockPollingResponse(
        mockGetEServiceTemplateResponse,
        config.defaultPollingMaxRetries + 1
      )
    );

    await expect(
      eserviceTemplateService.deleteEServiceTemplateVersionDocument(
        unsafeBrandId(mockGetEServiceTemplateResponse.data.id),
        unsafeBrandId(mockGetEServiceTemplateResponse.data.versions[0].id),
        unsafeBrandId(mockDocument.id),
        getMockM2MAdminAppContext()
      )
    ).rejects.toThrowError(
      pollingMaxRetriesExceeded(
        config.defaultPollingMaxRetries,
        config.defaultPollingRetryDelay
      )
    );
    expect(mockGetEServiceTemplate).toHaveBeenCalledTimes(
      config.defaultPollingMaxRetries
    );
  });
});
