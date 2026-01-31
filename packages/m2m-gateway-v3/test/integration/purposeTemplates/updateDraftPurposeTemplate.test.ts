import { describe, it, expect, vi, beforeEach } from "vitest";
import { m2mGatewayApiV3 } from "pagopa-interop-api-clients";
import {
  pollingMaxRetriesExceeded,
  tenantKind,
  unsafeBrandId,
} from "pagopa-interop-models";
import {
  getMockedApiPurposeTemplate,
  getMockWithMetadata,
} from "pagopa-interop-commons-test";
import {
  expectApiClientGetToHaveBeenCalledWith,
  expectApiClientGetToHaveBeenNthCalledWith,
  expectApiClientPostToHaveBeenCalledWith,
  mockInteropBeClients,
  mockPollingResponse,
  purposeTemplateService,
} from "../../integrationUtils.js";
import { PagoPAInteropBeClients } from "../../../src/clients/clientsProvider.js";
import { config } from "../../../src/config/config.js";
import { missingMetadata } from "../../../src/model/errors.js";
import { getMockM2MAdminAppContext } from "../../mockUtils.js";

describe("updateDraftPurposeTemplate", () => {
  const mockPurposeTemplate = getMockedApiPurposeTemplate();
  const mockPurposeTemplateProcessGetResponse =
    getMockWithMetadata(mockPurposeTemplate);

  const mockPurposeTemplateSeed: m2mGatewayApiV3.PurposeTemplateDraftUpdateSeed =
    {
      targetDescription: "updated target description",
      targetTenantKind: tenantKind.PRIVATE,
      purposeTitle: "updated purpose title",
      purposeDescription: "updated purpose description",
      purposeIsFreeOfCharge: false,
      purposeDailyCalls: 10,
      handlesPersonalData: true,
    };

  const mockPatchUpdatePurposeTemplate = vi
    .fn()
    .mockResolvedValue(mockPurposeTemplateProcessGetResponse);
  const mockGetPurposeTemplate = vi.fn(
    mockPollingResponse(mockPurposeTemplateProcessGetResponse, 2)
  );

  mockInteropBeClients.purposeTemplateProcessClient = {
    getPurposeTemplate: mockGetPurposeTemplate,
    patchUpdateDraftPurposeTemplateById: mockPatchUpdatePurposeTemplate,
  } as unknown as PagoPAInteropBeClients["purposeTemplateProcessClient"];

  beforeEach(() => {
    mockPatchUpdatePurposeTemplate.mockClear();
    mockGetPurposeTemplate.mockClear();
  });

  it("Should succeed and perform service calls", async () => {
    const result = await purposeTemplateService.updateDraftPurposeTemplate(
      unsafeBrandId(mockPurposeTemplate.id),
      mockPurposeTemplateSeed,
      getMockM2MAdminAppContext()
    );

    const expectedM2MPurposeTemplate: m2mGatewayApiV3.PurposeTemplate = {
      id: mockPurposeTemplateProcessGetResponse.data.id,
      targetDescription:
        mockPurposeTemplateProcessGetResponse.data.targetDescription,
      targetTenantKind:
        mockPurposeTemplateProcessGetResponse.data.targetTenantKind,
      creatorId: mockPurposeTemplateProcessGetResponse.data.creatorId,
      state: mockPurposeTemplateProcessGetResponse.data.state,
      createdAt: mockPurposeTemplateProcessGetResponse.data.createdAt,
      updatedAt: mockPurposeTemplateProcessGetResponse.data.updatedAt,
      purposeTitle: mockPurposeTemplateProcessGetResponse.data.purposeTitle,
      purposeDescription:
        mockPurposeTemplateProcessGetResponse.data.purposeDescription,
      purposeIsFreeOfCharge:
        mockPurposeTemplateProcessGetResponse.data.purposeIsFreeOfCharge,
      purposeFreeOfChargeReason:
        mockPurposeTemplateProcessGetResponse.data.purposeFreeOfChargeReason,
      purposeDailyCalls:
        mockPurposeTemplateProcessGetResponse.data.purposeDailyCalls,
      handlesPersonalData:
        mockPurposeTemplateProcessGetResponse.data.handlesPersonalData,
    };

    expect(result).toEqual(expectedM2MPurposeTemplate);
    expectApiClientPostToHaveBeenCalledWith({
      mockPost:
        mockInteropBeClients.purposeTemplateProcessClient
          .patchUpdateDraftPurposeTemplateById,
      params: {
        id: mockPurposeTemplate.id,
      },
      body: mockPurposeTemplateSeed,
    });
    expectApiClientGetToHaveBeenCalledWith({
      mockGet:
        mockInteropBeClients.purposeTemplateProcessClient.getPurposeTemplate,
      params: { id: expectedM2MPurposeTemplate.id },
    });
    expectApiClientGetToHaveBeenNthCalledWith({
      nthCall: 2,
      mockGet:
        mockInteropBeClients.purposeTemplateProcessClient.getPurposeTemplate,
      params: { id: expectedM2MPurposeTemplate.id },
    });
    expect(
      mockInteropBeClients.purposeTemplateProcessClient.getPurposeTemplate
    ).toHaveBeenCalledTimes(2);
  });

  it("Should throw missingMetadata in case the purpose template returned by the PATCH call has no metadata", async () => {
    mockPatchUpdatePurposeTemplate.mockResolvedValueOnce({
      ...mockPurposeTemplateProcessGetResponse,
      metadata: undefined,
    });

    await expect(
      purposeTemplateService.updateDraftPurposeTemplate(
        unsafeBrandId(mockPurposeTemplate.id),
        mockPurposeTemplateSeed,
        getMockM2MAdminAppContext()
      )
    ).rejects.toThrowError(missingMetadata());
  });

  it("Should throw missingMetadata in case the purpose template returned by the polling GET call has no metadata", async () => {
    mockGetPurposeTemplate.mockResolvedValueOnce({
      ...mockPurposeTemplateProcessGetResponse,
      metadata: undefined,
    });

    await expect(
      purposeTemplateService.updateDraftPurposeTemplate(
        unsafeBrandId(mockPurposeTemplate.id),
        mockPurposeTemplateSeed,
        getMockM2MAdminAppContext()
      )
    ).rejects.toThrowError(missingMetadata());
  });

  it("Should throw pollingMaxRetriesExceeded in case of polling max attempts", async () => {
    mockGetPurposeTemplate.mockImplementation(
      mockPollingResponse(
        mockPurposeTemplateProcessGetResponse,
        config.defaultPollingMaxRetries + 1
      )
    );

    await expect(
      purposeTemplateService.updateDraftPurposeTemplate(
        unsafeBrandId(mockPurposeTemplate.id),
        mockPurposeTemplateSeed,
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
