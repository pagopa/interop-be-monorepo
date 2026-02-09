import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  pollingMaxRetriesExceeded,
  unsafeBrandId,
} from "pagopa-interop-models";
import {
  getMockedApiPurposeTemplate,
  getMockWithMetadata,
} from "pagopa-interop-commons-test";
import { m2mGatewayApi } from "pagopa-interop-api-clients";
import {
  expectApiClientGetToHaveBeenCalledWith,
  expectApiClientPostToHaveBeenCalledWith,
  mockInteropBeClients,
  mockPollingResponse,
  purposeTemplateService,
} from "../../integrationUtils.js";
import { PagoPAInteropBeClients } from "../../../src/clients/clientsProvider.js";
import { config } from "../../../src/config/config.js";
import { missingMetadata } from "../../../src/model/errors.js";
import { getMockM2MAdminAppContext } from "../../mockUtils.js";

describe("archivePurposeTemplate", () => {
  const mockApiPurposeTemplate = getMockWithMetadata(
    getMockedApiPurposeTemplate(
      m2mGatewayApi.PurposeTemplateState.Enum.ARCHIVED
    )
  );

  const mockArchivePurposeTemplate = vi
    .fn()
    .mockResolvedValue(mockApiPurposeTemplate);
  const mockGetPurposeTemplate = vi.fn(
    mockPollingResponse(mockApiPurposeTemplate, 2)
  );

  mockInteropBeClients.purposeTemplateProcessClient = {
    getPurposeTemplate: mockGetPurposeTemplate,
    archivePurposeTemplate: mockArchivePurposeTemplate,
  } as unknown as PagoPAInteropBeClients["purposeTemplateProcessClient"];

  beforeEach(() => {
    mockArchivePurposeTemplate.mockClear();
    mockGetPurposeTemplate.mockClear();
  });

  it("Should succeed and perform API clients calls", async () => {
    const expectedM2MPurposeTemplate: m2mGatewayApi.PurposeTemplate = {
      id: mockApiPurposeTemplate.data.id,
      createdAt: mockApiPurposeTemplate.data.createdAt,
      state: mockApiPurposeTemplate.data.state,
      purposeTitle: mockApiPurposeTemplate.data.purposeTitle,
      targetDescription: mockApiPurposeTemplate.data.targetDescription,
      targetTenantKind: mockApiPurposeTemplate.data.targetTenantKind,
      purposeDescription: mockApiPurposeTemplate.data.purposeDescription,
      purposeIsFreeOfCharge: mockApiPurposeTemplate.data.purposeIsFreeOfCharge,
      handlesPersonalData: mockApiPurposeTemplate.data.handlesPersonalData,
      creatorId: mockApiPurposeTemplate.data.creatorId,
      updatedAt: mockApiPurposeTemplate.data.updatedAt,
      purposeFreeOfChargeReason:
        mockApiPurposeTemplate.data.purposeFreeOfChargeReason,
      purposeDailyCalls: mockApiPurposeTemplate.data.purposeDailyCalls,
    };

    const result = await purposeTemplateService.archivePurposeTemplate(
      unsafeBrandId(expectedM2MPurposeTemplate.id),
      getMockM2MAdminAppContext()
    );

    expect(result).toStrictEqual(expectedM2MPurposeTemplate);
    expectApiClientPostToHaveBeenCalledWith({
      mockPost:
        mockInteropBeClients.purposeTemplateProcessClient
          .archivePurposeTemplate,
      params: {
        id: expectedM2MPurposeTemplate.id,
      },
    });
    expectApiClientGetToHaveBeenCalledWith({
      mockGet:
        mockInteropBeClients.purposeTemplateProcessClient.getPurposeTemplate,
      params: { id: expectedM2MPurposeTemplate.id },
    });
    expect(
      mockInteropBeClients.purposeTemplateProcessClient.getPurposeTemplate
    ).toHaveBeenCalledTimes(2);
  });

  it("Should throw missingMetadata in case the purpose template returned by the archive call has no metadata", async () => {
    mockArchivePurposeTemplate.mockResolvedValueOnce({
      metadata: undefined,
    });

    await expect(
      purposeTemplateService.archivePurposeTemplate(
        unsafeBrandId(mockApiPurposeTemplate.data.id),
        getMockM2MAdminAppContext()
      )
    ).rejects.toThrowError(missingMetadata());
  });

  it("Should throw missingMetadata in case the purpose template returned by the polling GET call has no metadata", async () => {
    mockGetPurposeTemplate.mockResolvedValueOnce({
      data: mockApiPurposeTemplate.data,
      metadata: undefined,
    });

    await expect(
      purposeTemplateService.archivePurposeTemplate(
        unsafeBrandId(mockApiPurposeTemplate.data.id),
        getMockM2MAdminAppContext()
      )
    ).rejects.toThrowError(missingMetadata());
  });

  it("Should throw pollingMaxRetriesExceeded in case of polling max attempts", async () => {
    mockGetPurposeTemplate.mockImplementation(
      mockPollingResponse(
        mockApiPurposeTemplate,
        config.defaultPollingMaxRetries + 1
      )
    );

    await expect(
      purposeTemplateService.archivePurposeTemplate(
        unsafeBrandId(mockApiPurposeTemplate.data.id),
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
