import { AxiosError, InternalAxiosRequestConfig } from "axios";
import { m2mGatewayApiV3 } from "pagopa-interop-api-clients";
import {
  getMockedApiEServiceTemplate,
  getMockWithMetadata,
} from "pagopa-interop-commons-test";
import {
  pollingMaxRetriesExceeded,
  unsafeBrandId,
} from "pagopa-interop-models";
import { describe, it, expect, vi, beforeEach } from "vitest";

import { PagoPAInteropBeClients } from "../../../src/clients/clientsProvider.js";
import { config } from "../../../src/config/config.js";
import { missingMetadata } from "../../../src/model/errors.js";
import {
  expectApiClientGetToHaveBeenCalledWith,
  expectApiClientGetToHaveBeenNthCalledWith,
  expectApiClientPostToHaveBeenCalledWith,
  mockInteropBeClients,
  mockPollingResponse,
  eserviceTemplateService,
} from "../../integrationUtils.js";
import { getMockM2MAdminAppContext } from "../../mockUtils.js";

describe("updateDraftEServiceTemplate", () => {
  const mockEServiceTemplate = getMockedApiEServiceTemplate();
  const mockEServiceTemplateProcessGetResponse =
    getMockWithMetadata(mockEServiceTemplate);

  const mockEServiceTemplateSeed: m2mGatewayApiV3.EServiceTemplateDraftUpdateSeed =
    {
      name: "updated name",
      description: "updated description",
      technology: "REST",
      isSignalHubEnabled: true,
      mode: "RECEIVE",
      intendedTarget: "intendedTarget",
    };

  const mockPatchUpdateEServiceTemplate = vi
    .fn()
    .mockResolvedValue(mockEServiceTemplateProcessGetResponse);
  const mockGetEServiceTemplate = vi.fn(
    mockPollingResponse(mockEServiceTemplateProcessGetResponse, 2)
  );

  mockInteropBeClients.eserviceTemplateProcessClient = {
    getEServiceTemplateById: mockGetEServiceTemplate,
    patchUpdateDraftEServiceTemplate: mockPatchUpdateEServiceTemplate,
  } as unknown as PagoPAInteropBeClients["eserviceTemplateProcessClient"];

  beforeEach(() => {
    mockPatchUpdateEServiceTemplate.mockClear();
    mockGetEServiceTemplate.mockClear();
  });

  it("Should succeed and perform service calls", async () => {
    const result = await eserviceTemplateService.updateDraftEServiceTemplate(
      unsafeBrandId(mockEServiceTemplate.id),
      mockEServiceTemplateSeed,
      getMockM2MAdminAppContext()
    );

    const expectedM2MEServiceTemplate: m2mGatewayApiV3.EServiceTemplate = {
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

    expect(result).toStrictEqual(expectedM2MEServiceTemplate);
    expectApiClientPostToHaveBeenCalledWith({
      mockPost:
        mockInteropBeClients.eserviceTemplateProcessClient
          .patchUpdateDraftEServiceTemplate,
      params: {
        templateId: mockEServiceTemplate.id,
      },
      body: mockEServiceTemplateSeed,
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

  it.each([
    { name: "a".repeat(45) },
    { description: "updated description" },
    { intendedTarget: "updated intended target" },
    {
      name: mockEServiceTemplate.name,
      description: mockEServiceTemplate.description,
      intendedTarget: mockEServiceTemplate.intendedTarget,
    },
  ])(
    "Should forward metadata seed %# and poll its returned version",
    async (seed) => {
      mockGetEServiceTemplate.mockImplementation(
        mockPollingResponse(mockEServiceTemplateProcessGetResponse, 1)
      );
      await eserviceTemplateService.updateDraftEServiceTemplate(
        unsafeBrandId(mockEServiceTemplate.id),
        seed,
        getMockM2MAdminAppContext()
      );
      expect(mockPatchUpdateEServiceTemplate).toHaveBeenCalledTimes(1);
      expectApiClientPostToHaveBeenCalledWith({
        mockPost: mockPatchUpdateEServiceTemplate,
        params: { templateId: mockEServiceTemplate.id },
        body: seed,
      });
      expect(mockGetEServiceTemplate).toHaveBeenCalledTimes(1);
    }
  );

  it("Should propagate a conflict without polling or retrying", async () => {
    const error = new AxiosError(
      "Template conflict",
      undefined,
      undefined,
      undefined,
      {
        status: 409,
        statusText: "Conflict",
        data: {},
        config: {} as InternalAxiosRequestConfig,
        headers: {},
      }
    );
    mockPatchUpdateEServiceTemplate.mockRejectedValueOnce(error);
    await expect(
      eserviceTemplateService.updateDraftEServiceTemplate(
        unsafeBrandId(mockEServiceTemplate.id),
        mockEServiceTemplateSeed,
        getMockM2MAdminAppContext()
      )
    ).rejects.toBe(error);
    expect(mockPatchUpdateEServiceTemplate).toHaveBeenCalledTimes(1);
    expect(mockGetEServiceTemplate).not.toHaveBeenCalled();
  });

  it("Should throw missingMetadata in case the eservice returned by the PATCH call has no metadata", async () => {
    mockPatchUpdateEServiceTemplate.mockResolvedValueOnce({
      ...mockEServiceTemplateProcessGetResponse,
      metadata: undefined,
    });

    await expect(
      eserviceTemplateService.updateDraftEServiceTemplate(
        unsafeBrandId(mockEServiceTemplate.id),
        mockEServiceTemplateSeed,
        getMockM2MAdminAppContext()
      )
    ).rejects.toThrowError(missingMetadata());
  });

  it("Should throw missingMetadata in case the eservice returned by the polling GET call has no metadata", async () => {
    mockGetEServiceTemplate.mockResolvedValueOnce({
      ...mockEServiceTemplateProcessGetResponse,
      metadata: undefined,
    });

    await expect(
      eserviceTemplateService.updateDraftEServiceTemplate(
        unsafeBrandId(mockEServiceTemplate.id),
        mockEServiceTemplateSeed,
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
      eserviceTemplateService.updateDraftEServiceTemplate(
        unsafeBrandId(mockEServiceTemplate.id),
        mockEServiceTemplateSeed,
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
