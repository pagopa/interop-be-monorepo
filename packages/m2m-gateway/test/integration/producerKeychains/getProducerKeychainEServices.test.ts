import { describe, it, expect, vi, beforeEach } from "vitest";
import { m2mGatewayApi } from "pagopa-interop-api-clients";
import {
  getMockWithMetadata,
  getMockedApiFullProducerKeychain,
  getMockedApiEservice,
} from "pagopa-interop-commons-test";
import { unsafeBrandId } from "pagopa-interop-models";
import {
  producerKeychainService,
  expectApiClientGetToHaveBeenCalledWith,
  mockInteropBeClients,
} from "../../integrationUtils.js";
import { PagoPAInteropBeClients } from "../../../src/clients/clientsProvider.js";
import { getMockM2MAdminAppContext } from "../../mockUtils.js";

describe("getProducerKeychainEServices", () => {
  const mockParams: m2mGatewayApi.GetProducerKeychainEServicesQueryParams = {
    offset: 0,
    limit: 10,
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

  const mockApiConsumerProducerKeychain = getMockedApiFullProducerKeychain({
    eservices: [mockApiEService1.id, mockApiEService2.id],
  });

  const mockGetProducerKeychain = vi
    .fn()
    .mockResolvedValue(getMockWithMetadata(mockApiConsumerProducerKeychain));

  mockInteropBeClients.authorizationClient = {
    producerKeychain: {
      getProducerKeychain: mockGetProducerKeychain,
    },
  } as unknown as PagoPAInteropBeClients["authorizationClient"];

  const expectedM2MEService1: m2mGatewayApi.EService = {
    id: mockApiEService1.id,
    producerId: mockApiEService1.producerId,
    name: mockApiEService1.name,
    description: mockApiEService1.description,
    technology: mockApiEService1.technology,
    mode: mockApiEService1.mode,
    isSignalHubEnabled: mockApiEService1.isSignalHubEnabled,
    isConsumerDelegable: mockApiEService1.isConsumerDelegable,
    isClientAccessDelegable: mockApiEService1.isClientAccessDelegable,
    templateId: mockApiEService1.templateId,
  };

  const expectedM2MEService2: m2mGatewayApi.EService = {
    id: mockApiEService2.id,
    producerId: mockApiEService2.producerId,
    name: mockApiEService2.name,
    description: mockApiEService2.description,
    technology: mockApiEService2.technology,
    mode: mockApiEService2.mode,
    isSignalHubEnabled: mockApiEService2.isSignalHubEnabled,
    isConsumerDelegable: mockApiEService2.isConsumerDelegable,
    isClientAccessDelegable: mockApiEService2.isClientAccessDelegable,
    templateId: mockApiEService2.templateId,
  };

  beforeEach(() => {
    mockGetProducerKeychain.mockClear();
    mockGetEServices.mockClear();
  });

  it("Should succeed and perform API producerKeychains calls", async () => {
    const m2mProducerKeychainEServicesResponse: m2mGatewayApi.EServices = {
      pagination: {
        limit: mockParams.limit,
        offset: mockParams.offset,
        totalCount: mockApiConsumerProducerKeychain.eservices.length,
      },
      results: [expectedM2MEService1, expectedM2MEService2],
    };

    const result = await producerKeychainService.getProducerKeychainEServices(
      unsafeBrandId(mockApiConsumerProducerKeychain.id),
      mockParams,
      getMockM2MAdminAppContext()
    );

    expect(result).toStrictEqual(m2mProducerKeychainEServicesResponse);

    expectApiClientGetToHaveBeenCalledWith({
      mockGet: mockGetProducerKeychain,
      params: {
        producerKeychainId: mockApiConsumerProducerKeychain.id,
      },
    });
    expectApiClientGetToHaveBeenCalledWith({
      mockGet: mockGetEServices,
      queries: {
        eservicesIds: mockApiEServices.map((e) => e.id),
        limit: mockParams.limit,
        offset: 0,
      },
    });
  });

  it("Should apply filters (offset, limit)", async () => {
    const result1 = await producerKeychainService.getProducerKeychainEServices(
      unsafeBrandId(mockApiConsumerProducerKeychain.id),
      { offset: 0, limit: 1 },
      getMockM2MAdminAppContext()
    );

    expect(result1).toStrictEqual({
      pagination: {
        offset: 0,
        limit: 1,
        totalCount: 2,
      },
      results: [expectedM2MEService1],
    });

    expect(mockGetProducerKeychain).toHaveBeenCalledTimes(1);
    expect(mockGetEServices).toHaveBeenCalledTimes(1);

    const result2 = await producerKeychainService.getProducerKeychainEServices(
      unsafeBrandId(mockApiConsumerProducerKeychain.id),
      { offset: 1, limit: 1 },
      getMockM2MAdminAppContext()
    );

    expect(result2).toStrictEqual({
      pagination: {
        offset: 1,
        limit: 1,
        totalCount: 2,
      },
      results: [expectedM2MEService2],
    });

    expect(mockGetProducerKeychain).toHaveBeenCalledTimes(2);
    expect(mockGetEServices).toHaveBeenCalledTimes(2);
  });
});
