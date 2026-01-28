import { describe, it, expect, vi, beforeEach } from "vitest";
import { unsafeBrandId } from "pagopa-interop-models";
import { m2mGatewayApi } from "pagopa-interop-api-clients";
import {
  getMockWithMetadata,
  getMockedApiPartialProducerKeychain,
  getMockedApiFullProducerKeychain,
} from "pagopa-interop-commons-test";
import {
  producerKeychainService,
  expectApiClientGetToHaveBeenCalledWith,
  mockInteropBeClients,
} from "../../integrationUtils.js";
import { PagoPAInteropBeClients } from "../../../src/clients/clientsProvider.js";
import { getMockM2MAdminAppContext } from "../../mockUtils.js";

describe("getProducerKeychain", () => {
  const mockFullProducerKeychainFromProcess = getMockWithMetadata(
    getMockedApiFullProducerKeychain()
  );

  const mockPartialProducerKeychainFromProcess = getMockWithMetadata(
    getMockedApiPartialProducerKeychain()
  );

  const mockGetProducerKeychain = vi.fn();

  mockInteropBeClients.authorizationClient = {
    producerKeychain: {
      getProducerKeychain: mockGetProducerKeychain,
    },
  } as unknown as PagoPAInteropBeClients["authorizationClient"];

  beforeEach(() => {
    // Clear mock counters and call information before each test
    mockGetProducerKeychain.mockClear();
  });

  it("Should succeed with partial producerKeychain and perform API producerKeychains calls", async () => {
    mockGetProducerKeychain.mockResolvedValue(
      mockPartialProducerKeychainFromProcess
    );

    const m2mProducerKeychainResponse: m2mGatewayApi.ProducerKeychain = {
      id: mockPartialProducerKeychainFromProcess.data.id,
      producerId: mockPartialProducerKeychainFromProcess.data.producerId,
    };

    const result = await producerKeychainService.getProducerKeychain(
      unsafeBrandId(mockPartialProducerKeychainFromProcess.data.id),
      getMockM2MAdminAppContext()
    );

    expect(result).toStrictEqual(m2mProducerKeychainResponse);
    expectApiClientGetToHaveBeenCalledWith({
      mockGet:
        mockInteropBeClients.authorizationClient.producerKeychain
          .getProducerKeychain,
      params: {
        producerKeychainId: mockPartialProducerKeychainFromProcess.data.id,
      },
    });
  });

  it("Should succeed with full producerKeychain and perform API producerKeychains calls", async () => {
    mockGetProducerKeychain.mockResolvedValue(
      mockFullProducerKeychainFromProcess
    );

    const m2mFullProducerKeychainResponse: m2mGatewayApi.FullProducerKeychain =
    {
      id: mockFullProducerKeychainFromProcess.data.id,
      producerId: mockFullProducerKeychainFromProcess.data.producerId,
      name: mockFullProducerKeychainFromProcess.data.name,
      description: mockFullProducerKeychainFromProcess.data.description,
      createdAt: mockFullProducerKeychainFromProcess.data.createdAt,
    };

    const result = await producerKeychainService.getProducerKeychain(
      unsafeBrandId(mockFullProducerKeychainFromProcess.data.id),
      getMockM2MAdminAppContext()
    );

    expect(result).toStrictEqual(m2mFullProducerKeychainResponse);
    expectApiClientGetToHaveBeenCalledWith({
      mockGet:
        mockInteropBeClients.authorizationClient.producerKeychain
          .getProducerKeychain,
      params: {
        producerKeychainId: mockFullProducerKeychainFromProcess.data.id,
      },
    });
  });
});
