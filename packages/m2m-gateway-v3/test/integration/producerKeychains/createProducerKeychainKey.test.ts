import { describe, it, expect, vi, beforeEach } from "vitest";
import { m2mGatewayApiV3 } from "pagopa-interop-api-clients";
import {
  getMockWithMetadata,
  getMockedApiFullProducerKeychain,
  getMockedApiKey,
  getMockedApiProducerJWK,
} from "pagopa-interop-commons-test";
import { ProducerKeychainId, generateId } from "pagopa-interop-models";
import {
  expectApiClientGetToHaveBeenCalledWith,
  expectApiClientPostToHaveBeenCalledWith,
  mockInteropBeClients,
  producerKeychainService,
  mockPollingResponse,
} from "../../integrationUtils.js";
import { getMockM2MAdminAppContext } from "../../mockUtils.js";
import { PagoPAInteropBeClients } from "../../../src/clients/clientsProvider.js";

describe("createProducerKeychainKey", () => {
  const producerKeychainId = generateId<ProducerKeychainId>();
  const mockApiProducerKeychainJWK = getMockedApiProducerJWK({
    producerKeychainId,
  }).jwk;

  const mockApiProducerKeychainKey = getMockWithMetadata(
    getMockedApiKey({
      kid: mockApiProducerKeychainJWK.kid,
    })
  );

  const mockApiProducerKeychain = getMockedApiFullProducerKeychain();
  const mockApiProducerKeychainWithMetadata = getMockWithMetadata(
    mockApiProducerKeychain
  );

  mockApiProducerKeychainWithMetadata.metadata.version =
    mockApiProducerKeychainKey.metadata.version + 1;

  const mockGetJWKByKid = vi.fn(() =>
    Promise.resolve(getMockWithMetadata({ jwk: mockApiProducerKeychainJWK }))
  );

  const mockCreateProducerKeychainKey = vi
    .fn()
    .mockResolvedValue(mockApiProducerKeychainKey);

  const mockGetProducerKeychain = vi.fn();

  mockInteropBeClients.authorizationClient = {
    producerKeychain: {
      createProducerKey: mockCreateProducerKeychainKey,
      getProducerKeychain: mockGetProducerKeychain,
    },
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
    vi.clearAllMocks();
    mockGetProducerKeychain.mockImplementation(
      mockPollingResponse(mockApiProducerKeychainWithMetadata, 1)
    );
  });

  it("Should succeed and perform API producerKeychains calls", async () => {
    const result = await producerKeychainService.createProducerKeychainKey(
      producerKeychainId,
      keySeed,
      getMockM2MAdminAppContext()
    );

    expect(result).toEqual({ jwk: expectedM2MJWK, producerKeychainId });

    expectApiClientPostToHaveBeenCalledWith({
      mockPost: mockCreateProducerKeychainKey,
      params: {
        producerKeychainId,
      },
      body: keySeed,
    });

    expect(mockGetProducerKeychain).toHaveBeenCalledTimes(2);

    expectApiClientGetToHaveBeenCalledWith({
      mockGet: mockGetProducerKeychain,
      params: {
        producerKeychainId,
      },
    });

    expectApiClientGetToHaveBeenCalledWith({
      mockGet: mockGetJWKByKid,
      params: {
        kid: mockApiProducerKeychainJWK.kid,
      },
    });
  });
});
