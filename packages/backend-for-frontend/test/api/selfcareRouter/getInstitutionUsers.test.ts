import request from "supertest";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { api, services } from "../../vitest.api.setup.js";
import { bffApi } from "pagopa-interop-api-clients";
import { generateId, TenantId } from "pagopa-interop-models";
import { authRole } from "pagopa-interop-commons";
import { generateToken } from "pagopa-interop-commons-test";
import { appBasePath } from "../../../src/config/appBasePath.js";

describe("GET /tenants/:tenantId/users", () => {
const validTenantId: TenantId = generateId();
const defaultQuery = {
  personId: generateId(),
  roles: ["ADMIN_EA"],
  query: "Test",
};

const mockUserResource: bffApi.Users = [
    {
    name: "Test",
    tenantId: validTenantId,
    userId: defaultQuery.personId,
    familyName: "User",
    roles: ["ADMIN_EA", "MANAGER"],
}
]

  beforeEach(() => {
    services.selfcareService.getInstitutionUsers = vi
      .fn()
      .mockResolvedValue(mockUserResource);
  });

const makeRequest = async (
  token: string,
  tenantId: TenantId,
  query: typeof defaultQuery = defaultQuery
) =>
  request(api)
    .get(`${appBasePath}/tenants/${tenantId}/users`)
    .set("Authorization", `Bearer ${token}`)
    .query(query);


  it("should return 200 and a list of users", async () => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token, validTenantId);
    expect(res.status).toBe(200);
    expect(res.body).toEqual(mockUserResource);
  });

  it.each([
    { tenantId: validTenantId, query: { personId: "not-a-uuid" } },
    { tenantId: validTenantId, query: { ...defaultQuery, roles: [123] } },
    { tenantId: validTenantId, query: { ...defaultQuery, personId: 123 } },
    { tenantId: "invalid-tenant-id" as TenantId, query: defaultQuery },
  ])("Should return 400 for invalid query: %s", async ({ tenantId, query }) => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token, tenantId, query as typeof defaultQuery);
    expect(res.status).toBe(400);
  });
});

