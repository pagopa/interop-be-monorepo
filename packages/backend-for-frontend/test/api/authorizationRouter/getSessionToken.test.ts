/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { generateId } from "pagopa-interop-models";
import { generateToken } from "pagopa-interop-commons-test";
import { authRole } from "pagopa-interop-commons";
import request from "supertest";
import { bffApi } from "pagopa-interop-api-clients";
import { api, services } from "../../vitest.api.setup.js";
import { appBasePath } from "../../../src/config/appBasePath.js";
import {
  getMockGetSessionTokenReturnType,
  getMockBffApiIdentityToken,
} from "../../mockUtils.js";

describe("API POST /session/tokens", () => {
  const mockIdentityToken = getMockBffApiIdentityToken();
  const mockServiceResponse = getMockGetSessionTokenReturnType();

  beforeEach(() => {
    services.authorizationService.getSessionToken = vi
      .fn()
      .mockResolvedValue(mockServiceResponse);
  });

  const makeRequest = async (
    token: string,
    body: bffApi.IdentityToken = mockIdentityToken
  ) =>
    request(api)
      .post(`${appBasePath}/session/tokens`)
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .send(body);

  it("Should return 200 for user with role Admin", async () => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toBe(200);
    expect(res.body).toEqual(mockServiceResponse.sessionToken);
  });

  it("Should return 500 for too many requests", async () => {
    services.authorizationService.getSessionToken = vi.fn().mockResolvedValue({
      ...mockServiceResponse,
      limitReached: true,
      rateLimitedTenantId: generateId(),
    });
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toBe(500);
  });

  it.each([{ body: {} }, { body: { ...mockIdentityToken, extraField: 1 } }])(
    "Should return 400 if passed invalid data: %s",
    async ({ body }) => {
      const token = generateToken(authRole.ADMIN_ROLE);
      const res = await makeRequest(token, body as bffApi.IdentityToken);
      expect(res.status).toBe(400);
    }
  );
});
