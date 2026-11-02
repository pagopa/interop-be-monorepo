/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { bffApi } from "pagopa-interop-api-clients";
import { authRole } from "pagopa-interop-commons";
import { generateToken } from "pagopa-interop-commons-test";
import { ClientId, generateId } from "pagopa-interop-models";
import request from "supertest";
import { describe, it, expect, vi, beforeEach } from "vitest";

import { appBasePath } from "../../../src/config/appBasePath.js";
import { userNotFound } from "../../../src/model/errors.js";
import { getMockBffApiCompactUser } from "../../mockUtils.js";
import { api, services } from "../../vitest.api.setup.js";

describe("API GET /clients/:clientId/users", () => {
  const mockResponse: bffApi.CompactUsers = [
    getMockBffApiCompactUser(),
    getMockBffApiCompactUser(),
    getMockBffApiCompactUser(),
  ];

  beforeEach(() => {
    services.clientService.getClientUsers = vi
      .fn()
      .mockResolvedValue(mockResponse);
  });

  const makeRequest = async (
    token: string,
    clientId: ClientId = generateId()
  ) =>
    request(api)
      .get(`${appBasePath}/clients/${clientId}/users`)
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId());

  it("Should return 200 for user with role Admin", async () => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toBe(200);
    expect(res.body).toEqual(mockResponse);
  });

  it("Should return 404 for userNotFound", async () => {
    services.clientService.getClientUsers = vi
      .fn()
      .mockRejectedValue(userNotFound(generateId(), generateId()));
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toBe(404);
  });

  it("Should return 400 if passed an invalid client id", async () => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token, "invalid" as ClientId);
    expect(res.status).toBe(400);
  });
});
