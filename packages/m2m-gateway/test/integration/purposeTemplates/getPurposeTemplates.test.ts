import { describe, it, expect, vi, beforeEach } from "vitest";
import { m2mGatewayApi, purposeTemplateApi } from "pagopa-interop-api-clients";
import { getMockedApiPurposeTemplate } from "pagopa-interop-commons-test";
import {
  expectApiClientGetToHaveBeenCalledWith,
  mockInteropBeClients,
  purposeTemplateService,
} from "../../integrationUtils.js";
import { PagoPAInteropBeClients } from "../../../src/clients/clientsProvider.js";
import { getMockM2MAdminAppContext } from "../../mockUtils.js";
import { WithMaybeMetadata } from "../../../src/clients/zodiosWithMetadataPatch.js";
import { toM2MGatewayApiPurposeTemplateTargetTenantKind } from "../../../src/api/purposeTemplateApiConverter.js";

describe("getPurposeTemplates", () => {
  const mockParams: m2mGatewayApi.GetPurposeTemplatesQueryParams = {
    offset: 0,
    limit: 10,
    eserviceIds: [],
    creatorIds: [],
    states: [
      m2mGatewayApi.PurposeTemplateState.Enum.PUBLISHED,
      m2mGatewayApi.PurposeTemplateState.Enum.DRAFT,
    ],
  };

  const mockApiPurposeTemplate1 = getMockedApiPurposeTemplate();
  const mockApiPurposeTemplate2 = getMockedApiPurposeTemplate();

  const mockApiPurposeTemplates = [
    mockApiPurposeTemplate1,
    mockApiPurposeTemplate2,
  ];

  const mockPurposeTemplateProcessResponse: WithMaybeMetadata<purposeTemplateApi.PurposeTemplates> =
    {
      data: {
        results: mockApiPurposeTemplates,
        totalCount: mockApiPurposeTemplates.length,
      },
      metadata: undefined,
    };

  const mockGetPurposeTemplates = vi
    .fn()
    .mockResolvedValue(mockPurposeTemplateProcessResponse);

  mockInteropBeClients.purposeTemplateProcessClient = {
    getPurposeTemplates: mockGetPurposeTemplates,
  } as unknown as PagoPAInteropBeClients["purposeTemplateProcessClient"];

  beforeEach(() => {
    mockGetPurposeTemplates.mockClear();
  });

  it("Should succeed and perform API clients calls", async () => {
    const expectedM2MPurposeTemplate1: m2mGatewayApi.PurposeTemplate = {
      id: mockApiPurposeTemplate1.id,
      createdAt: mockApiPurposeTemplate1.createdAt,
      state: mockApiPurposeTemplate1.state,
      purposeTitle: mockApiPurposeTemplate1.purposeTitle,
      targetDescription: mockApiPurposeTemplate1.targetDescription,
      targetTenantKind: toM2MGatewayApiPurposeTemplateTargetTenantKind(
        mockApiPurposeTemplate1.targetTenantKind
      ),
      purposeDescription: mockApiPurposeTemplate1.purposeDescription,
      purposeIsFreeOfCharge: mockApiPurposeTemplate1.purposeIsFreeOfCharge,
      handlesPersonalData: mockApiPurposeTemplate1.handlesPersonalData,
      creatorId: mockApiPurposeTemplate1.creatorId,
      updatedAt: mockApiPurposeTemplate1.updatedAt,
      purposeFreeOfChargeReason:
        mockApiPurposeTemplate1.purposeFreeOfChargeReason,
      purposeDailyCalls: mockApiPurposeTemplate1.purposeDailyCalls,
    };

    const expectedM2MPurposeTemplate2: m2mGatewayApi.PurposeTemplate = {
      id: mockApiPurposeTemplate2.id,
      createdAt: mockApiPurposeTemplate2.createdAt,
      state: mockApiPurposeTemplate2.state,
      purposeTitle: mockApiPurposeTemplate2.purposeTitle,
      targetDescription: mockApiPurposeTemplate2.targetDescription,
      targetTenantKind: toM2MGatewayApiPurposeTemplateTargetTenantKind(
        mockApiPurposeTemplate2.targetTenantKind
      ),
      purposeDescription: mockApiPurposeTemplate2.purposeDescription,
      purposeIsFreeOfCharge: mockApiPurposeTemplate2.purposeIsFreeOfCharge,
      handlesPersonalData: mockApiPurposeTemplate2.handlesPersonalData,
      creatorId: mockApiPurposeTemplate2.creatorId,
      updatedAt: mockApiPurposeTemplate2.updatedAt,
      purposeFreeOfChargeReason:
        mockApiPurposeTemplate2.purposeFreeOfChargeReason,
      purposeDailyCalls: mockApiPurposeTemplate2.purposeDailyCalls,
    };

    const m2mPurposeTemplatesResponse: m2mGatewayApi.PurposeTemplates = {
      pagination: {
        limit: mockParams.limit,
        offset: mockParams.offset,
        totalCount: mockPurposeTemplateProcessResponse.data.totalCount,
      },
      results: [expectedM2MPurposeTemplate1, expectedM2MPurposeTemplate2],
    };

    const result = await purposeTemplateService.getPurposeTemplates(
      mockParams,
      getMockM2MAdminAppContext()
    );

    expect(result).toEqual(m2mPurposeTemplatesResponse);
    expectApiClientGetToHaveBeenCalledWith({
      mockGet:
        mockInteropBeClients.purposeTemplateProcessClient.getPurposeTemplates,
      queries: {
        offset: mockParams.offset,
        limit: mockParams.limit,
        eserviceIds: mockParams.eserviceIds,
        creatorIds: [],
        states: [
          m2mGatewayApi.PurposeTemplateState.Enum.PUBLISHED,
          m2mGatewayApi.PurposeTemplateState.Enum.DRAFT,
        ],
        excludeExpiredRiskAnalysis: false,
      } satisfies purposeTemplateApi.GetPurposeTemplatesQueryParams,
    });
  });
});
