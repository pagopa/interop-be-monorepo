import { describe, it, expect, vi, beforeEach } from "vitest";
import { m2mGatewayApi, purposeTemplateApi } from "pagopa-interop-api-clients";
import { pollingMaxRetriesExceeded, WithMetadata } from "pagopa-interop-models";
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

describe("createPurposeTemplate", () => {
  const mockPurposeTemplateProcessGetResponse: WithMetadata<purposeTemplateApi.PurposeTemplate> =
    getMockWithMetadata(getMockedApiPurposeTemplate());

  const mockPurposeTemplateSeed: m2mGatewayApi.PurposeTemplateSeed = {
    targetDescription:
      mockPurposeTemplateProcessGetResponse.data.targetDescription,
    targetTenantKind:
      mockPurposeTemplateProcessGetResponse.data.targetTenantKind,
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

  const mockCreatePurposeTemplate = vi
    .fn()
    .mockResolvedValue(mockPurposeTemplateProcessGetResponse);
  const mockGetPurposeTemplate = vi.fn();

  mockInteropBeClients.purposeTemplateProcessClient = {
    getPurposeTemplate: mockGetPurposeTemplate,
    createPurposeTemplate: mockCreatePurposeTemplate,
  } as unknown as PagoPAInteropBeClients["purposeTemplateProcessClient"];

  beforeEach(() => {
    mockCreatePurposeTemplate.mockClear();
    mockGetPurposeTemplate.mockClear();
  });

  const expectedM2MPurposeTemplate: m2mGatewayApi.PurposeTemplate = {
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

  const mockAppContext = getMockM2MAdminAppContext();

  it("Should succeed and perform service calls", async () => {
    mockGetPurposeTemplate.mockImplementation(
      mockPollingResponse(mockPurposeTemplateProcessGetResponse, 2)
    );

    const result = await purposeTemplateService.createPurposeTemplate(
      mockPurposeTemplateSeed,
      mockAppContext
    );

    expect(result).toEqual(expectedM2MPurposeTemplate);
    expectApiClientPostToHaveBeenCalledWith({
      mockPost:
        mockInteropBeClients.purposeTemplateProcessClient.createPurposeTemplate,
      body: {
        targetDescription: mockPurposeTemplateSeed.targetDescription,
        targetTenantKind: mockPurposeTemplateSeed.targetTenantKind,
        purposeTitle: mockPurposeTemplateSeed.purposeTitle,
        purposeDescription: mockPurposeTemplateSeed.purposeDescription,
        purposeIsFreeOfCharge: mockPurposeTemplateSeed.purposeIsFreeOfCharge,
        purposeFreeOfChargeReason:
          mockPurposeTemplateSeed.purposeFreeOfChargeReason,
        purposeDailyCalls: mockPurposeTemplateSeed.purposeDailyCalls,
        handlesPersonalData: mockPurposeTemplateSeed.handlesPersonalData,
      },
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

  it("Should throw missingMetadata in case the purpose template returned by the creation POST call has no metadata", async () => {
    mockCreatePurposeTemplate.mockResolvedValueOnce({
      ...mockPurposeTemplateProcessGetResponse,
      metadata: undefined,
    });

    await expect(
      purposeTemplateService.createPurposeTemplate(
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
      purposeTemplateService.createPurposeTemplate(
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
      purposeTemplateService.createPurposeTemplate(
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
