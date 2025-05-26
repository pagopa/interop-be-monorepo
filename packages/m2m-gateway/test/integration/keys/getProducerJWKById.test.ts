import { describe, it, expect, vi, beforeEach } from "vitest";
import { unsafeBrandId } from "pagopa-interop-models";
import {
  getMockM2MAdminAppContext,
  getMockProducerJWKKey,
} from "pagopa-interop-commons-test/index.js";
import { m2mGatewayApi } from "pagopa-interop-api-clients";
import {
  expectApiClientGetToHaveBeenCalledWith,
  keysService,
  mockInteropBeClients,
} from "../../integrationUtils.js";
import { PagoPAInteropBeClients } from "../../../src/clients/clientsProvider.js";

describe("getProducerJWKByKid", () => {
  const mockKey = getMockProducerJWKKey();

  const mockGetProducerJWKByKid = vi.fn().mockResolvedValue(mockKey);

  mockInteropBeClients.authorizationClient = {
    keys: {
      getProducerJWKByKid: mockGetProducerJWKByKid,
    },
  } as unknown as PagoPAInteropBeClients["authorizationClient"];

  beforeEach(() => {
    mockGetProducerJWKByKid.mockClear();
  });

  it("Should succeed and perform API clients calls", async () => {
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

    const result = await keysService.getKey(
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
