import { describe, it, expect, vi, beforeEach } from "vitest";
import { m2mGatewayApiV3, purposeTemplateApi } from "pagopa-interop-api-clients";
import {
  getMockedApiEservice,
  getMockedApiEServiceDescriptorPurposeTemplate,
} from "pagopa-interop-commons-test";
import { generateId, PurposeTemplateId } from "pagopa-interop-models";
import {
  expectApiClientGetToHaveBeenCalledWith,
  mockInteropBeClients,
  purposeTemplateService,
} from "../../integrationUtils.js";
import { PagoPAInteropBeClients } from "../../../src/clients/clientsProvider.js";
import { getMockM2MAdminAppContext } from "../../mockUtils.js";
import { WithMaybeMetadata } from "../../../src/clients/zodiosWithMetadataPatch.js";
import { toM2MGatewayApiEService } from "../../../src/api/eserviceApiConverter.js";

describe("getPurposeTemplateEServiceDescriptors", () => {
  const mockParams: m2mGatewayApiV3.GetPurposeTemplateEServicesQueryParams = {
    offset: 0,
    limit: 10,
    producerIds: [],
  };

  const mockApiEService1 = getMockedApiEservice();
  const mockApiEService2 = getMockedApiEservice();
  const mockApiEServices = [mockApiEService1, mockApiEService2];

  const mockGetEServices = vi.fn(({ queries: { eservicesIds } }) =>
    Promise.resolve({
      data: {
        results: mockApiEServices.filter((e) => eservicesIds.includes(e.id)),
      },
    })
  );
  mockInteropBeClients.catalogProcessClient = {
    getEServices: mockGetEServices,
  } as unknown as PagoPAInteropBeClients["catalogProcessClient"];

  const mockApiPurposeTemplateEServiceDescriptor1: purposeTemplateApi.EServiceDescriptorPurposeTemplate =
  {
    ...getMockedApiEServiceDescriptorPurposeTemplate(),
    eserviceId: mockApiEService1.id,
  };
  const mockApiPurposeTemplateEServiceDescriptor2: purposeTemplateApi.EServiceDescriptorPurposeTemplate =
  {
    ...getMockedApiEServiceDescriptorPurposeTemplate(),
    eserviceId: mockApiEService2.id,
  };
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

  const mockGetPurposeTemplateEServices = vi
    .fn()
    .mockResolvedValue(mockPurposeTemplateEServiceDescriptorsProcessResponse);

  mockInteropBeClients.purposeTemplateProcessClient = {
    getPurposeTemplateEServices: mockGetPurposeTemplateEServices,
  } as unknown as PagoPAInteropBeClients["purposeTemplateProcessClient"];

  beforeEach(() => {
    mockGetPurposeTemplateEServices.mockClear();
  });

  it("Should succeed and perform API clients calls", async () => {
    const purposeTemplateId = generateId<PurposeTemplateId>();
    const m2mPurposeTemplateEServicesResponse: m2mGatewayApiV3.EServices = {
      pagination: {
        limit: mockParams.limit,
        offset: mockParams.offset,
        totalCount:
          mockPurposeTemplateEServiceDescriptorsProcessResponse.data.totalCount,
      },
      results: [mockApiEService1, mockApiEService2].map(
        toM2MGatewayApiEService
      ),
    };

    const result = await purposeTemplateService.getPurposeTemplateEServices(
      purposeTemplateId,
      mockParams,
      getMockM2MAdminAppContext()
    );

    expect(result).toEqual(m2mPurposeTemplateEServicesResponse);
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
      } satisfies m2mGatewayApiV3.GetPurposeTemplateEServicesQueryParams,
    });
  });
});
