/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { ClientId, generateId } from "pagopa-interop-models";
import { generateToken } from "pagopa-interop-commons-test";
import { authRole } from "pagopa-interop-commons";
import request from "supertest";
import { api, services } from "../../vitest.api.setup.js";
import { appBasePath } from "../../../src/config/appBasePath.js";
import { getMockBffApiClient } from "../../mockUtils.js";

describe("API GET /clients/:clientId", () => {
  const mockApiClient = getMockBffApiClient();

  beforeEach(() => {
    services.clientService.getClientById = vi
      .fn()
      .mockResolvedValue(mockApiClient);
  });

  const makeRequest = async (
    token: string,
    clientId: ClientId = mockApiClient.id
  ) =>
    request(api)
      .get(`${appBasePath}/clients/${clientId}`)
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId());

  it("Should return 200 for user with role Admin", async () => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toBe(200);
    expect(res.body).toEqual(mockApiClient);
  });

  it("Should return 400 if passed an client purpose id", async () => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token, "invalid" as ClientId);
    expect(res.status).toBe(400);
  });
});
