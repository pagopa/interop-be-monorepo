import { describe, it, expect, vi, beforeEach } from "vitest";
import { m2mGatewayApiV3 } from "pagopa-interop-api-clients";
import {
  getMockWithMetadata,
  getMockedApiFullProducerKeychain,
} from "pagopa-interop-commons-test";
import { generateId } from "pagopa-interop-models";
import {
  expectApiClientGetToHaveBeenCalledWith,
  expectApiClientPostToHaveBeenCalledWith,
  mockInteropBeClients,
  producerKeychainService,
} from "../../integrationUtils.js";
import { PagoPAInteropBeClients } from "../../../src/clients/clientsProvider.js";
import { getMockM2MAdminAppContext } from "../../mockUtils.js";
import { toM2MGatewayApiProducerKeychain } from "../../../src/api/producerKeychainApiConverter.js";
import { duplicatedMembersInSeed } from "../../../src/model/errors.js";

describe("createProducerKeychain", () => {
  const mockProducerKeychain = getMockedApiFullProducerKeychain();

  const mockProducerKeychainWithMetadata = getMockWithMetadata(
    mockProducerKeychain,
    2
  );

  const mockCreateProducerKeychain = vi
    .fn()
    .mockResolvedValue(mockProducerKeychainWithMetadata);

  const mockGetProducerKeychain = vi
    .fn()
    .mockResolvedValue(mockProducerKeychainWithMetadata);
  mockInteropBeClients.authorizationClient = {
    producerKeychain: {
      createProducerKeychain: mockCreateProducerKeychain,
      getProducerKeychain: mockGetProducerKeychain,
    },
  } as unknown as PagoPAInteropBeClients["authorizationClient"];

  const producerKeychainSeed: m2mGatewayApiV3.ProducerKeychainSeed = {
    name: "producerKeychain seed",
    description: "producer keychain description",
    members: [generateId()],
  };

  beforeEach(() => {
    mockCreateProducerKeychain.mockClear();
  });

  it("Should succeed and perform API clients calls", async () => {
    const result = await producerKeychainService.createProducerKeychain(
      producerKeychainSeed,
      getMockM2MAdminAppContext()
    );

    expect(result).toEqual(
      toM2MGatewayApiProducerKeychain(mockProducerKeychain)
    );

    // Create
    expectApiClientPostToHaveBeenCalledWith({
      mockPost: mockCreateProducerKeychain,
      body: producerKeychainSeed,
    });

    // Polling
    expectApiClientGetToHaveBeenCalledWith({
      mockGet: mockGetProducerKeychain,
      params: {
        producerKeychainId: mockProducerKeychain.id,
      },
    });
  });

  it("Should fail if duplicated users are passed in the seed", async () => {
    const userId = generateId();
    const seed = {
      ...producerKeychainSeed,
      members: [userId, userId, generateId()],
    };
    mockInteropBeClients.authorizationClient.producerKeychain.createProducerKeychain =
      vi
        .fn()
        .mockImplementation(() => Promise.reject(duplicatedMembersInSeed()));

    await expect(
      producerKeychainService.createProducerKeychain(
        seed,
        getMockM2MAdminAppContext()
      )
    ).rejects.toThrowError(duplicatedMembersInSeed());
  });
});
