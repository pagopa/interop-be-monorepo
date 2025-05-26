import { describe, it, expect, vi, beforeEach } from "vitest";
import { unsafeBrandId } from "pagopa-interop-models";
import { getMockProducerJWKKey } from "pagopa-interop-commons-test/index.js";
import { authorizationApi, m2mGatewayApi } from "pagopa-interop-api-clients";
import {
  expectApiClientGetToHaveBeenCalledWith,
  keysService,
  mockInteropBeClients,
} from "../../integrationUtils.js";
import { PagoPAInteropBeClients } from "../../../src/clients/clientsProvider.js";
import { getMockM2MAdminAppContext } from "../../mockUtils.js";
import { WithMaybeMetadata } from "../../../src/clients/zodiosWithMetadataPatch.js";

describe("getProducerJWKByKid", () => {
  const mockKey = getMockProducerJWKKey();
  const expectedKey: m2mGatewayApi.ProducerKey = {
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
  const authProcessResponse: WithMaybeMetadata<authorizationApi.ProducerJWK> = {
    data: expectedKey,
    metadata: undefined,
  };

  const mockGetProducerJWKByKid = vi
    .fn()
    .mockResolvedValue(authProcessResponse);

  mockInteropBeClients.authorizationClient = {
    keys: {
      getProducerJWKByKid: mockGetProducerJWKByKid,
    },
  } as unknown as PagoPAInteropBeClients["authorizationClient"];

  beforeEach(() => {
    mockGetProducerJWKByKid.mockClear();
  });

  it("Should succeed and perform API clients calls", async () => {
    const result = await keysService.getProducerKey(
      unsafeBrandId(mockKey.kid),
      getMockM2MAdminAppContext()
    );

    expect(result).toEqual(expectedKey);
    expectApiClientGetToHaveBeenCalledWith({
      mockGet:
        mockInteropBeClients.authorizationClient.keys.getProducerJWKByKid,
      params: {
        kid: mockKey.kid,
      },
    });
  });
});
