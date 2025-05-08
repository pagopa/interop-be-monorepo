/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { generateId } from "pagopa-interop-models";
import { generateToken, getMockTenant } from "pagopa-interop-commons-test";
import { AuthRole, authRole } from "pagopa-interop-commons";
import request from "supertest";
import { eserviceTemplateApi } from "pagopa-interop-api-clients";
import { api, eserviceTemplateService } from "../vitest.api.setup.js";

describe("API GET /creators", () => {
  const mockEserviceTemplate: eserviceTemplateApi.CompactOrganization[] = [
    eserviceTemplateApi.CompactOrganization.strip().parse(getMockTenant()),
  ];

  const mockEserviceTemplateCreatorsResult = {
    results: mockEserviceTemplate,
    totalCount: 1,
  };

  const makeRequest = async (
    token: string,
    queryParams: Record<string, unknown> = {
      limit: 10,
      offset: 0,
    }
  ) =>
    request(api)
      .get("/creators")
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .query(queryParams)
      .send();

  beforeEach(() => {
    eserviceTemplateService.getEServiceTemplateCreators = vi
      .fn()
      .mockResolvedValue(mockEserviceTemplateCreatorsResult);
  });

  const authorizedRoles: AuthRole[] = [
    authRole.ADMIN_ROLE,
    authRole.API_ROLE,
    authRole.SECURITY_ROLE,
    authRole.SUPPORT_ROLE,
  ];
  it.each(authorizedRoles)(
    "Should return 200 for user with role %s",
    async (role) => {
      const token = generateToken(role);
      const res = await makeRequest(token);
      expect(res.body).toEqual(mockEserviceTemplateCreatorsResult);
      expect(res.status).toBe(200);
    }
  );

  it.each(
    Object.values(authRole).filter((role) => !authorizedRoles.includes(role))
  )("Should return 403 for user with role %s", async (role) => {
    const token = generateToken(role);
    const res = await makeRequest(token);
    expect(res.status).toBe(403);
  });

  it("Should return 400 if passed no query params", async () => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token, {});
    expect(res.status).toBe(400);
  });
});
