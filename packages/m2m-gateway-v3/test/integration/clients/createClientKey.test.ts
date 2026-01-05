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
  expectApiClientPostToHaveBeenCalledWith,
  mockInteropBeClients,
} from "../../integrationUtils.js";
import { PagoPAInteropBeClients } from "../../../src/clients/clientsProvider.js";
import { getMockM2MAdminAppContext } from "../../mockUtils.js";

describe("createClientKey", () => {
  const clientId = generateId<ClientId>();
  const mockApiClientJWK = getMockedApiClientJWK({ clientId }).jwk;

  const mockApiClientKey = getMockedApiKey({
    kid: mockApiClientJWK.kid,
  });

  const mockCreateClientKey = vi.fn().mockResolvedValue({
    data: mockApiClientKey,
    metadata: undefined,
  });

  const mockGetJWKByKid = vi.fn(() =>
    Promise.resolve(getMockWithMetadata({ jwk: mockApiClientJWK }))
  );

  mockInteropBeClients.authorizationClient = {
    client: {
      createKey: mockCreateClientKey,
    },
    key: {
      getJWKByKid: mockGetJWKByKid,
    },
  } as unknown as PagoPAInteropBeClients["authorizationClient"];

  const keySeed: m2mGatewayApiV3.JWKSeed = {
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

    expect(result).toEqual(m2mClientJWKsResponse);

    expectApiClientPostToHaveBeenCalledWith({
      mockPost: mockCreateClientKey,
      params: {
        clientId,
      },
      body: keySeed,
    });
    expectApiClientGetToHaveBeenCalledWith({
      mockGet: mockGetJWKByKid,
      params: {
        kid: mockApiClientJWK.kid,
      },
    });
  });
});
