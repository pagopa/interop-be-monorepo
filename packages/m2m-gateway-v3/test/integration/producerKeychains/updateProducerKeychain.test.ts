import { AxiosError, InternalAxiosRequestConfig } from "axios";
import { m2mGatewayApiV3 } from "pagopa-interop-api-clients";
import {
  getMockWithMetadata,
  getMockedApiFullProducerKeychain,
} from "pagopa-interop-commons-test";
import {
  pollingMaxRetriesExceeded,
  unsafeBrandId,
} from "pagopa-interop-models";
import { describe, it, expect, vi, beforeEach } from "vitest";

import { toM2MGatewayApiProducerKeychain } from "../../../src/api/producerKeychainApiConverter.js";
import { PagoPAInteropBeClients } from "../../../src/clients/clientsProvider.js";
import { config } from "../../../src/config/config.js";
import { missingMetadata } from "../../../src/model/errors.js";
import {
  producerKeychainService,
  expectApiClientGetToHaveBeenCalledWith,
  expectApiClientPostToHaveBeenCalledWith,
  mockInteropBeClients,
} from "../../integrationUtils.js";
import { getMockM2MAdminAppContext } from "../../mockUtils.js";

describe("updateProducerKeychain", () => {
  const originalProducerKeychain = {
    ...getMockedApiFullProducerKeychain(),
    name: "Original producer keychain name",
    description: "Original producer keychain description",
  };
  const seed = {
    name: "Updated producer keychain name",
    description: "Updated producer keychain description",
  } satisfies m2mGatewayApiV3.ProducerKeychainUpdateSeed;
  const updatedProducerKeychain = { ...originalProducerKeychain, ...seed };
  const finalResponse = getMockWithMetadata(updatedProducerKeychain, 4);
  const mockUpdateProducerKeychain = vi.fn().mockResolvedValue(finalResponse);
  const mockGetProducerKeychain = vi.fn().mockResolvedValue(finalResponse);
  mockInteropBeClients.authorizationClient = {
    producerKeychain: {
      updateProducerKeychain: mockUpdateProducerKeychain,
      getProducerKeychain: mockGetProducerKeychain,
    },
  } as unknown as PagoPAInteropBeClients["authorizationClient"];

  beforeEach(() => {
    mockUpdateProducerKeychain.mockReset().mockResolvedValue(finalResponse);
    mockGetProducerKeychain.mockReset().mockResolvedValue(finalResponse);
  });

  it("should issue one command and wait past the intermediate version to return the final state", async () => {
    mockGetProducerKeychain
      .mockResolvedValueOnce(getMockWithMetadata(originalProducerKeychain, 2))
      .mockResolvedValueOnce(
        getMockWithMetadata({ ...originalProducerKeychain, name: seed.name }, 3)
      );

    const result = await producerKeychainService.updateProducerKeychain(
      unsafeBrandId(originalProducerKeychain.id),
      seed,
      getMockM2MAdminAppContext()
    );

    expect(result).toEqual(
      toM2MGatewayApiProducerKeychain(updatedProducerKeychain)
    );
    expect(mockUpdateProducerKeychain).toHaveBeenCalledTimes(1);
    expectApiClientPostToHaveBeenCalledWith({
      mockPost: mockUpdateProducerKeychain,
      params: { producerKeychainId: originalProducerKeychain.id },
      body: seed,
    });
    expect(mockGetProducerKeychain).toHaveBeenCalledTimes(3);
    expectApiClientGetToHaveBeenCalledWith({
      mockGet: mockGetProducerKeychain,
      params: { producerKeychainId: originalProducerKeychain.id },
    });
  });

  it.each([
    { name: seed.name },
    { description: seed.description },
    {
      name: originalProducerKeychain.name,
      description: originalProducerKeychain.description,
    },
  ])(
    "should forward partial or unchanged values %j once and poll the returned version",
    async (body) => {
      const producerKeychain = { ...originalProducerKeychain, ...body };
      const response = getMockWithMetadata(producerKeychain, 4);
      mockUpdateProducerKeychain.mockResolvedValueOnce(response);
      mockGetProducerKeychain.mockResolvedValueOnce(response);
      const result = await producerKeychainService.updateProducerKeychain(
        unsafeBrandId(producerKeychain.id),
        body,
        getMockM2MAdminAppContext()
      );
      expect(result).toEqual(toM2MGatewayApiProducerKeychain(producerKeychain));
      expect(mockUpdateProducerKeychain).toHaveBeenCalledTimes(1);
      expectApiClientPostToHaveBeenCalledWith({
        mockPost: mockUpdateProducerKeychain,
        params: { producerKeychainId: producerKeychain.id },
        body,
      });
      expect(mockGetProducerKeychain).toHaveBeenCalledTimes(1);
    }
  );

  it.each([400, 403, 404, 409])(
    "should propagate process status %s without polling or retrying",
    async (status) => {
      const error = new AxiosError(
        "Producer keychain update failed",
        undefined,
        undefined,
        undefined,
        {
          status,
          statusText: "Producer keychain update failed",
          data: {},
          headers: {},
          config: {} as InternalAxiosRequestConfig,
        }
      );
      mockUpdateProducerKeychain.mockRejectedValueOnce(error);
      await expect(
        producerKeychainService.updateProducerKeychain(
          unsafeBrandId(originalProducerKeychain.id),
          seed,
          getMockM2MAdminAppContext()
        )
      ).rejects.toBe(error);
      expect(mockUpdateProducerKeychain).toHaveBeenCalledTimes(1);
      expect(mockGetProducerKeychain).not.toHaveBeenCalled();
    }
  );

  it("should fail if the command response has no metadata", async () => {
    mockUpdateProducerKeychain.mockResolvedValueOnce({
      data: updatedProducerKeychain,
    });
    await expect(
      producerKeychainService.updateProducerKeychain(
        unsafeBrandId(originalProducerKeychain.id),
        seed,
        getMockM2MAdminAppContext()
      )
    ).rejects.toThrowError(missingMetadata());
  });

  it("should fail if the polling response has no metadata", async () => {
    mockGetProducerKeychain.mockResolvedValueOnce({
      data: updatedProducerKeychain,
    });
    await expect(
      producerKeychainService.updateProducerKeychain(
        unsafeBrandId(originalProducerKeychain.id),
        seed,
        getMockM2MAdminAppContext()
      )
    ).rejects.toThrowError(missingMetadata());
  });

  it("should fail when polling never reaches the final version without retrying the command", async () => {
    mockGetProducerKeychain.mockResolvedValue(
      getMockWithMetadata(originalProducerKeychain, 3)
    );
    await expect(
      producerKeychainService.updateProducerKeychain(
        unsafeBrandId(originalProducerKeychain.id),
        seed,
        getMockM2MAdminAppContext()
      )
    ).rejects.toThrowError(
      pollingMaxRetriesExceeded(
        config.defaultPollingMaxRetries,
        config.defaultPollingRetryDelay
      )
    );
    expect(mockGetProducerKeychain).toHaveBeenCalledTimes(
      config.defaultPollingMaxRetries
    );
    expect(mockUpdateProducerKeychain).toHaveBeenCalledTimes(1);
  });
});
