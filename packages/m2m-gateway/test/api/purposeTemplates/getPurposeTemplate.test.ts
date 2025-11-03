import { describe, it, expect, vi } from "vitest";
import {
  generateToken,
  getMockedApiPurposeTemplate,
} from "pagopa-interop-commons-test";
import { AuthRole, authRole } from "pagopa-interop-commons";
import request from "supertest";
import { generateId } from "pagopa-interop-models";
import { api, mockPurposeTemplateService } from "../../vitest.api.setup.js";
import { appBasePath } from "../../../src/config/appBasePath.js";

describe("GET /purposeTemplates/:purposeTemplateId router test", () => {
  const authorizedRoles: AuthRole[] = [
    authRole.M2M_ADMIN_ROLE,
    authRole.M2M_ROLE,
  ];

  const makeRequest = async (token: string, purposeTemplateId: string) =>
    request(api)
      .get(`${appBasePath}/purposeTemplates/${purposeTemplateId}`)
      .set("Authorization", `Bearer ${token}`)
      .send();

  const mockM2MPurposeTemplateResponse = getMockedApiPurposeTemplate();

  it.each(authorizedRoles)(
    "Should return 200 and perform service calls for user with role %s",
    async (role) => {
      mockPurposeTemplateService.getPurposeTemplate = vi
        .fn()
        .mockResolvedValue(mockM2MPurposeTemplateResponse);

      const token = generateToken(role);
      const res = await makeRequest(token, mockM2MPurposeTemplateResponse.id);

      expect(res.status).toBe(200);
      expect(res.body).toEqual(mockM2MPurposeTemplateResponse);
    }
  );

  it("Should return 400 for invalid purpose template id", async () => {
    const token = generateToken(authRole.M2M_ROLE);
    const res = await makeRequest(token, "INVALID ID");
    expect(res.status).toBe(400);
  });

  it.each(
    Object.values(authRole).filter((role) => !authorizedRoles.includes(role))
  )("Should return 403 for user with role %s", async (role) => {
    const token = generateToken(role);
    const res = await makeRequest(token, generateId());
    expect(res.status).toBe(403);
  });

  it.each([
    { ...mockM2MPurposeTemplateResponse, createdAt: undefined },
    { ...mockM2MPurposeTemplateResponse, eserviceId: "invalidId" },
    { ...mockM2MPurposeTemplateResponse, extraParam: "extraValue" },
    {},
  ])(
    "Should return 500 when API model parsing fails for response",
    async (resp) => {
      mockPurposeTemplateService.getPurposeTemplate = vi
        .fn()
        .mockResolvedValue(resp);
      const token = generateToken(authRole.M2M_ADMIN_ROLE);
      const res = await makeRequest(token, mockM2MPurposeTemplateResponse.id);

      expect(res.status).toBe(500);
    }
  );
});
