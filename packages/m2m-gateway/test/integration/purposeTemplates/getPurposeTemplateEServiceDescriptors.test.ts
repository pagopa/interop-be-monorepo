import { describe, it, expect, vi, beforeEach } from "vitest";
import { m2mGatewayApi, purposeTemplateApi } from "pagopa-interop-api-clients";
import { getMockedApiEServiceDescriptorPurposeTemplate } from "pagopa-interop-commons-test";
import { generateId, PurposeTemplateId } from "pagopa-interop-models";
import {
  expectApiClientGetToHaveBeenCalledWith,
  mockInteropBeClients,
  purposeTemplateService,
} from "../../integrationUtils.js";
import { PagoPAInteropBeClients } from "../../../src/clients/clientsProvider.js";
import { getMockM2MAdminAppContext } from "../../mockUtils.js";
import { WithMaybeMetadata } from "../../../src/clients/zodiosWithMetadataPatch.js";

describe("getPurposeTemplateEServiceDescriptors", () => {
  const mockParams: m2mGatewayApi.GetPurposeTemplateEServiceDescriptorsQueryParams =
    {
      offset: 0,
      limit: 10,
      producerIds: [],
    };

  const mockApiPurposeTemplateEServiceDescriptor1 =
    getMockedApiEServiceDescriptorPurposeTemplate();
  const mockApiPurposeTemplateEServiceDescriptor2 =
    getMockedApiEServiceDescriptorPurposeTemplate();

  const mockApiPurposeTemplateEServiceDescriptors = [
    mockApiPurposeTemplateEServiceDescriptor1,
    mockApiPurposeTemplateEServiceDescriptor2,
  ];

  const mockPurposeTemplateEServiceDescriptorsProcessResponse: WithMaybeMetadata<purposeTemplateApi.EServiceDescriptorsPurposeTemplate> =
    {
      data: {
        results: mockApiPurposeTemplateEServiceDescriptors,
        totalCount: mockApiPurposeTemplateEServiceDescriptors.length,
      },
      metadata: undefined,
    };

  const mockGetPurposeTemplateEServiceDescriptors = vi
    .fn()
    .mockResolvedValue(mockPurposeTemplateEServiceDescriptorsProcessResponse);

  mockInteropBeClients.purposeTemplateProcessClient = {
    getPurposeTemplateEServices: mockGetPurposeTemplateEServiceDescriptors,
  } as unknown as PagoPAInteropBeClients["purposeTemplateProcessClient"];

  beforeEach(() => {
    mockGetPurposeTemplateEServiceDescriptors.mockClear();
  });

  it("Should succeed and perform API clients calls", async () => {
    const purposeTemplateId = generateId<PurposeTemplateId>();
    const m2mPurposeTemplateEServiceDescriptorsResponse: m2mGatewayApi.EServiceDescriptorsPurposeTemplate =
      {
        pagination: {
          limit: mockParams.limit,
          offset: mockParams.offset,
          totalCount:
            mockPurposeTemplateEServiceDescriptorsProcessResponse.data
              .totalCount,
        },
        results: [
          mockApiPurposeTemplateEServiceDescriptor1,
          mockApiPurposeTemplateEServiceDescriptor2,
        ],
      };

    const result =
      await purposeTemplateService.getPurposeTemplateEServiceDescriptors(
        purposeTemplateId,
        mockParams,
        getMockM2MAdminAppContext()
      );

    expect(result).toEqual(m2mPurposeTemplateEServiceDescriptorsResponse);
    expectApiClientGetToHaveBeenCalledWith({
      mockGet:
        mockInteropBeClients.purposeTemplateProcessClient
          .getPurposeTemplateEServices,
      params: { id: purposeTemplateId },
      queries: {
        offset: mockParams.offset,
        limit: mockParams.limit,
        eserviceName: mockParams.eserviceName,
        producerIds: [],
      } satisfies m2mGatewayApi.GetPurposeTemplateEServiceDescriptorsQueryParams,
    });
  });
});
