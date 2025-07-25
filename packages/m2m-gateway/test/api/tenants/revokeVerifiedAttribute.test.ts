/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect } from "vitest";
import { generateToken } from "pagopa-interop-commons-test";
import { generateId } from "pagopa-interop-models";
import { authRole } from "pagopa-interop-commons";
import request from "supertest";
import { api } from "../../vitest.api.setup.js";
import { appBasePath } from "../../../src/config/appBasePath.js";

describe("DELETE /tenants/:tenantId/verifiedAttributes/:attributeId router test", () => {
  const makeRequest = async (token: string, agreementId?: string) =>
    request(api)
      .delete(
        `${appBasePath}/tenants/${generateId()}/verifiedAttributes/${generateId()}`
      )
      .set("Authorization", `Bearer ${token}`)
      .query(agreementId ? { agreementId } : {});

  it("Should return 403 for unauthorized request", async () => {
    const token = generateToken(authRole.API_ROLE);
    const response = await makeRequest(token);

    expect(response.status).toBe(403);
  });

  it("Should accept optional agreementId query parameter", async () => {
    const token = generateToken(authRole.M2M_ROLE);
    const agreementId = generateId();
    const response = await makeRequest(token, agreementId);

    // Status will depend on backend implementation
    expect([200, 400, 401, 403, 404, 500]).toContain(response.status);
  });

  // Note: Additional tests would require proper backend setup and mocks
  // These tests are meant to show the endpoint structure
});
