/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { authRole } from "pagopa-interop-commons";
import { generateToken } from "pagopa-interop-commons-test";
import { ClientId, generateId } from "pagopa-interop-models";
import request from "supertest";
import { describe, it, expect, vi, beforeEach } from "vitest";

import { appBasePath } from "../../../src/config/appBasePath.js";
import { clientNotFound } from "../../../src/model/errors.js";
import { getMockBffApiClient } from "../../mockUtils.js";
import { api, services } from "../../vitest.api.setup.js";

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

  it("Should return 404 if client is not visible to the caller", async () => {
    services.clientService.getClientById = vi
      .fn()
      .mockRejectedValue(clientNotFound(mockApiClient.id));

    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token);

    expect(res.status).toBe(404);
  });
});
