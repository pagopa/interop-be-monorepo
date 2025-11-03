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
import { toM2MGatewayApiPurposeTemplate } from "../../../src/api/purposeTemplateApiConverter.js";

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
    excludeExpiredRiskAnalysis: false,
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
    const m2mPurposeTemplatesResponse: m2mGatewayApi.PurposeTemplates = {
      pagination: {
        limit: mockParams.limit,
        offset: mockParams.offset,
        totalCount: mockPurposeTemplateProcessResponse.data.totalCount,
      },
      results: [
        toM2MGatewayApiPurposeTemplate(mockApiPurposeTemplate1),
        toM2MGatewayApiPurposeTemplate(mockApiPurposeTemplate2),
      ],
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
      } satisfies m2mGatewayApi.GetPurposeTemplatesQueryParams,
    });
  });
});
