/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect } from "vitest";
import { generateToken } from "pagopa-interop-commons-test";
import { generateId } from "pagopa-interop-models";
import { authRole } from "pagopa-interop-commons";
import request from "supertest";
import { api } from "../../vitest.api.setup.js";
import { appBasePath } from "../../../src/config/appBasePath.js";

describe("POST /tenants/:tenantId/verifiedAttributes router test", () => {
  const makeRequest = async (token: string, body?: object) =>
    request(api)
      .post(`${appBasePath}/tenants/${generateId()}/verifiedAttributes`)
      .set("Authorization", `Bearer ${token}`)
      .send(body || { id: generateId() });

  it("Should return 403 for unauthorized request", async () => {
    const token = generateToken(authRole.API_ROLE);
    const response = await makeRequest(token);

    expect(response.status).toBe(403);
  });

  it("Should return 400 for invalid request body", async () => {
    const token = generateToken(authRole.M2M_ROLE);
    const response = await makeRequest(token, { invalid: "body" });

    expect(response.status).toBe(400);
  });

  // Note: Additional tests would require proper backend setup and mocks
  // These tests are meant to show the endpoint structure
});
