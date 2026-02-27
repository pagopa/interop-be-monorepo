import { describe, it, expect, vi, beforeEach } from "vitest";
import { authorizationApi, m2mGatewayApiV3 } from "pagopa-interop-api-clients";
import {
  getMockWithMetadata,
  getMockedApiClientJWK,
  getMockedApiConsumerFullClient,
  getMockedApiKey,
} from "pagopa-interop-commons-test";
import { ClientId, generateId } from "pagopa-interop-models";
import {
  clientService,
  expectApiClientGetToHaveBeenCalledWith,
  expectApiClientPostToHaveBeenCalledWith,
  mockInteropBeClients,
} from "../../integrationUtils.js";
import { PagoPAInteropBeClients } from "../../../src/clients/clientsProvider.js";
import { getMockM2MAdminAppContext } from "../../mockUtils.js";

describe("createClientKey", () => {
  const clientId = generateId<ClientId>();
  const mockApiClientJWK = getMockedApiClientJWK({ clientId }).jwk;

  const mockApiClientKey = getMockWithMetadata(
    getMockedApiKey({
      kid: mockApiClientJWK.kid,
    })
  );

  const mockApiClient = getMockedApiConsumerFullClient({
    kind: authorizationApi.ClientKind.Values.CONSUMER,
  });

  const mockGetJWKByKid = vi.fn(() =>
    Promise.resolve(getMockWithMetadata({ jwk: mockApiClientJWK }))
  );

  const mockApiClientWithMetadata = getMockWithMetadata(mockApiClient);

  const mockCreateClientKey = vi.fn().mockResolvedValue(mockApiClientKey);

  const mockGetClient = vi.fn().mockResolvedValue(mockApiClientWithMetadata);

  mockInteropBeClients.authorizationClient = {
    client: {
      createKey: mockCreateClientKey,
      getClient: mockGetClient,
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
    kid: mockApiClientJWK.kid,
    kty: mockApiClientJWK.kty,
    "x5t#S256": mockApiClientJWK["x5t#S256"],
    alg: mockApiClientJWK.alg,
    crv: mockApiClientJWK.crv,
    d: mockApiClientJWK.d,
    dp: mockApiClientJWK.dp,
    dq: mockApiClientJWK.dq,
    e: mockApiClientJWK.e,
    k: mockApiClientJWK.k,
    key_ops: mockApiClientJWK.key_ops,
    n: mockApiClientJWK.n,
    oth: mockApiClientJWK.oth,
    p: mockApiClientJWK.p,
    q: mockApiClientJWK.q,
    qi: mockApiClientJWK.qi,
    use: mockApiClientJWK.use,
    x: mockApiClientJWK.x,
    x5c: mockApiClientJWK.x5c,
    x5t: mockApiClientJWK.x5t,
    x5u: mockApiClientJWK.x5u,
    y: mockApiClientJWK.y,
  };

  beforeEach(() => {
    mockCreateClientKey.mockClear();
    mockGetJWKByKid.mockClear();
  });

  it("Should succeed and perform API clients calls", async () => {
    const m2mClientJWKsResponse: m2mGatewayApiV3.JWK = expectedM2MJWK;

    const result = await clientService.createClientKey(
      clientId,
      keySeed,
      getMockM2MAdminAppContext()
    );

    expect(result).toEqual({ jwk: m2mClientJWKsResponse, clientId });

    // Create
    expectApiClientPostToHaveBeenCalledWith({
      mockPost: mockCreateClientKey,
      params: {
        clientId,
      },
      body: keySeed,
    });

    // Polling
    expectApiClientGetToHaveBeenCalledWith({
      mockGet: mockGetClient,
      params: {
        clientId,
      },
    });

    // JWK
    expectApiClientGetToHaveBeenCalledWith({
      mockGet: mockGetJWKByKid,
      params: {
        kid: mockApiClientJWK.kid,
      },
    });
  });
});
