import { describe, it, expect, vi, beforeEach } from "vitest";
import { m2mGatewayApi } from "pagopa-interop-api-clients";
import {
  pollingMaxRetriesExceeded,
  unsafeBrandId,
} from "pagopa-interop-models";
import {
  getMockedApiEServiceTemplate,
  getMockWithMetadata,
} from "pagopa-interop-commons-test";
import {
  expectApiClientGetToHaveBeenCalledWith,
  expectApiClientGetToHaveBeenNthCalledWith,
  expectApiClientPostToHaveBeenCalledWith,
  mockInteropBeClients,
  mockPollingResponse,
  eserviceTemplateService,
} from "../../integrationUtils.js";
import { PagoPAInteropBeClients } from "../../../src/clients/clientsProvider.js";
import { config } from "../../../src/config/config.js";
import { missingMetadata } from "../../../src/model/errors.js";
import { getMockM2MAdminAppContext } from "../../mockUtils.js";

describe("updatePublishedEServiceTemplateName", () => {
  const mockEServiceTemplate = getMockedApiEServiceTemplate();
  const mockEServiceTemplateProcessGetResponse =
    getMockWithMetadata(mockEServiceTemplate);

  const mockSeed: m2mGatewayApi.EServiceTemplateNameUpdateSeed = {
    name: "updated name",
  };

  const mockUpdateEServiceTemplateName = vi
    .fn()
    .mockResolvedValue(mockEServiceTemplateProcessGetResponse);
  const mockGetEServiceTemplate = vi.fn(
    mockPollingResponse(mockEServiceTemplateProcessGetResponse, 2)
  );

  mockInteropBeClients.eserviceTemplateProcessClient = {
    getEServiceTemplateById: mockGetEServiceTemplate,
    updateEServiceTemplateName: mockUpdateEServiceTemplateName,
  } as unknown as PagoPAInteropBeClients["eserviceTemplateProcessClient"];

  beforeEach(() => {
    mockUpdateEServiceTemplateName.mockClear();
    mockGetEServiceTemplate.mockClear();
  });

  it("Should succeed and perform service calls", async () => {
    const result =
      await eserviceTemplateService.updatePublishedEServiceTemplateName(
        unsafeBrandId(mockEServiceTemplate.id),
        mockSeed,
        getMockM2MAdminAppContext()
      );

    const expectedM2MEServiceTemplate: m2mGatewayApi.EServiceTemplate = {
      id: mockEServiceTemplateProcessGetResponse.data.id,
      name: mockEServiceTemplateProcessGetResponse.data.name,
      description: mockEServiceTemplateProcessGetResponse.data.description,
      technology: mockEServiceTemplateProcessGetResponse.data.technology,
      mode: mockEServiceTemplateProcessGetResponse.data.mode,
      isSignalHubEnabled:
        mockEServiceTemplateProcessGetResponse.data.isSignalHubEnabled,
      intendedTarget:
        mockEServiceTemplateProcessGetResponse.data.intendedTarget,
      creatorId: mockEServiceTemplateProcessGetResponse.data.creatorId,
      personalData: mockEServiceTemplateProcessGetResponse.data.personalData,
    };

    expect(result).toEqual(expectedM2MEServiceTemplate);
    expectApiClientPostToHaveBeenCalledWith({
      mockPost:
        mockInteropBeClients.eserviceTemplateProcessClient
          .updateEServiceTemplateName,
      params: {
        templateId: mockEServiceTemplate.id,
      },
      body: mockSeed,
    });
    expectApiClientGetToHaveBeenCalledWith({
      mockGet:
        mockInteropBeClients.eserviceTemplateProcessClient
          .getEServiceTemplateById,
      params: { templateId: expectedM2MEServiceTemplate.id },
    });
    expectApiClientGetToHaveBeenNthCalledWith({
      nthCall: 2,
      mockGet:
        mockInteropBeClients.eserviceTemplateProcessClient
          .getEServiceTemplateById,
      params: { templateId: expectedM2MEServiceTemplate.id },
    });
    expect(
      mockInteropBeClients.eserviceTemplateProcessClient.getEServiceTemplateById
    ).toHaveBeenCalledTimes(2);
  });

  it("Should throw missingMetadata in case the eservice returned by the PATCH call has no metadata", async () => {
    mockUpdateEServiceTemplateName.mockResolvedValueOnce({
      ...mockEServiceTemplateProcessGetResponse,
      metadata: undefined,
    });

    await expect(
      eserviceTemplateService.updatePublishedEServiceTemplateName(
        unsafeBrandId(mockEServiceTemplate.id),
        mockSeed,
        getMockM2MAdminAppContext()
      )
    ).rejects.toThrowError(missingMetadata());
  });

  it("Should throw missingMetadata in case the eservice template returned by the polling GET call has no metadata", async () => {
    mockGetEServiceTemplate.mockResolvedValueOnce({
      ...mockEServiceTemplateProcessGetResponse,
      metadata: undefined,
    });

    await expect(
      eserviceTemplateService.updatePublishedEServiceTemplateName(
        unsafeBrandId(mockEServiceTemplate.id),
        mockSeed,
        getMockM2MAdminAppContext()
      )
    ).rejects.toThrowError(missingMetadata());
  });

  it("Should throw pollingMaxRetriesExceeded in case of polling max attempts", async () => {
    mockGetEServiceTemplate.mockImplementation(
      mockPollingResponse(
        mockEServiceTemplateProcessGetResponse,
        config.defaultPollingMaxRetries + 1
      )
    );

    await expect(
      eserviceTemplateService.updatePublishedEServiceTemplateName(
        unsafeBrandId(mockEServiceTemplate.id),
        mockSeed,
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
