import { describe, it, expect, vi, beforeEach } from "vitest";
import { catalogApi, m2mGatewayApiV3 } from "pagopa-interop-api-clients";
import { generateId } from "pagopa-interop-models";
import { getMockedApiEservice } from "pagopa-interop-commons-test";
import {
  eserviceService,
  expectApiClientGetToHaveBeenCalledWith,
  mockInteropBeClients,
} from "../../integrationUtils.js";
import { PagoPAInteropBeClients } from "../../../src/clients/clientsProvider.js";
import { getMockM2MAdminAppContext } from "../../mockUtils.js";
import { WithMaybeMetadata } from "../../../src/clients/zodiosWithMetadataPatch.js";

describe("getEservices", () => {
  const mockParams: m2mGatewayApiV3.GetEServicesQueryParams = {
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
    const eserviceResponse1: m2mGatewayApiV3.EService = {
      id: mockApiEservice1.id,
      producerId: mockApiEservice1.producerId,
      name: mockApiEservice1.name,
      description: mockApiEservice1.description,
      technology: mockApiEservice1.technology,
      mode: mockApiEservice1.mode,
      isSignalHubEnabled: mockApiEservice1.isSignalHubEnabled,
      isConsumerDelegable: mockApiEservice1.isConsumerDelegable,
      isClientAccessDelegable: mockApiEservice1.isClientAccessDelegable,
      templateId: mockApiEservice1.templateId,
    };

    const eserviceResponse2: m2mGatewayApiV3.EService = {
      id: mockApiEservice2.id,
      producerId: mockApiEservice2.producerId,
      name: mockApiEservice2.name,
      description: mockApiEservice2.description,
      technology: mockApiEservice2.technology,
      mode: mockApiEservice2.mode,
      isSignalHubEnabled: mockApiEservice2.isSignalHubEnabled,
      isConsumerDelegable: mockApiEservice2.isConsumerDelegable,
      isClientAccessDelegable: mockApiEservice2.isClientAccessDelegable,
      templateId: mockApiEservice2.templateId,
    };

    const eservicesResponse: m2mGatewayApiV3.EServices = {
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
