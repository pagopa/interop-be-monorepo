import { describe, it, expect, vi, beforeEach } from "vitest";
import { unsafeBrandId } from "pagopa-interop-models";
import { getMockClientJWKKey } from "pagopa-interop-commons-test/index.js";
import { authorizationApi, m2mGatewayApiV3 } from "pagopa-interop-api-clients";
import {
  expectApiClientGetToHaveBeenCalledWith,
  keyService,
  mockInteropBeClients,
} from "../../integrationUtils.js";
import { PagoPAInteropBeClients } from "../../../src/clients/clientsProvider.js";
import { getMockM2MAdminAppContext } from "../../mockUtils.js";
import { WithMaybeMetadata } from "../../../src/clients/zodiosWithMetadataPatch.js";

describe("getJWKByKid", () => {
  const mockKey = getMockClientJWKKey();
  const expectedKey: m2mGatewayApiV3.Key = {
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
  const authProcessResponse: WithMaybeMetadata<authorizationApi.ClientJWK> = {
    data: expectedKey,
    metadata: undefined,
  };

  const mockGetJWKByKid = vi.fn().mockResolvedValue(authProcessResponse);

  mockInteropBeClients.authorizationClient = {
    key: {
      getJWKByKid: mockGetJWKByKid,
    },
  } as unknown as PagoPAInteropBeClients["authorizationClient"];

  beforeEach(() => {
    mockGetJWKByKid.mockClear();
  });

  it("Should succeed and perform API clients calls", async () => {
    const result = await keyService.getKey(
      unsafeBrandId(mockKey.kid),
      getMockM2MAdminAppContext()
    );

    expect(result).toEqual(expectedKey);
    expectApiClientGetToHaveBeenCalledWith({
      mockGet: mockInteropBeClients.authorizationClient.key.getJWKByKid,
      params: {
        kid: mockKey.kid,
      },
    });
  });
});
