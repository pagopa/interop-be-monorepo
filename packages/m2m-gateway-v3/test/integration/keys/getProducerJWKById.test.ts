import { describe, it, expect, vi, beforeEach } from "vitest";
import { unsafeBrandId } from "pagopa-interop-models";
import { getMockProducerJWKKey } from "pagopa-interop-commons-test/index.js";
import { authorizationApi } from "pagopa-interop-api-clients";
import {
  expectApiClientGetToHaveBeenCalledWith,
  keyService,
  mockInteropBeClients,
} from "../../integrationUtils.js";
import { PagoPAInteropBeClients } from "../../../src/clients/clientsProvider.js";
import {
  getMockM2MAdminAppContext,
  testToM2MProducerKey,
} from "../../mockUtils.js";
import { WithMaybeMetadata } from "../../../src/clients/zodiosWithMetadataPatch.js";

describe("getProducerJWKByKid", () => {
  const mockKey = getMockProducerJWKKey();
  const mockProducerJWK: authorizationApi.ProducerJWK = {
    producerKeychainId: mockKey.producerKeychainId,
    jwk: {
      kid: mockKey.kid,
      kty: mockKey.kty,
      use: mockKey.use,
      alg: mockKey.alg,
      e: mockKey.e,
      n: mockKey.n,
    },
  };
  const expectedKey = testToM2MProducerKey(mockProducerJWK);
  const authProcessResponse: WithMaybeMetadata<authorizationApi.ProducerJWK> = {
    data: mockProducerJWK,
    metadata: undefined,
  };

  const mockGetProducerJWKByKid = vi
    .fn()
    .mockResolvedValue(authProcessResponse);

  mockInteropBeClients.authorizationClient = {
    key: {
      getProducerJWKByKid: mockGetProducerJWKByKid,
    },
  } as unknown as PagoPAInteropBeClients["authorizationClient"];

  beforeEach(() => {
    mockGetProducerJWKByKid.mockClear();
  });

  it("Should succeed and perform API clients calls", async () => {
    const result = await keyService.getProducerKey(
      unsafeBrandId(mockKey.kid),
      getMockM2MAdminAppContext()
    );

    expect(result).toStrictEqual(expectedKey);
    expectApiClientGetToHaveBeenCalledWith({
      mockGet: mockInteropBeClients.authorizationClient.key.getProducerJWKByKid,
      params: {
        kid: mockKey.kid,
      },
    });
  });
});
