/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { ClientId, generateId } from "pagopa-interop-models";
import { generateToken } from "pagopa-interop-commons-test";
import { authRole } from "pagopa-interop-commons";
import request from "supertest";
import { api, clients } from "../../vitest.api.setup.js";
import { appBasePath } from "../../../src/config/appBasePath.js";
import {
  getMockAuthorizationApiKey,
  getMockBffApiEncodedClientKey,
} from "../../mockUtils.js";

describe("API GET /clients/:clientId/encoded/keys/:keyId", () => {
  const mockKeyId = generateId();
  const mockKey = getMockAuthorizationApiKey();
  const mockApiEncodedClientKey = getMockBffApiEncodedClientKey(
    mockKey.encodedPem
  );

  beforeEach(() => {
    clients.authorizationClient.client.getClientKeyById = vi
      .fn()
      .mockResolvedValue(mockKey);
  });

  const makeRequest = async (
    token: string,
    clientId: ClientId = generateId(),
    keyId: string = mockKeyId
  ) =>
    request(api)
      .get(`${appBasePath}/clients/${clientId}/encoded/keys/${keyId}`)
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId());

  it("Should return 200 for user with role Admin", async () => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toBe(200);
    expect(res.body).toEqual(mockApiEncodedClientKey);
  });

  it("Should return 400 if passed an invalid client id", async () => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token, "invalid" as ClientId);
    expect(res.status).toBe(400);
  });
});
