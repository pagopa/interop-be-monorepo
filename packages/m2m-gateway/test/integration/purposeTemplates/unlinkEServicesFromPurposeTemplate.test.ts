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

describe("linkEServicesToPurposeTemplate", () => {
  const eserviceId1 = generateId<EServiceId>();
  const eserviceId2 = generateId<EServiceId>();
  const mockPurposeTemplate = getMockedApiPurposeTemplate();
  const mockEserviceIds = [eserviceId1, eserviceId2];

  const mockApiEServiceDescriptorPurposeTemplate1 = {
    ...getMockedApiEServiceDescriptorPurposeTemplate(),
    eserviceId: eserviceId1,
    purposeTemplateId: mockPurposeTemplate.id,
  };
  const mockApiEServiceDescriptorPurposeTemplate2 = {
    ...getMockedApiEServiceDescriptorPurposeTemplate(),
    eserviceId: eserviceId2,
    purposeTemplateId: mockPurposeTemplate.id,
  };

  const mockVersion = 2;
  const mockLinkEServicesToPurposeTemplateResponse = getMockWithMetadata(
    [
      mockApiEServiceDescriptorPurposeTemplate1,
      mockApiEServiceDescriptorPurposeTemplate2,
    ],
    mockVersion
  );

  const mockUnlinkEServicesToPurposeTemplate = vi
    .fn()
    .mockResolvedValue(mockLinkEServicesToPurposeTemplateResponse);

  const mockPollRetries = 2;
  const mockGetPurposeTemplateResponse = getMockWithMetadata(
    mockPurposeTemplate,
    2
  );
  const mockGetPurposeTemplate = vi.fn(
    mockPollingResponse(mockGetPurposeTemplateResponse, mockPollRetries)
  );

  mockInteropBeClients.purposeTemplateProcessClient = {
    unlinkEServicesFromPurposeTemplate: mockUnlinkEServicesToPurposeTemplate,
    getPurposeTemplate: mockGetPurposeTemplate,
  } as unknown as PagoPAInteropBeClients["purposeTemplateProcessClient"];

  beforeEach(() => {
    // Clear mock counters and call information before each test
    mockUnlinkEServicesToPurposeTemplate.mockClear();
    mockGetPurposeTemplate.mockClear();
  });

  it("Should succeed and perform API clients calls", async () => {
    await purposeTemplateService.unlinkEServicesFromPurposeTemplate(
      unsafeBrandId(mockPurposeTemplate.id),
      mockEserviceIds,
      getMockM2MAdminAppContext()
    );

    expectApiClientPostToHaveBeenCalledWith({
      mockPost:
        mockInteropBeClients.purposeTemplateProcessClient
          .unlinkEServicesFromPurposeTemplate,
      params: {
        id: mockPurposeTemplate.id,
      },
      body: {
        eserviceIds: mockEserviceIds,
      },
    });
    expect(mockUnlinkEServicesToPurposeTemplate).toHaveBeenCalledOnce();

    expectApiClientGetToHaveBeenCalledWith({
      mockGet:
        mockInteropBeClients.purposeTemplateProcessClient.getPurposeTemplate,
      params: { id: mockPurposeTemplate.id },
    });
    expect(mockGetPurposeTemplate).toHaveBeenCalledTimes(mockPollRetries);
  });

  it("Should throw missingMetadata in case the eservice returned by the polling GET call has no metadata", async () => {
    mockGetPurposeTemplate.mockResolvedValueOnce({
      ...mockGetPurposeTemplateResponse,
      metadata: undefined,
    });

    await expect(
      purposeTemplateService.unlinkEServicesFromPurposeTemplate(
        unsafeBrandId(mockPurposeTemplate.id),
        mockEserviceIds,
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
      purposeTemplateService.unlinkEServicesFromPurposeTemplate(
        unsafeBrandId(mockPurposeTemplate.id),
        mockEserviceIds,
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
