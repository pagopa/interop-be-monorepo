import { AxiosError, InternalAxiosRequestConfig } from "axios";
import { authorizationApi, m2mGatewayApiV3 } from "pagopa-interop-api-clients";
import {
  getMockWithMetadata,
  getMockedApiConsumerFullClient,
} from "pagopa-interop-commons-test";
import {
  pollingMaxRetriesExceeded,
  unsafeBrandId,
} from "pagopa-interop-models";
import { describe, it, expect, vi, beforeEach } from "vitest";

import { toM2MGatewayApiConsumerClient } from "../../../src/api/clientApiConverter.js";
import { PagoPAInteropBeClients } from "../../../src/clients/clientsProvider.js";
import { config } from "../../../src/config/config.js";
import { missingMetadata } from "../../../src/model/errors.js";
import {
  clientService,
  expectApiClientGetToHaveBeenCalledWith,
  expectApiClientPostToHaveBeenCalledWith,
  mockInteropBeClients,
} from "../../integrationUtils.js";
import { getMockM2MAdminAppContext } from "../../mockUtils.js";

describe("updateClient", () => {
  const originalClient = {
    ...getMockedApiConsumerFullClient({
      kind: authorizationApi.ClientKind.Values.CONSUMER,
    }),
    name: "Original client name",
    description: "Original client description",
  };
  const seed = {
    name: "Updated client name",
    description: "Updated client description",
  } satisfies m2mGatewayApiV3.ClientUpdateSeed;
  const updatedClient = { ...originalClient, ...seed };
  const finalResponse = getMockWithMetadata(updatedClient, 4);
  const mockUpdateClient = vi.fn().mockResolvedValue(finalResponse);
  const mockGetClient = vi.fn().mockResolvedValue(finalResponse);
  mockInteropBeClients.authorizationClient = {
    client: {
      updateClient: mockUpdateClient,
      getClient: mockGetClient,
    },
  } as unknown as PagoPAInteropBeClients["authorizationClient"];

  beforeEach(() => {
    mockUpdateClient.mockReset().mockResolvedValue(finalResponse);
    mockGetClient.mockReset().mockResolvedValue(finalResponse);
  });

  it("should issue one command and wait past the intermediate version to return the final state", async () => {
    mockGetClient
      .mockResolvedValueOnce(getMockWithMetadata(originalClient, 2))
      .mockResolvedValueOnce(
        getMockWithMetadata({ ...originalClient, name: seed.name }, 3)
      );

    const result = await clientService.updateClient(
      unsafeBrandId(originalClient.id),
      seed,
      getMockM2MAdminAppContext()
    );

    expect(result).toEqual(toM2MGatewayApiConsumerClient(updatedClient));
    expect(mockUpdateClient).toHaveBeenCalledTimes(1);
    expectApiClientPostToHaveBeenCalledWith({
      mockPost: mockUpdateClient,
      params: { clientId: originalClient.id },
      body: seed,
    });
    expect(mockGetClient).toHaveBeenCalledTimes(3);
    expectApiClientGetToHaveBeenCalledWith({
      mockGet: mockGetClient,
      params: { clientId: originalClient.id },
    });
  });

  it.each([
    { name: seed.name },
    { description: seed.description },
    { name: originalClient.name, description: originalClient.description },
  ])(
    "should forward partial or unchanged values %j once and poll the returned version",
    async (body) => {
      const client = { ...originalClient, ...body };
      const response = getMockWithMetadata(client, 4);
      mockUpdateClient.mockResolvedValueOnce(response);
      mockGetClient.mockResolvedValueOnce(response);
      const result = await clientService.updateClient(
        unsafeBrandId(client.id),
        body,
        getMockM2MAdminAppContext()
      );
      expect(result).toEqual(toM2MGatewayApiConsumerClient(client));
      expect(mockUpdateClient).toHaveBeenCalledTimes(1);
      expectApiClientPostToHaveBeenCalledWith({
        mockPost: mockUpdateClient,
        params: { clientId: client.id },
        body,
      });
      expect(mockGetClient).toHaveBeenCalledTimes(1);
    }
  );

  it.each([400, 403, 404, 409])(
    "should propagate process status %s without polling or retrying",
    async (status) => {
      const error = new AxiosError(
        "Client update failed",
        undefined,
        undefined,
        undefined,
        {
          status,
          statusText: "Client update failed",
          data: {},
          headers: {},
          config: {} as InternalAxiosRequestConfig,
        }
      );
      mockUpdateClient.mockRejectedValueOnce(error);
      await expect(
        clientService.updateClient(
          unsafeBrandId(originalClient.id),
          seed,
          getMockM2MAdminAppContext()
        )
      ).rejects.toBe(error);
      expect(mockUpdateClient).toHaveBeenCalledTimes(1);
      expect(mockGetClient).not.toHaveBeenCalled();
    }
  );

  it("should fail if the command response has no metadata", async () => {
    mockUpdateClient.mockResolvedValueOnce({ data: updatedClient });
    await expect(
      clientService.updateClient(
        unsafeBrandId(originalClient.id),
        seed,
        getMockM2MAdminAppContext()
      )
    ).rejects.toThrowError(missingMetadata());
  });

  it("should fail if the polling response has no metadata", async () => {
    mockGetClient.mockResolvedValueOnce({ data: updatedClient });
    await expect(
      clientService.updateClient(
        unsafeBrandId(originalClient.id),
        seed,
        getMockM2MAdminAppContext()
      )
    ).rejects.toThrowError(missingMetadata());
  });

  it("should fail when polling never reaches the final version without retrying the command", async () => {
    mockGetClient.mockResolvedValue(getMockWithMetadata(originalClient, 3));
    await expect(
      clientService.updateClient(
        unsafeBrandId(originalClient.id),
        seed,
        getMockM2MAdminAppContext()
      )
    ).rejects.toThrowError(
      pollingMaxRetriesExceeded(
        config.defaultPollingMaxRetries,
        config.defaultPollingRetryDelay
      )
    );
    expect(mockGetClient).toHaveBeenCalledTimes(
      config.defaultPollingMaxRetries
    );
    expect(mockUpdateClient).toHaveBeenCalledTimes(1);
  });
});
