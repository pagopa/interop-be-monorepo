import { describe, it, expect, vi, beforeEach } from "vitest";
import { m2mGatewayApiV3 } from "pagopa-interop-api-clients";
import {
  getMockWithMetadata,
  getMockedApiProducerJWK,
  getMockedApiKey,
} from "pagopa-interop-commons-test";
import { ProducerKeychainId, generateId } from "pagopa-interop-models";
import {
  producerKeychainService,
  expectApiClientGetToHaveBeenCalledWith,
  expectApiClientGetToHaveBeenNthCalledWith,
  mockInteropBeClients,
} from "../../integrationUtils.js";
import { PagoPAInteropBeClients } from "../../../src/clients/clientsProvider.js";
import { getMockM2MAdminAppContext } from "../../mockUtils.js";

describe("getProducerKeychainKeys", () => {
  const mockParams: m2mGatewayApiV3.GetProducerKeychainKeysQueryParams = {
    offset: 0,
    limit: 10,
  };

  const producerKeychainId = generateId<ProducerKeychainId>();
  const mockApiProducerKeychainJWK1 = getMockedApiProducerJWK({
    producerKeychainId,
  }).jwk;
  const mockApiProducerKeychainJWK2 = getMockedApiProducerJWK({
    producerKeychainId,
  }).jwk;
  const mockApiProducerKeychainJWKs = [
    mockApiProducerKeychainJWK1,
    mockApiProducerKeychainJWK2,
  ];

  const mockApiProducerKeychainKey1 = getMockedApiKey({
    kid: mockApiProducerKeychainJWK1.kid,
  });
  const mockApiProducerKeychainKey2 = getMockedApiKey({
    kid: mockApiProducerKeychainJWK2.kid,
  });
  const mockApiProducerKeychainKeys = [
    mockApiProducerKeychainKey1,
    mockApiProducerKeychainKey2,
  ];

  const mockGetProducerKeychainKeys = vi.fn().mockResolvedValue({
    data: {
      keys: mockApiProducerKeychainKeys,
      totalCount: mockApiProducerKeychainKeys.length,
    },
    metadata: undefined,
  });

  const mockGetProducerJWKByKid = vi.fn(({ params: { kid } }) => {
    const jwk = mockApiProducerKeychainJWKs.find((key) => key.kid === kid);
    if (jwk) {
      return Promise.resolve(getMockWithMetadata({ jwk }));
    }
    return Promise.reject(new Error("JWK not found"));
  });

  mockInteropBeClients.authorizationClient = {
    producerKeychain: {
      getProducerKeys: mockGetProducerKeychainKeys,
    },
    key: {
      getProducerJWKByKid: mockGetProducerJWKByKid,
    },
  } as unknown as PagoPAInteropBeClients["authorizationClient"];

  const expectedM2MJWK1: m2mGatewayApiV3.JWK = {
    kid: mockApiProducerKeychainJWK1.kid,
    kty: mockApiProducerKeychainJWK1.kty,
    "x5t#S256": mockApiProducerKeychainJWK1["x5t#S256"],
    alg: mockApiProducerKeychainJWK1.alg,
    crv: mockApiProducerKeychainJWK1.crv,
    d: mockApiProducerKeychainJWK1.d,
    dp: mockApiProducerKeychainJWK1.dp,
    dq: mockApiProducerKeychainJWK1.dq,
    e: mockApiProducerKeychainJWK1.e,
    k: mockApiProducerKeychainJWK1.k,
    key_ops: mockApiProducerKeychainJWK1.key_ops,
    n: mockApiProducerKeychainJWK1.n,
    oth: mockApiProducerKeychainJWK1.oth,
    p: mockApiProducerKeychainJWK1.p,
    q: mockApiProducerKeychainJWK1.q,
    qi: mockApiProducerKeychainJWK1.qi,
    use: mockApiProducerKeychainJWK1.use,
    x: mockApiProducerKeychainJWK1.x,
    x5c: mockApiProducerKeychainJWK1.x5c,
    x5t: mockApiProducerKeychainJWK1.x5t,
    x5u: mockApiProducerKeychainJWK1.x5u,
    y: mockApiProducerKeychainJWK1.y,
  };

  const expectedM2MJWK2: m2mGatewayApiV3.JWK = {
    kid: mockApiProducerKeychainJWK2.kid,
    kty: mockApiProducerKeychainJWK2.kty,
    "x5t#S256": mockApiProducerKeychainJWK2["x5t#S256"],
    alg: mockApiProducerKeychainJWK2.alg,
    crv: mockApiProducerKeychainJWK2.crv,
    d: mockApiProducerKeychainJWK2.d,
    dp: mockApiProducerKeychainJWK2.dp,
    dq: mockApiProducerKeychainJWK2.dq,
    e: mockApiProducerKeychainJWK2.e,
    k: mockApiProducerKeychainJWK2.k,
    key_ops: mockApiProducerKeychainJWK2.key_ops,
    n: mockApiProducerKeychainJWK2.n,
    oth: mockApiProducerKeychainJWK2.oth,
    p: mockApiProducerKeychainJWK2.p,
    q: mockApiProducerKeychainJWK2.q,
    qi: mockApiProducerKeychainJWK2.qi,
    use: mockApiProducerKeychainJWK2.use,
    x: mockApiProducerKeychainJWK2.x,
    x5c: mockApiProducerKeychainJWK2.x5c,
    x5t: mockApiProducerKeychainJWK2.x5t,
    x5u: mockApiProducerKeychainJWK2.x5u,
    y: mockApiProducerKeychainJWK2.y,
  };

  beforeEach(() => {
    mockGetProducerKeychainKeys.mockClear();
    mockGetProducerJWKByKid.mockClear();
  });

  it("Should succeed and perform API producerKeychains calls", async () => {
    const m2mProducerKeychainJWKsResponse: m2mGatewayApiV3.JWKs = {
      pagination: {
        limit: mockParams.limit,
        offset: mockParams.offset,
        totalCount: mockApiProducerKeychainKeys.length,
      },
      results: [expectedM2MJWK1, expectedM2MJWK2],
    };

    const result = await producerKeychainService.getProducerKeychainKeys(
      producerKeychainId,
      mockParams,
      getMockM2MAdminAppContext()
    );

    expect(result).toStrictEqual(m2mProducerKeychainJWKsResponse);

    expectApiClientGetToHaveBeenCalledWith({
      mockGet: mockGetProducerKeychainKeys,
      params: {
        producerKeychainId,
      },
      queries: mockParams,
    });
    mockApiProducerKeychainKeys.forEach((key, index) => {
      expectApiClientGetToHaveBeenNthCalledWith({
        nthCall: index + 1,
        mockGet: mockGetProducerJWKByKid,
        params: {
          kid: key.kid,
        },
      });
    });
  });
});
