import { describe, it, expect, vi } from "vitest";
import {
  generateToken,
  getMockedApiEServiceTemplate,
} from "pagopa-interop-commons-test";
import { AuthRole, authRole } from "pagopa-interop-commons";
import request from "supertest";
import { generateId } from "pagopa-interop-models";
import { api, mockEServiceTemplateService } from "../../vitest.api.setup.js";
import { appBasePath } from "../../../src/config/appBasePath.js";
import { toM2MGatewayEServiceTemplate } from "../../../src/api/eserviceTemplateApiConverter.js";

describe("GET /eserviceTemplates/:templateId router test", () => {
  const makeRequest = async (token: string, templateId: string) =>
    request(api)
      .get(`${appBasePath}/eserviceTemplates/${templateId}`)
      .set("Authorization", `Bearer ${token}`)
      .send();

  const mockApiTemplate = getMockedApiEServiceTemplate();
  const mockM2MTemplateResponse = toM2MGatewayEServiceTemplate(mockApiTemplate);

  const authorizedRoles: AuthRole[] = [
    authRole.M2M_ADMIN_ROLE,
    authRole.M2M_ROLE,
  ];
  it.each(authorizedRoles)(
    "Should return 200 and perform service calls for user with role %s",
    async (role) => {
      mockEServiceTemplateService.getEServiceTemplateById = vi
        .fn()
        .mockResolvedValue(mockM2MTemplateResponse);

      const token = generateToken(role);
      const res = await makeRequest(token, mockM2MTemplateResponse.id);

      expect(res.status).toBe(200);
      expect(res.body).toEqual(mockM2MTemplateResponse);
    }
  );

  it("Should return 400 for incorrect value for template id", async () => {
    mockEServiceTemplateService.getEServiceTemplateById = vi
      .fn()
      .mockResolvedValue(mockM2MTemplateResponse);

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
    { ...mockM2MTemplateResponse, id: undefined },
    { ...mockM2MTemplateResponse, invalidParam: "invalidValue" },
    { ...mockM2MTemplateResponse, createdAt: undefined },
  ])(
    "Should return 500 when API model parsing fails for response",
    async (resp) => {
      mockEServiceTemplateService.getEServiceTemplateById = vi
        .fn()
        .mockResolvedValueOnce(resp);
      const token = generateToken(authRole.M2M_ADMIN_ROLE);
      const res = await makeRequest(token, mockM2MTemplateResponse.id);

      expect(res.status).toBe(500);
    }
  );
});
