import { describe, it, expect, vi, beforeEach } from "vitest";
import { authorizationApi, m2mGatewayApiV3 } from "pagopa-interop-api-clients";
import {
  getMockWithMetadata,
  getMockedApiConsumerFullClient,
} from "pagopa-interop-commons-test";
import { generateId } from "pagopa-interop-models";
import {
  clientService,
  expectApiClientGetToHaveBeenCalledWith,
  expectApiClientPostToHaveBeenCalledWith,
  mockInteropBeClients,
} from "../../integrationUtils.js";
import { PagoPAInteropBeClients } from "../../../src/clients/clientsProvider.js";
import { getMockM2MAdminAppContext } from "../../mockUtils.js";
import { toM2MGatewayApiConsumerClient } from "../../../src/api/clientApiConverter.js";

describe("createClient", () => {
  const mockConsumerClient = getMockedApiConsumerFullClient({
    kind: authorizationApi.ClientKind.Values.CONSUMER,
  });

  const mockConsumerClientWithMetadata = getMockWithMetadata(
    mockConsumerClient,
    2
  );

  const mockcreateClient = vi
    .fn()
    .mockResolvedValue(mockConsumerClientWithMetadata);

  const mockGetClient = vi
    .fn()
    .mockResolvedValue(mockConsumerClientWithMetadata);
  mockInteropBeClients.authorizationClient = {
    client: {
      createConsumerClient: mockcreateClient,
      getClient: mockGetClient,
    },
  } as unknown as PagoPAInteropBeClients["authorizationClient"];

  const clientSeed: m2mGatewayApiV3.ClientSeed = {
    name: "client seed",
    description: "client description",
    members: [generateId()],
  };

  beforeEach(() => {
    mockcreateClient.mockClear();
  });

  it("Should succeed and perform API clients calls", async () => {
    const result = await clientService.createClient(
      clientSeed,
      getMockM2MAdminAppContext()
    );

    expect(result).toEqual(toM2MGatewayApiConsumerClient(mockConsumerClient));

    // Create
    expectApiClientPostToHaveBeenCalledWith({
      mockPost: mockcreateClient,
      body: clientSeed,
    });

    // Polling
    expectApiClientGetToHaveBeenCalledWith({
      mockGet: mockGetClient,
      params: {
        clientId: mockConsumerClient.id,
      },
    });
  });
});
