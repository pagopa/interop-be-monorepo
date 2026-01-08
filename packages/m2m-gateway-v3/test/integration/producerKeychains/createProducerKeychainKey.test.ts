import { describe, it, expect, vi, beforeEach } from "vitest";
import { m2mGatewayApiV3 } from "pagopa-interop-api-clients";
import {
  getMockWithMetadata,
  getMockedApiProducerJWK,
  getMockedApiKey,
} from "pagopa-interop-commons-test";
import { generateId, ProducerKeychainId } from "pagopa-interop-models";
import {
  producerKeychainService,
  expectApiClientGetToHaveBeenCalledWith,
  expectApiClientPostToHaveBeenCalledWith,
  mockInteropBeClients as mockInteropBeProducerKeychains,
} from "../../integrationUtils.js";
import { PagoPAInteropBeClients } from "../../../src/clients/clientsProvider.js";
import { getMockM2MAdminAppContext } from "../../mockUtils.js";

describe("createProducerKeychainKey", () => {
  const producerKeychainId = generateId<ProducerKeychainId>();
  const mockApiProducerKeychainJWK = getMockedApiProducerJWK({
    producerKeychainId,
  }).jwk;

  const mockApiProducerKeychainKey = getMockedApiKey({
    kid: mockApiProducerKeychainJWK.kid,
  });

  const mockCreateProducerKeychainKey = vi.fn().mockResolvedValue({
    data: mockApiProducerKeychainKey,
    metadata: undefined,
  });

  const mockGetJWKByKid = vi.fn(() =>
    Promise.resolve(getMockWithMetadata({ jwk: mockApiProducerKeychainJWK }))
  );

  mockInteropBeProducerKeychains.authorizationClient = {
    producerKeychain: { createProducerKey: mockCreateProducerKeychainKey },
    key: {
      getJWKByKid: mockGetJWKByKid,
    },
  } as unknown as PagoPAInteropBeClients["authorizationClient"];

  const keySeed: m2mGatewayApiV3.KeySeed = {
    name: "key seed",
    use: "ENC",
    key: `MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAsFakePem`,
    alg: "",
  };

  const expectedM2MJWK: m2mGatewayApiV3.JWK = {
    kid: mockApiProducerKeychainJWK.kid,
    kty: mockApiProducerKeychainJWK.kty,
    "x5t#S256": mockApiProducerKeychainJWK["x5t#S256"],
    alg: mockApiProducerKeychainJWK.alg,
    crv: mockApiProducerKeychainJWK.crv,
    d: mockApiProducerKeychainJWK.d,
    dp: mockApiProducerKeychainJWK.dp,
    dq: mockApiProducerKeychainJWK.dq,
    e: mockApiProducerKeychainJWK.e,
    k: mockApiProducerKeychainJWK.k,
    key_ops: mockApiProducerKeychainJWK.key_ops,
    n: mockApiProducerKeychainJWK.n,
    oth: mockApiProducerKeychainJWK.oth,
    p: mockApiProducerKeychainJWK.p,
    q: mockApiProducerKeychainJWK.q,
    qi: mockApiProducerKeychainJWK.qi,
    use: mockApiProducerKeychainJWK.use,
    x: mockApiProducerKeychainJWK.x,
    x5c: mockApiProducerKeychainJWK.x5c,
    x5t: mockApiProducerKeychainJWK.x5t,
    x5u: mockApiProducerKeychainJWK.x5u,
    y: mockApiProducerKeychainJWK.y,
  };

  beforeEach(() => {
    mockCreateProducerKeychainKey.mockClear();
    mockGetJWKByKid.mockClear();
  });

  it("Should succeed and perform API clients calls", async () => {
    const m2mClientJWKsResponse: m2mGatewayApiV3.JWK = expectedM2MJWK;

    const result = await producerKeychainService.createProducerKeychainKey(
      producerKeychainId,
      keySeed,
      getMockM2MAdminAppContext()
    );

    expect(result).toEqual(m2mClientJWKsResponse);

    expectApiClientPostToHaveBeenCalledWith({
      mockPost: mockCreateProducerKeychainKey,
      params: {
        producerKeychainId,
      },
      body: keySeed,
    });

    expectApiClientGetToHaveBeenCalledWith({
      mockGet: mockGetJWKByKid,
      params: {
        kid: mockApiProducerKeychainJWK.kid,
      },
    });
  });
});
