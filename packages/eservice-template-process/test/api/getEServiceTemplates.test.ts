/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { EServiceTemplateId, generateId } from "pagopa-interop-models";
import {
  generateToken,
  getMockEServiceTemplate,
} from "pagopa-interop-commons-test";
import { AuthRole, authRole } from "pagopa-interop-commons";
import request from "supertest";
import { api, eserviceTemplateService } from "../vitest.api.setup.js";
import { eserviceTemplateToApiEServiceTemplate } from "../../src/model/domain/apiConverter.js";
import { eserviceTemplateNotFound } from "../../src/model/domain/errors.js";

describe("API GET /templates", () => {
  const mockEserviceTemplate = getMockEServiceTemplate();

  const mockEserviceTemplateListResult = {
    results: [mockEserviceTemplate],
    totalCount: 1,
  };

  const queryParams = {
    limit: 10,
    offset: 0,
  };

  const makeRequest = async (
    token: string,
    query: typeof queryParams = queryParams
  ) =>
    request(api)
      .get("/templates")
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .query(query)
      .send();

  beforeEach(() => {
    eserviceTemplateService.getEServiceTemplates = vi
      .fn()
      .mockResolvedValue(mockEserviceTemplateListResult);
  });

  const authorizedRoles: AuthRole[] = [
    authRole.ADMIN_ROLE,
    authRole.API_ROLE,
    authRole.SECURITY_ROLE,
    authRole.M2M_ROLE,
    authRole.SUPPORT_ROLE,
    authRole.M2M_ADMIN_ROLE,
  ];
  it.each(authorizedRoles)(
    "Should return 200 for user with role %s",
    async (role) => {
      const token = generateToken(role);
      const res = await makeRequest(token);
      const expected = {
        results: mockEserviceTemplateListResult.results.map((t) =>
          eserviceTemplateToApiEServiceTemplate(t)
        ),
        totalCount: mockEserviceTemplateListResult.totalCount,
      };

      expect(res.body).toEqual(expected);
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

  it.each([
    {},
    { limit: "not-a-number" },
    { offset: "not-a-number" },
    { limit: -1 },
    { offset: -1 },
    { limit: 51 },
    { personalData: "invalid" },
  ])("Should return 400 if passed invalid params: %s", async (query) => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(
      token,
      query as unknown as typeof queryParams
    );
    expect(res.status).toBe(400);
  });

  it("Should return 404 if no pulished versions for a template are found", async () => {
    const notFoundEserviceTemplateId = generateId<EServiceTemplateId>();
    eserviceTemplateService.getEServiceTemplates = vi
      .fn()
      .mockRejectedValue(eserviceTemplateNotFound(notFoundEserviceTemplateId));
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token);
    expect(res.body.detail).toBe(
      `EService Template ${notFoundEserviceTemplateId} not found`
    );
    expect(res.status).toBe(404);
  });
});
