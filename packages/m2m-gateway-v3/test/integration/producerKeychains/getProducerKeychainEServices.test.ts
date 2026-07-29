import { m2mGatewayApiV3 } from "pagopa-interop-api-clients";
import {
  getMockWithMetadata,
  getMockedApiEservice,
} from "pagopa-interop-commons-test";
import { generateId, unsafeBrandId } from "pagopa-interop-models";
import { describe, it, expect, vi, beforeEach } from "vitest";

import { PagoPAInteropBeClients } from "../../../src/clients/clientsProvider.js";
import {
  producerKeychainService,
  expectApiClientGetToHaveBeenCalledWith,
  mockInteropBeClients,
} from "../../integrationUtils.js";
import {
  getMockM2MAdminAppContext,
  testToM2mGatewayApiEService,
} from "../../mockUtils.js";

describe("getProducerKeychainEServices", () => {
  const producerKeychainId = generateId();

  const mockApiEService1 = getMockedApiEservice();
  const mockApiEService2 = getMockedApiEservice();

  // Pagination (and the producer access check) is now performed by
  // authorization-process: it returns the page of e-service ids, which the
  // gateway resolves against catalog-process.
  const mockGetProducerKeychainEServices = vi.fn().mockResolvedValue(
    getMockWithMetadata({
      results: [mockApiEService1.id, mockApiEService2.id],
      totalCount: 5,
    })
  );

  const mockGetEServices = vi.fn(({ queries: { eservicesIds } }) =>
    Promise.resolve({
      data: {
        results: [mockApiEService1, mockApiEService2].filter((e) =>
          eservicesIds.includes(e.id)
        ),
      },
    })
  );

  mockInteropBeClients.authorizationClient = {
    producerKeychain: {
      getProducerKeychainEServices: mockGetProducerKeychainEServices,
    },
  } as unknown as PagoPAInteropBeClients["authorizationClient"];

  mockInteropBeClients.catalogProcessClient = {
    getEServices: mockGetEServices,
  } as unknown as PagoPAInteropBeClients["catalogProcessClient"];

  beforeEach(() => {
    mockGetProducerKeychainEServices.mockClear();
    mockGetEServices.mockClear();
  });

  it("Should delegate pagination to authorization-process and resolve the e-services", async () => {
    const expected: m2mGatewayApiV3.EServices = {
      pagination: { offset: 0, limit: 10, totalCount: 5 },
      results: [
        testToM2mGatewayApiEService(mockApiEService1),
        testToM2mGatewayApiEService(mockApiEService2),
      ],
    };

    const result = await producerKeychainService.getProducerKeychainEServices(
      unsafeBrandId(producerKeychainId),
      { offset: 0, limit: 10 },
      getMockM2MAdminAppContext()
    );

    expect(result).toStrictEqual(expected);

    expectApiClientGetToHaveBeenCalledWith({
      mockGet: mockGetProducerKeychainEServices,
      params: { producerKeychainId },
      queries: { offset: 0, limit: 10 },
    });
    expectApiClientGetToHaveBeenCalledWith({
      mockGet: mockGetEServices,
      queries: {
        eservicesIds: [mockApiEService1.id, mockApiEService2.id],
        limit: 10,
        offset: 0,
      },
    });
  });

  it("Should not call catalog when the keychain page is empty", async () => {
    mockGetProducerKeychainEServices.mockResolvedValueOnce(
      getMockWithMetadata({ results: [], totalCount: 0 })
    );

    const result = await producerKeychainService.getProducerKeychainEServices(
      unsafeBrandId(producerKeychainId),
      { offset: 0, limit: 10 },
      getMockM2MAdminAppContext()
    );

    expect(result).toStrictEqual({
      pagination: { offset: 0, limit: 10, totalCount: 0 },
      results: [],
    });
    expect(mockGetEServices).not.toHaveBeenCalled();
  });
});
