import { describe, it, expect, vi, beforeEach } from "vitest";
import { authorizationApi, m2mGatewayApiV3 } from "pagopa-interop-api-clients";
import { generateId } from "pagopa-interop-models";
import {
  getMockedApiPartialProducerKeychain,
  getMockedApiFullProducerKeychain,
} from "pagopa-interop-commons-test";
import { generateMock } from "@anatine/zod-mock";
import { z } from "zod";
import {
  producerKeychainService,
  expectApiClientGetToHaveBeenCalledWith,
  mockInteropBeClients,
} from "../../integrationUtils.js";
import { PagoPAInteropBeClients } from "../../../src/clients/clientsProvider.js";
import { getMockM2MAdminAppContext } from "../../mockUtils.js";
import { WithMaybeMetadata } from "../../../src/clients/zodiosWithMetadataPatch.js";

describe("getProducerKeychains", () => {
  const mockParams: m2mGatewayApiV3.GetProducerKeychainsQueryParams = {
    producerId: generateId(),
    name: generateMock(z.string()),
    offset: 0,
    limit: 10,
  };
  const mockFullProducerKeychain1 = getMockedApiFullProducerKeychain();
  const mockFullProducerKeychain2 = getMockedApiFullProducerKeychain();

  const mockFullProducerKeychains = [
    mockFullProducerKeychain1,
    mockFullProducerKeychain2,
  ];

  const mockFullProducerKeychainsResponse: WithMaybeMetadata<authorizationApi.ProducerKeychains> =
    {
      data: {
        results: mockFullProducerKeychains,
        totalCount: mockFullProducerKeychains.length,
      },
      metadata: undefined,
    };

  const mockGetProducerKeychains = vi.fn();

  const mockPartialProducerKeychain1 = getMockedApiPartialProducerKeychain();
  const mockPartialProducerKeychain2 = getMockedApiPartialProducerKeychain();
  const mockPartialProducerKeychains = [
    mockPartialProducerKeychain1,
    mockPartialProducerKeychain2,
  ];
  const mockPartialProducerKeychainsResponse: WithMaybeMetadata<authorizationApi.ProducerKeychains> =
    {
      data: {
        results: mockPartialProducerKeychains,
        totalCount: mockPartialProducerKeychains.length,
      },
      metadata: undefined,
    };

  mockInteropBeClients.authorizationClient = {
    producerKeychain: {
      getProducerKeychains: mockGetProducerKeychains,
    },
  } as unknown as PagoPAInteropBeClients["authorizationClient"];

  beforeEach(() => {
    // Clear mock counters and call information before each test
    mockGetProducerKeychains.mockClear();
  });

  it("Should succeed with full producerKeychains and perform API producerKeychains calls", async () => {
    mockGetProducerKeychains.mockResolvedValueOnce(
      mockFullProducerKeychainsResponse
    );

    const m2mProducerKeychainResponse1: m2mGatewayApiV3.FullProducerKeychain = {
      id: mockFullProducerKeychain1.id,
      producerId: mockFullProducerKeychain1.producerId,
      name: mockFullProducerKeychain1.name,
      createdAt: mockFullProducerKeychain1.createdAt,
      description: mockFullProducerKeychain1.description,
    };
    const m2mProducerKeychainResponse2: m2mGatewayApiV3.FullProducerKeychain = {
      id: mockFullProducerKeychain2.id,
      producerId: mockFullProducerKeychain2.producerId,
      name: mockFullProducerKeychain2.name,
      createdAt: mockFullProducerKeychain2.createdAt,
      description: mockFullProducerKeychain2.description,
    };

    const m2mProducerKeychainsResponse: m2mGatewayApiV3.ProducerKeychains = {
      pagination: {
        limit: mockParams.limit,
        offset: mockParams.offset,
        totalCount: mockFullProducerKeychainsResponse.data.totalCount,
      },
      results: [m2mProducerKeychainResponse1, m2mProducerKeychainResponse2],
    };

    const result = await producerKeychainService.getProducerKeychains(
      mockParams,
      getMockM2MAdminAppContext()
    );

    expect(result).toStrictEqual(m2mProducerKeychainsResponse);
    expectApiClientGetToHaveBeenCalledWith({
      mockGet:
        mockInteropBeClients.authorizationClient.producerKeychain
          .getProducerKeychains,
      queries: {
        producerId: mockParams.producerId,
        name: mockParams.name,
        offset: mockParams.offset,
        limit: mockParams.limit,
        userIds: [],
        eserviceId: undefined,
      },
    });
  });

  it("Should succeed with partial producerKeychains and perform API producerKeychains calls", async () => {
    mockGetProducerKeychains.mockResolvedValueOnce(
      mockPartialProducerKeychainsResponse
    );

    const m2mProducerKeychainResponse1: m2mGatewayApiV3.PartialProducerKeychain =
      {
        id: mockPartialProducerKeychain1.id,
        producerId: mockPartialProducerKeychain1.producerId,
      };
    const m2mProducerKeychainResponse2: m2mGatewayApiV3.PartialProducerKeychain =
      {
        id: mockPartialProducerKeychain2.id,
        producerId: mockPartialProducerKeychain2.producerId,
      };

    const m2mProducerKeychainsResponse: m2mGatewayApiV3.ProducerKeychains = {
      pagination: {
        limit: mockParams.limit,
        offset: mockParams.offset,
        totalCount: mockPartialProducerKeychainsResponse.data.totalCount,
      },
      results: [m2mProducerKeychainResponse1, m2mProducerKeychainResponse2],
    };

    const result = await producerKeychainService.getProducerKeychains(
      mockParams,
      getMockM2MAdminAppContext()
    );

    expect(result).toStrictEqual(m2mProducerKeychainsResponse);
    expectApiClientGetToHaveBeenCalledWith({
      mockGet:
        mockInteropBeClients.authorizationClient.producerKeychain
          .getProducerKeychains,
      queries: {
        producerId: mockParams.producerId,
        name: mockParams.name,
        offset: mockParams.offset,
        limit: mockParams.limit,
        userIds: [],
        eserviceId: undefined,
      },
    });
  });
});
