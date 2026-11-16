import { AxiosError, InternalAxiosRequestConfig } from "axios";
import { m2mGatewayApiV3 } from "pagopa-interop-api-clients";
import {
  getMockedApiEservice,
  getMockWithMetadata,
} from "pagopa-interop-commons-test";
import {
  pollingMaxRetriesExceeded,
  unsafeBrandId,
} from "pagopa-interop-models";
import { describe, it, expect, vi, beforeEach } from "vitest";

import { PagoPAInteropBeClients } from "../../../src/clients/clientsProvider.js";
import { config } from "../../../src/config/config.js";
import {
  invalidSeedForEServiceTemplateInstance,
  missingMetadata,
} from "../../../src/model/errors.js";
import {
  expectApiClientGetToHaveBeenCalledWith,
  expectApiClientGetToHaveBeenNthCalledWith,
  expectApiClientPostToHaveBeenCalledWith,
  mockInteropBeClients,
  mockPollingResponse,
  eserviceService,
} from "../../integrationUtils.js";
import {
  getMockM2MAdminAppContext,
  testToM2mGatewayApiEService,
} from "../../mockUtils.js";

describe("updateDraftEService", () => {
  const mockEServiceWithTemplate = getMockedApiEservice();
  const mockEService = {
    ...mockEServiceWithTemplate,
    templateId: undefined,
  };
  const mockEServiceProcessGetResponseWithTemplate = getMockWithMetadata(
    mockEServiceWithTemplate
  );
  const mockEServiceProcessGetResponse = getMockWithMetadata(mockEService);

  const mockEServiceSeed: m2mGatewayApiV3.EServiceDraftUpdateSeed = {
    name: "updated name",
    description: "updated description",
    technology: "REST",
    isSignalHubEnabled: true,
    isConsumerDelegable: false,
    isClientAccessDelegable: true,
    mode: "RECEIVE",
  };
  const mockEServiceTemplateInstanceSeed: m2mGatewayApiV3.UpdateEServiceTemplateInstanceSeed =
    {
      isSignalHubEnabled: true,
      isConsumerDelegable: true,
      isClientAccessDelegable: false,
      instanceLabel: "updated",
    };

  const mockPatchUpdateEService = vi
    .fn()
    .mockResolvedValue(mockEServiceProcessGetResponse);
  const mockUpdateEServiceTemplateInstance = vi
    .fn()
    .mockResolvedValue(mockEServiceProcessGetResponseWithTemplate);
  const mockGetEService = vi.fn();

  mockInteropBeClients.catalogProcessClient = {
    getEServiceById: mockGetEService,
    patchUpdateDraftEServiceById: mockPatchUpdateEService,
    updateEServiceTemplateInstanceById: mockUpdateEServiceTemplateInstance,
  } as unknown as PagoPAInteropBeClients["catalogProcessClient"];

  beforeEach(() => {
    mockPatchUpdateEService.mockClear();
    mockUpdateEServiceTemplateInstance.mockClear();
    mockGetEService.mockReset();
  });

  it("Should succeed and perform service calls", async () => {
    mockGetEService
      .mockResolvedValueOnce(mockEServiceProcessGetResponse)
      .mockImplementation(
        mockPollingResponse(mockEServiceProcessGetResponse, 2)
      );

    const result = await eserviceService.updateDraftEService(
      unsafeBrandId(mockEService.id),
      mockEServiceSeed,
      getMockM2MAdminAppContext()
    );

    const expectedM2MEService: m2mGatewayApiV3.EService =
      testToM2mGatewayApiEService(mockEServiceProcessGetResponse.data);

    expect(result).toStrictEqual(expectedM2MEService);
    expectApiClientPostToHaveBeenCalledWith({
      mockPost:
        mockInteropBeClients.catalogProcessClient.patchUpdateDraftEServiceById,
      params: {
        eServiceId: mockEService.id,
      },
      body: mockEServiceSeed,
    });
    expect(
      mockInteropBeClients.catalogProcessClient
        .updateEServiceTemplateInstanceById
    ).toHaveBeenCalledTimes(0);
    expectApiClientGetToHaveBeenCalledWith({
      mockGet: mockInteropBeClients.catalogProcessClient.getEServiceById,
      params: { eServiceId: expectedM2MEService.id },
    });
    expectApiClientGetToHaveBeenNthCalledWith({
      nthCall: 3,
      mockGet: mockInteropBeClients.catalogProcessClient.getEServiceById,
      params: { eServiceId: expectedM2MEService.id },
    });
    expect(
      mockInteropBeClients.catalogProcessClient.getEServiceById
    ).toHaveBeenCalledTimes(3);
  });

  it("Should succeed and perform service calls for eservice created from template", async () => {
    mockGetEService
      .mockResolvedValueOnce(mockEServiceProcessGetResponseWithTemplate)
      .mockImplementation(
        mockPollingResponse(mockEServiceProcessGetResponseWithTemplate, 2)
      );

    const result = await eserviceService.updateDraftEService(
      unsafeBrandId(mockEServiceWithTemplate.id),
      mockEServiceTemplateInstanceSeed,
      getMockM2MAdminAppContext()
    );

    expect(result).toStrictEqual(
      testToM2mGatewayApiEService(
        mockEServiceProcessGetResponseWithTemplate.data
      )
    );
    expectApiClientPostToHaveBeenCalledWith({
      mockPost:
        mockInteropBeClients.catalogProcessClient
          .updateEServiceTemplateInstanceById,
      params: {
        eServiceId: mockEServiceWithTemplate.id,
      },
      body: mockEServiceTemplateInstanceSeed,
    });
    expect(
      mockInteropBeClients.catalogProcessClient.patchUpdateDraftEServiceById
    ).toHaveBeenCalledTimes(0);
    expect(
      mockInteropBeClients.catalogProcessClient.getEServiceById
    ).toHaveBeenCalledTimes(3);
  });

  it("Should throw invalidSeedForEServiceTemplateInstance when the update seed is not for an eservice created from template", async () => {
    mockGetEService.mockResolvedValueOnce(
      mockEServiceProcessGetResponseWithTemplate
    );

    await expect(
      eserviceService.updateDraftEService(
        unsafeBrandId(mockEServiceWithTemplate.id),
        mockEServiceSeed,
        getMockM2MAdminAppContext()
      )
    ).rejects.toThrowError(
      invalidSeedForEServiceTemplateInstance(
        m2mGatewayApiV3.UpdateEServiceTemplateInstanceSeed.safeParse(
          mockEServiceSeed
        ).error!.issues.map((i) => i.message)
      )
    );

    expect(
      mockInteropBeClients.catalogProcessClient.getEServiceById
    ).toHaveBeenCalledTimes(1);
  });

  it.each([
    { name: "Updated metadata name" },
    { description: "Updated metadata description" },
    { name: mockEService.name, description: mockEService.description },
  ])(
    "Should forward metadata-only or no-op seed %# and poll its returned version",
    async (seed) => {
      mockGetEService
        .mockResolvedValueOnce(mockEServiceProcessGetResponse)
        .mockImplementation(
          mockPollingResponse(mockEServiceProcessGetResponse, 1)
        );
      const result = await eserviceService.updateDraftEService(
        unsafeBrandId(mockEService.id),
        seed,
        getMockM2MAdminAppContext()
      );
      expect(result).toEqual(
        testToM2mGatewayApiEService(mockEServiceProcessGetResponse.data)
      );
      expect(mockPatchUpdateEService).toHaveBeenCalledTimes(1);
      expectApiClientPostToHaveBeenCalledWith({
        mockPost: mockPatchUpdateEService,
        params: { eServiceId: mockEService.id },
        body: seed,
      });
      expect(mockGetEService).toHaveBeenCalledTimes(2);
    }
  );

  it("Should propagate a conflict without polling or retrying", async () => {
    mockGetEService.mockResolvedValueOnce(mockEServiceProcessGetResponse);
    const error = new AxiosError(
      "Catalog conflict",
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
    mockPatchUpdateEService.mockRejectedValueOnce(error);
    await expect(
      eserviceService.updateDraftEService(
        unsafeBrandId(mockEService.id),
        mockEServiceSeed,
        getMockM2MAdminAppContext()
      )
    ).rejects.toBe(error);
    expect(mockPatchUpdateEService).toHaveBeenCalledTimes(1);
    expect(mockGetEService).toHaveBeenCalledTimes(1);
  });

  it("Should throw missingMetadata in case the eservice returned by the PATCH call has no metadata", async () => {
    mockGetEService.mockResolvedValueOnce(mockEServiceProcessGetResponse);
    mockPatchUpdateEService.mockResolvedValueOnce({
      ...mockEServiceProcessGetResponse,
      metadata: undefined,
    });

    await expect(
      eserviceService.updateDraftEService(
        unsafeBrandId(mockEService.id),
        mockEServiceSeed,
        getMockM2MAdminAppContext()
      )
    ).rejects.toThrowError(missingMetadata());
  });

  it("Should throw missingMetadata in case the eservice created from template returned by the update call has no metadata", async () => {
    mockGetEService.mockResolvedValueOnce(
      mockEServiceProcessGetResponseWithTemplate
    );
    mockUpdateEServiceTemplateInstance.mockResolvedValueOnce({
      ...mockEServiceProcessGetResponseWithTemplate,
      metadata: undefined,
    });

    await expect(
      eserviceService.updateDraftEService(
        unsafeBrandId(mockEServiceWithTemplate.id),
        mockEServiceTemplateInstanceSeed,
        getMockM2MAdminAppContext()
      )
    ).rejects.toThrowError(missingMetadata());
  });

  it("Should throw missingMetadata in case the eservice returned by the polling GET call has no metadata", async () => {
    mockGetEService
      .mockResolvedValueOnce(mockEServiceProcessGetResponse)
      .mockResolvedValueOnce({
        ...mockEServiceProcessGetResponse,
        metadata: undefined,
      });

    await expect(
      eserviceService.updateDraftEService(
        unsafeBrandId(mockEService.id),
        mockEServiceSeed,
        getMockM2MAdminAppContext()
      )
    ).rejects.toThrowError(missingMetadata());
  });

  it("Should throw pollingMaxRetriesExceeded in case of polling max attempts", async () => {
    mockGetEService
      .mockResolvedValueOnce(mockEServiceProcessGetResponse)
      .mockImplementation(
        mockPollingResponse(
          mockEServiceProcessGetResponse,
          config.defaultPollingMaxRetries + 1
        )
      );

    await expect(
      eserviceService.updateDraftEService(
        unsafeBrandId(mockEService.id),
        mockEServiceSeed,
        getMockM2MAdminAppContext()
      )
    ).rejects.toThrowError(
      pollingMaxRetriesExceeded(
        config.defaultPollingMaxRetries,
        config.defaultPollingRetryDelay
      )
    );
    expect(mockGetEService).toHaveBeenCalledTimes(
      config.defaultPollingMaxRetries + 1
    );
  });
});
