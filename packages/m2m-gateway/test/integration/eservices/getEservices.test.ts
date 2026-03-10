import { describe, it, expect, vi, beforeEach } from "vitest";
import { catalogApi, m2mGatewayApi } from "pagopa-interop-api-clients";
import { generateId } from "pagopa-interop-models";
import { getMockedApiEservice } from "pagopa-interop-commons-test";
import {
  eserviceService,
  expectApiClientGetToHaveBeenCalledWith,
  mockInteropBeClients,
} from "../../integrationUtils.js";
import { PagoPAInteropBeClients } from "../../../src/clients/clientsProvider.js";
import {
  getMockM2MAdminAppContext,
  testToM2mGatewayApiEService,
} from "../../mockUtils.js";
import { WithMaybeMetadata } from "../../../src/clients/zodiosWithMetadataPatch.js";

describe("getEservices", () => {
  const mockParams: m2mGatewayApi.GetEServicesQueryParams = {
    producerIds: [generateId()],
    templateIds: [generateId()],
    offset: 0,
    limit: 10,
  };

  const mockApiEservice1 = getMockedApiEservice();
  const mockApiEservice2 = getMockedApiEservice();

  const mockApiEservices = [mockApiEservice1, mockApiEservice2];

  const mockEservicesProcessResponse: WithMaybeMetadata<catalogApi.EServices> =
    {
      data: {
        results: mockApiEservices,
        totalCount: mockApiEservices.length,
      },
      metadata: undefined,
    };

  const mockGetEservices = vi
    .fn()
    .mockResolvedValue(mockEservicesProcessResponse);

  mockInteropBeClients.catalogProcessClient = {
    getEServices: mockGetEservices,
  } as unknown as PagoPAInteropBeClients["catalogProcessClient"];

  beforeEach(() => {
    // Clear mock counters and call information before each test
    mockGetEservices.mockClear();
  });

  it("Should succeed and perform API clients calls", async () => {
    const eserviceResponse1: m2mGatewayApi.EService =
      testToM2mGatewayApiEService(mockApiEservice1);

    const eserviceResponse2: m2mGatewayApi.EService =
      testToM2mGatewayApiEService(mockApiEservice2);

    const eservicesResponse: m2mGatewayApi.EServices = {
      pagination: {
        limit: mockParams.limit,
        offset: mockParams.offset,
        totalCount: mockEservicesProcessResponse.data.totalCount,
      },
      results: [eserviceResponse1, eserviceResponse2],
    };

    const result = await eserviceService.getEServices(
      mockParams,
      getMockM2MAdminAppContext()
    );

    expect(result).toStrictEqual(eservicesResponse);
    expectApiClientGetToHaveBeenCalledWith({
      mockGet: mockInteropBeClients.catalogProcessClient.getEServices,
      queries: {
        producersIds: mockParams.producerIds,
        templatesIds: mockParams.templateIds,
        offset: mockParams.offset,
        limit: mockParams.limit,
        name: undefined,
        eservicesIds: [],
        attributesIds: [],
        states: [],
        agreementStates: [],
        mode: undefined,
        isConsumerDelegable: undefined,
        delegated: undefined,
      },
    });
  });
});
