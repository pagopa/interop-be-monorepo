/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect, vi } from "vitest";
import { generateId } from "pagopa-interop-models";
import { generateToken } from "pagopa-interop-commons-test";
import { AuthRole, authRole } from "pagopa-interop-commons";
import request from "supertest";
import { api, mockTenantService } from "../../vitest.api.setup.js";
import { appBasePath } from "../../../src/config/appBasePath.js";
import {
  missingMetadata,
  resourcePollingTimeout,
} from "../../../src/model/errors.js";

describe("DELETE /tenants/:tenantId/certifiedAttributes/:attributeId router test", () => {
  const makeRequest = async (token: string) =>
    request(api)
      .delete(
        `${appBasePath}/tenants/${generateId()}/certifiedAttributes/${generateId()}`
      )
      .set("Authorization", `Bearer ${token}`);

  const authorizedRoles: AuthRole[] = [authRole.M2M_ADMIN_ROLE];
  it.each(authorizedRoles)(
    "Should return 204 and perform API clients calls for user with role %s",
    async (role) => {
      mockTenantService.revokeCertifiedAttribute = vi.fn();

      const token = generateToken(role);
      const res = await makeRequest(token);

      expect(res.status).toBe(204);
    }
  );

  it.each(
    Object.values(authRole).filter((role) => !authorizedRoles.includes(role))
  )("Should return 403 for user with role %s", async (role) => {
    const token = generateToken(role);
    const res = await makeRequest(token);
    expect(res.status).toBe(403);
  });

  it("Should return 500 in case of missingMetadata error", async () => {
    mockTenantService.revokeCertifiedAttribute = vi
      .fn()
      .mockRejectedValue(missingMetadata());
    const token = generateToken(authRole.M2M_ADMIN_ROLE);
    const res = await makeRequest(token);

    expect(res.status).toBe(500);
  });

  it("Should return 500 in case of resourcePollingTimeout error", async () => {
    mockTenantService.revokeCertifiedAttribute = vi
      .fn()
      .mockRejectedValue(resourcePollingTimeout(3));
    const token = generateToken(authRole.M2M_ADMIN_ROLE);
    const res = await makeRequest(token);

    expect(res.status).toBe(500);
  });
});
