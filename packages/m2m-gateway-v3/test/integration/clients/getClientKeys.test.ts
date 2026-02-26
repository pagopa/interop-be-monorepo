import { describe, it, expect, vi, beforeEach } from "vitest";
import { m2mGatewayApiV3 } from "pagopa-interop-api-clients";
import {
  getMockWithMetadata,
  getMockedApiClientJWK,
  getMockedApiKey,
} from "pagopa-interop-commons-test";
import { ClientId, generateId } from "pagopa-interop-models";
import {
  clientService,
  expectApiClientGetToHaveBeenCalledWith,
  expectApiClientGetToHaveBeenNthCalledWith,
  mockInteropBeClients,
} from "../../integrationUtils.js";
import { PagoPAInteropBeClients } from "../../../src/clients/clientsProvider.js";
import { getMockM2MAdminAppContext } from "../../mockUtils.js";

describe("getClientKeys", () => {
  const mockParams: m2mGatewayApiV3.GetClientKeysQueryParams = {
    offset: 0,
    limit: 10,
  };

  const clientId = generateId<ClientId>();
  const mockApiClientJWK1 = getMockedApiClientJWK({ clientId }).jwk;
  const mockApiClientJWK2 = getMockedApiClientJWK({ clientId }).jwk;
  const mockApiClientJWKs = [mockApiClientJWK1, mockApiClientJWK2];

  const mockApiClientKey1 = getMockedApiKey({
    kid: mockApiClientJWK1.kid,
  });
  const mockApiClientKey2 = getMockedApiKey({
    kid: mockApiClientJWK2.kid,
  });
  const mockApiClientKeys = [mockApiClientKey1, mockApiClientKey2];

  const mockGetClientKeys = vi.fn().mockResolvedValue({
    data: {
      keys: mockApiClientKeys,
      totalCount: mockApiClientKeys.length,
    },
    metadata: undefined,
  });

  const mockGetJWKByKid = vi.fn(({ params: { kid } }) => {
    const jwk = mockApiClientJWKs.find((key) => key.kid === kid);
    if (jwk) {
      return Promise.resolve(getMockWithMetadata({ jwk }));
    }
    return Promise.reject(new Error("JWK not found"));
  });

  mockInteropBeClients.authorizationClient = {
    client: {
      getClientKeys: mockGetClientKeys,
    },
    key: {
      getJWKByKid: mockGetJWKByKid,
    },
  } as unknown as PagoPAInteropBeClients["authorizationClient"];

  const expectedM2MJWK1: m2mGatewayApiV3.JWK = {
    kid: mockApiClientJWK1.kid,
    kty: mockApiClientJWK1.kty,
    "x5t#S256": mockApiClientJWK1["x5t#S256"],
    alg: mockApiClientJWK1.alg,
    crv: mockApiClientJWK1.crv,
    d: mockApiClientJWK1.d,
    dp: mockApiClientJWK1.dp,
    dq: mockApiClientJWK1.dq,
    e: mockApiClientJWK1.e,
    k: mockApiClientJWK1.k,
    key_ops: mockApiClientJWK1.key_ops,
    n: mockApiClientJWK1.n,
    oth: mockApiClientJWK1.oth,
    p: mockApiClientJWK1.p,
    q: mockApiClientJWK1.q,
    qi: mockApiClientJWK1.qi,
    use: mockApiClientJWK1.use,
    x: mockApiClientJWK1.x,
    x5c: mockApiClientJWK1.x5c,
    x5t: mockApiClientJWK1.x5t,
    x5u: mockApiClientJWK1.x5u,
    y: mockApiClientJWK1.y,
  };

  const expectedM2MJWK2: m2mGatewayApiV3.JWK = {
    kid: mockApiClientJWK2.kid,
    kty: mockApiClientJWK2.kty,
    "x5t#S256": mockApiClientJWK2["x5t#S256"],
    alg: mockApiClientJWK2.alg,
    crv: mockApiClientJWK2.crv,
    d: mockApiClientJWK2.d,
    dp: mockApiClientJWK2.dp,
    dq: mockApiClientJWK2.dq,
    e: mockApiClientJWK2.e,
    k: mockApiClientJWK2.k,
    key_ops: mockApiClientJWK2.key_ops,
    n: mockApiClientJWK2.n,
    oth: mockApiClientJWK2.oth,
    p: mockApiClientJWK2.p,
    q: mockApiClientJWK2.q,
    qi: mockApiClientJWK2.qi,
    use: mockApiClientJWK2.use,
    x: mockApiClientJWK2.x,
    x5c: mockApiClientJWK2.x5c,
    x5t: mockApiClientJWK2.x5t,
    x5u: mockApiClientJWK2.x5u,
    y: mockApiClientJWK2.y,
  };

  beforeEach(() => {
    mockGetClientKeys.mockClear();
    mockGetJWKByKid.mockClear();
  });

  it("Should succeed and perform API clients calls", async () => {
    const m2mClientJWKsResponse: m2mGatewayApiV3.JWKs = {
      pagination: {
        limit: mockParams.limit,
        offset: mockParams.offset,
        totalCount: mockApiClientKeys.length,
      },
      results: [expectedM2MJWK1, expectedM2MJWK2],
    };

    const result = await clientService.getClientKeys(
      clientId,
      mockParams,
      getMockM2MAdminAppContext()
    );

    expect(result).toStrictEqual(m2mClientJWKsResponse);

    expectApiClientGetToHaveBeenCalledWith({
      mockGet: mockGetClientKeys,
      params: {
        clientId,
      },
      queries: mockParams,
    });
    mockApiClientKeys.forEach((key, index) => {
      expectApiClientGetToHaveBeenNthCalledWith({
        nthCall: index + 1,
        mockGet: mockGetJWKByKid,
        params: {
          kid: key.kid,
        },
      });
    });
  });
});
