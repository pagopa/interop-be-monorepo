import { describe, it, expect, vi, beforeEach } from "vitest";
import { unsafeBrandId } from "pagopa-interop-models";
import { getMockClientJWKKey } from "pagopa-interop-commons-test/index.js";
import { m2mGatewayApi } from "pagopa-interop-api-clients";
import {
  expectApiClientGetToHaveBeenCalledWith,
  keysService,
  mockInteropBeClients,
} from "../../integrationUtils.js";
import { PagoPAInteropBeClients } from "../../../src/clients/clientsProvider.js";
import { getMockM2MAdminAppContext } from "../../mockUtils.js";

describe("getJWKByKid", () => {
  const mockKey = getMockClientJWKKey();

  const mockGetJWKByKid = vi.fn().mockResolvedValue(mockKey);

  mockInteropBeClients.authorizationClient = {
    keys: {
      getJWKByKid: mockGetJWKByKid,
    },
  } as unknown as PagoPAInteropBeClients["authorizationClient"];

  beforeEach(() => {
    mockGetJWKByKid.mockClear();
  });

  it("Should succeed and perform API clients calls", async () => {
    const expectedKey: m2mGatewayApi.Key = {
      clientId: mockKey.clientId,
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
      mockGet: mockInteropBeClients.authorizationClient.keys.getJWKByKid,
      params: {
        kid: mockKey.kid,
      },
    });
  });
});
