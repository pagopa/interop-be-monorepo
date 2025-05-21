/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { ClientId, generateId } from "pagopa-interop-models";
import { generateToken } from "pagopa-interop-commons-test";
import { authRole } from "pagopa-interop-commons";
import request from "supertest";
import { bffApi } from "pagopa-interop-api-clients";
import { api, services } from "../../vitest.api.setup.js";
import { appBasePath } from "../../../src/config/appBasePath.js";
import { getMockApiPublicKey } from "../../mockUtils.js";

describe("API GET /clients/:clientId/keys", () => {
  const mockClientId = generateId<ClientId>();
  const mockApiPublicKey1 = getMockApiPublicKey();
  const mockApiPublicKey2 = getMockApiPublicKey();
  const mockApiPublicKey3 = getMockApiPublicKey();
  const mockApiPublicKeys: bffApi.PublicKeys = {
    keys: [mockApiPublicKey1, mockApiPublicKey2, mockApiPublicKey3],
    pagination: {
      offset: 0,
      limit: 10,
      totalCount: 3,
    },
  };

  const makeRequest = async (token: string, limit: unknown = 10) =>
    request(api)
      .get(`${appBasePath}/clients/${mockClientId}/keys`)
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .query({ offset: 0, limit });

  beforeEach(() => {
    services.clientService.getClientKeys = vi
      .fn()
      .mockResolvedValue(mockApiPublicKeys);
  });

  it("Should return 200 for user with role Admin", async () => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toBe(200);
    expect(res.body).toEqual(mockApiPublicKeys);
  });

  it("Should return 400 if passed an invalid purpose id", async () => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token, "invalid");
    expect(res.status).toBe(400);
  });
});
