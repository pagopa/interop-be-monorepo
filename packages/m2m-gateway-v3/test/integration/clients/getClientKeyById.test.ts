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
  mockInteropBeClients,
} from "../../integrationUtils.js";
import { PagoPAInteropBeClients } from "../../../src/clients/clientsProvider.js";
import { getMockM2MAdminAppContext } from "../../mockUtils.js";

describe("getClientKeyById", () => {
  const clientId = generateId<ClientId>();
  const mockApiClientJWK = getMockedApiClientJWK({ clientId }).jwk;

  const mockApiClientKey = getMockedApiKey({
    kid: mockApiClientJWK.kid,
  });

  const mockGetClientKeyById = vi.fn().mockResolvedValue({
    data: mockApiClientKey,
    metadata: undefined,
  });

  const mockGetJWKByKid = vi.fn(() => {
    const jwk = mockApiClientJWK;
    if (jwk) {
      return Promise.resolve(getMockWithMetadata({ jwk }));
    }
    return Promise.reject(new Error("JWK not found"));
  });

  mockInteropBeClients.authorizationClient = {
    client: {
      getClientKeyById: mockGetClientKeyById,
    },
    key: {
      getJWKByKid: mockGetJWKByKid,
    },
  } as unknown as PagoPAInteropBeClients["authorizationClient"];

  const m2mClientJWKResponse: m2mGatewayApiV3.JWK = {
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
    mockGetClientKeyById.mockClear();
    mockGetJWKByKid.mockClear();
  });

  it("Should succeed and perform API clients calls", async () => {
    const result = await clientService.getClientKeyById(
      clientId,
      mockApiClientJWK.kid,
      getMockM2MAdminAppContext()
    );

    expect(result).toEqual(m2mClientJWKResponse);

    expectApiClientGetToHaveBeenCalledWith({
      mockGet: mockGetClientKeyById,
      params: {
        clientId,
        keyId: mockApiClientJWK.kid,
      },
    });

    expectApiClientGetToHaveBeenCalledWith({
      mockGet: mockGetJWKByKid,
      params: {
        kid: mockApiClientJWK.kid,
      },
    });
  });
});
