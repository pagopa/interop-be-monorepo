import { describe, it, expect, vi, beforeEach } from "vitest";
import { catalogApi, m2mGatewayApi } from "pagopa-interop-api-clients";
import { generateId } from "pagopa-interop-models";
import {
  getMockedApiEservice,
  getMockWithMetadata,
} from "pagopa-interop-commons-test";
import {
  eserviceService,
  expectApiClientGetToHaveBeenCalledWith,
  mockInteropBeClients,
} from "../../integrationUtils.js";
import { PagoPAInteropBeClients } from "../../../src/clients/clientsProvider.js";
import { getMockM2MAdminAppContext } from "../../mockUtils.js";
import { WithMaybeMetadata } from "../../../src/clients/zodiosWithMetadataPatch.js";

describe("getEservices", () => {
  const mockParams: m2mGatewayApi.GetEServicesQueryParams = {
    producerIds: [generateId()],
    templateIds: [generateId()],
    offset: 0,
    limit: 10,
  };

  const mockApiEservice1 = getMockWithMetadata(getMockedApiEservice());
  const mockApiEservice2 = getMockWithMetadata(getMockedApiEservice());

  const mockApiEservices = [mockApiEservice1.data, mockApiEservice2.data];

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
    const eserviceResponse1: m2mGatewayApi.EService = {
      id: mockApiEservice1.data.id,
      producerId: mockApiEservice1.data.producerId,
      name: mockApiEservice1.data.name,
      description: mockApiEservice1.data.description,
      technology: mockApiEservice1.data.technology,
      mode: mockApiEservice1.data.mode,
      isSignalHubEnabled: mockApiEservice1.data.isSignalHubEnabled,
      isConsumerDelegable: mockApiEservice1.data.isConsumerDelegable,
      isClientAccessDelegable: mockApiEservice1.data.isClientAccessDelegable,
      templateId: mockApiEservice1.data.templateId,
    };

    const eserviceResponse2: m2mGatewayApi.EService = {
      id: mockApiEservice2.data.id,
      producerId: mockApiEservice2.data.producerId,
      name: mockApiEservice2.data.name,
      description: mockApiEservice2.data.description,
      technology: mockApiEservice2.data.technology,
      mode: mockApiEservice2.data.mode,
      isSignalHubEnabled: mockApiEservice2.data.isSignalHubEnabled,
      isConsumerDelegable: mockApiEservice2.data.isConsumerDelegable,
      isClientAccessDelegable: mockApiEservice2.data.isClientAccessDelegable,
      templateId: mockApiEservice2.data.templateId,
    };

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

    expect(result).toEqual(eservicesResponse);
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
