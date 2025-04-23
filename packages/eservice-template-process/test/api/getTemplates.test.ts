/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect, vi } from "vitest";
import { generateId } from "pagopa-interop-models";
import {
  generateToken,
  getMockEServiceTemplate,
} from "pagopa-interop-commons-test";
import { AuthRole, authRole } from "pagopa-interop-commons";
import request from "supertest";
import { api, eserviceTemplateService } from "../vitest.api.setup.js";
import { eserviceTemplateToApiEServiceTemplate } from "../../src/model/domain/apiConverter.js";

describe("API GET /templates", () => {
  const mockEserviceTemplate = getMockEServiceTemplate();

  const mockEserviceTemplateListResult = {
    results: [mockEserviceTemplate],
    totalCount: 1,
  };

  eserviceTemplateService.getEServiceTemplates = vi
    .fn()
    .mockResolvedValue(mockEserviceTemplateListResult);

  const makeRequest = async (token: string) =>
    request(api)
      .get("/templates")
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .query({
        limit: 10,
        offset: 0,
      })
      .send();

  const authorizedRoles: AuthRole[] = [
    authRole.ADMIN_ROLE,
    authRole.API_ROLE,
    authRole.SECURITY_ROLE,
    authRole.M2M_ROLE,
    authRole.SUPPORT_ROLE,
  ];
  it.each(authorizedRoles)(
    "Should return 200 for user with role %s",
    async (role) => {
      const token = generateToken(role);
      const res = await makeRequest(token);
      expect(res.body).toEqual({
        results: mockEserviceTemplateListResult.results.map((t) =>
          eserviceTemplateToApiEServiceTemplate(t)
        ),
        totalCount: mockEserviceTemplateListResult.totalCount,
      });
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
    const res = await request(api)
      .get("/templates")
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .query({})
      .send();
    expect(res.status).toBe(400);
  });
});
