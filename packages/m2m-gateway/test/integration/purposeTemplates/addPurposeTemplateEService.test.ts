import { purposeTemplateApi } from "pagopa-interop-api-clients";
import {
  getMockedApiEServiceDescriptorPurposeTemplate,
  getMockedApiPurposeTemplate,
  getMockWithMetadata,
} from "pagopa-interop-commons-test";
import {
  EServiceId,
  generateId,
  pollingMaxRetriesExceeded,
  unsafeBrandId,
} from "pagopa-interop-models";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PagoPAInteropBeClients } from "../../../src/clients/clientsProvider.js";
import { config } from "../../../src/config/config.js";
import { missingMetadata } from "../../../src/model/errors.js";
import {
  expectApiClientGetToHaveBeenCalledWith,
  expectApiClientPostToHaveBeenCalledWith,
  mockInteropBeClients,
  mockPollingResponse,
  purposeTemplateService,
} from "../../integrationUtils.js";
import { getMockM2MAdminAppContext } from "../../mockUtils.js";

describe("addPurposeTemplateEService", () => {
  const eserviceId1 = generateId<EServiceId>();
  const eserviceId2 = generateId<EServiceId>();
  const mockPurposeTemplate = getMockedApiPurposeTemplate();
  const mockEserviceIdsBody = {
    eserviceIds: [eserviceId1, eserviceId2],
  };

  const mockApiPurposeTemplateEServiceDescriptor1: purposeTemplateApi.EServiceDescriptorPurposeTemplate =
    {
      ...getMockedApiEServiceDescriptorPurposeTemplate(),
      eserviceId: eserviceId1,
      purposeTemplateId: mockPurposeTemplate.id,
    };
  const mockApiPurposeTemplateEServiceDescriptor2: purposeTemplateApi.EServiceDescriptorPurposeTemplate =
    {
      ...getMockedApiEServiceDescriptorPurposeTemplate(),
      eserviceId: eserviceId2,
      purposeTemplateId: mockPurposeTemplate.id,
    };

  const mockVersion = 2;
  const mockLinkEServicesToPurposeTemplateResponse = getMockWithMetadata(
    [
      mockApiPurposeTemplateEServiceDescriptor1,
      mockApiPurposeTemplateEServiceDescriptor2,
    ],
    mockVersion
  );

  const mockLinkEServicesToPurposeTemplate = vi
    .fn()
    .mockResolvedValue(mockLinkEServicesToPurposeTemplateResponse);

  const mockPollRetries = 2;
  const mockGetPurposeTemplateResponse = getMockWithMetadata(
    mockPurposeTemplate,
    mockVersion
  );
  const mockGetPurposeTemplate = vi.fn(
    mockPollingResponse(mockGetPurposeTemplateResponse, mockPollRetries)
  );

  mockInteropBeClients.purposeTemplateProcessClient = {
    linkEServicesToPurposeTemplate: mockLinkEServicesToPurposeTemplate,
    getPurposeTemplate: mockGetPurposeTemplate,
  } as unknown as PagoPAInteropBeClients["purposeTemplateProcessClient"];

  beforeEach(() => {
    // Clear mock counters and call information before each test
    mockLinkEServicesToPurposeTemplate.mockClear();
    mockGetPurposeTemplate.mockClear();
  });

  it("Should succeed and perform API clients calls", async () => {
    await purposeTemplateService.addPurposeTemplateEService(
      unsafeBrandId(mockPurposeTemplate.id),
      mockEserviceIdsBody,
      getMockM2MAdminAppContext()
    );

    expectApiClientPostToHaveBeenCalledWith({
      mockPost:
        mockInteropBeClients.purposeTemplateProcessClient
          .linkEServicesToPurposeTemplate,
      params: {
        id: mockPurposeTemplate.id,
      },
      body: mockEserviceIdsBody,
    });
    expect(mockLinkEServicesToPurposeTemplate).toHaveBeenCalledOnce();

    expectApiClientGetToHaveBeenCalledWith({
      mockGet:
        mockInteropBeClients.purposeTemplateProcessClient.getPurposeTemplate,
      params: { id: mockPurposeTemplate.id },
    });
    expect(mockGetPurposeTemplate).toHaveBeenCalledTimes(mockPollRetries);
  });

  it("Should throw missingMetadata in case the data returned by the POST call has no metadata", async () => {
    mockLinkEServicesToPurposeTemplate.mockResolvedValueOnce({
      ...mockLinkEServicesToPurposeTemplateResponse,
      metadata: undefined,
    });

    await expect(
      purposeTemplateService.addPurposeTemplateEService(
        unsafeBrandId(mockPurposeTemplate.id),
        mockEserviceIdsBody,
        getMockM2MAdminAppContext()
      )
    ).rejects.toThrowError(missingMetadata());
  });

  it("Should throw missingMetadata in case the eservice returned by the polling GET call has no metadata", async () => {
    mockGetPurposeTemplate.mockResolvedValueOnce({
      ...mockGetPurposeTemplateResponse,
      metadata: undefined,
    });

    await expect(
      purposeTemplateService.addPurposeTemplateEService(
        unsafeBrandId(mockPurposeTemplate.id),
        mockEserviceIdsBody,
        getMockM2MAdminAppContext()
      )
    ).rejects.toThrowError(missingMetadata());
  });

  it("Should throw pollingMaxRetriesExceeded in case of polling max attempts", async () => {
    mockGetPurposeTemplate.mockImplementation(
      mockPollingResponse(
        mockGetPurposeTemplateResponse,
        config.defaultPollingMaxRetries + 1
      )
    );

    await expect(
      purposeTemplateService.addPurposeTemplateEService(
        unsafeBrandId(mockPurposeTemplate.id),
        mockEserviceIdsBody,
        getMockM2MAdminAppContext()
      )
    ).rejects.toThrowError(
      pollingMaxRetriesExceeded(
        config.defaultPollingMaxRetries,
        config.defaultPollingRetryDelay
      )
    );
    expect(mockGetPurposeTemplate).toHaveBeenCalledTimes(
      config.defaultPollingMaxRetries
    );
  });
});
