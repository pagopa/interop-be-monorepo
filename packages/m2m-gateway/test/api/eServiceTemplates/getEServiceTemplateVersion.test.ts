import { describe, it, expect, vi } from "vitest";
import {
  generateToken,
  getMockedApiEServiceTemplate,
  getMockedApiEserviceTemplateVersion,
} from "pagopa-interop-commons-test";
import { AuthRole, authRole } from "pagopa-interop-commons";
import request from "supertest";
import { generateId, unsafeBrandId } from "pagopa-interop-models";
import { api, mockEServiceTemplateService } from "../../vitest.api.setup.js";
import { appBasePath } from "../../../src/config/appBasePath.js";
import { toM2MGatewayEServiceTemplateVersion } from "../../../src/api/eserviceTemplateApiConverter.js";
import { eserviceTemplateVersionNotFound } from "../../../src/model/errors.js";

describe("GET /eserviceTemplates/:templateId/version/:versionId router test", () => {
  const authorizedRoles: AuthRole[] = [
    authRole.M2M_ADMIN_ROLE,
    authRole.M2M_ROLE,
  ];

  const makeRequest = async (
    token: string,
    templateId: string,
    versionId: string
  ) =>
    request(api)
      .get(
        `${appBasePath}/eserviceTemplates/${templateId}/versions/${versionId}`
      )
      .set("Authorization", `Bearer ${token}`)
      .send();

  const mockApiTemplateVersion1 = getMockedApiEserviceTemplateVersion({
    state: "DRAFT",
  });
  const mockApiTemplateVersion2 = getMockedApiEserviceTemplateVersion({
    state: "DEPRECATED",
  });

  const mockApiTemplate = getMockedApiEServiceTemplate({
    versions: [mockApiTemplateVersion1, mockApiTemplateVersion2],
  });

  const mockM2MVersionResponse = toM2MGatewayEServiceTemplateVersion(
    mockApiTemplateVersion1
  );

  it.each(authorizedRoles)(
    "Should return 200 and perform service calls for user with role %s",
    async (role) => {
      mockEServiceTemplateService.getEServiceTemplateVersion = vi
        .fn()
        .mockResolvedValue(mockM2MVersionResponse);

      const token = generateToken(role);
      const res = await makeRequest(
        token,
        mockApiTemplate.id,
        mockM2MVersionResponse.id
      );

      expect(res.status).toBe(200);
      expect(res.body).toEqual(mockM2MVersionResponse);
    }
  );

  it("Should return 400 for incorrect value for template id", async () => {
    const token = generateToken(authRole.M2M_ROLE);
    const res = await makeRequest(
      token,
      "INVALID_VERSION_ID",
      mockM2MVersionResponse.id
    );
    expect(res.status).toBe(400);
  });

  it("Should return 400 for incorrect value for template version id", async () => {
    const token = generateToken(authRole.M2M_ROLE);
    const res = await makeRequest(
      token,
      mockApiTemplate.id,
      "INVALID_VERSION_ID"
    );
    expect(res.status).toBe(400);
  });

  it("Should return 404 for eServiceTemplateVersionNotFound", async () => {
    mockEServiceTemplateService.getEServiceTemplateVersion = vi
      .fn()
      .mockRejectedValue(
        eserviceTemplateVersionNotFound(
          unsafeBrandId(mockApiTemplate.id),
          unsafeBrandId(mockApiTemplateVersion1.id)
        )
      );

    const token = generateToken(authRole.M2M_ROLE);

    const res = await makeRequest(token, mockApiTemplate.id, generateId());
    expect(res.status).toBe(404);
  });

  it.each(
    Object.values(authRole).filter((role) => !authorizedRoles.includes(role))
  )("Should return 403 for user with role %s", async (role) => {
    const token = generateToken(role);
    const res = await makeRequest(
      token,
      mockApiTemplate.id,
      mockM2MVersionResponse.id
    );
    expect(res.status).toBe(403);
  });

  it.each([
    { ...mockM2MVersionResponse, id: undefined },
    { ...mockM2MVersionResponse, invalidParam: "invalidValue" },
    { ...mockM2MVersionResponse, createdAt: undefined },
  ])(
    "Should return 500 when API model parsing fails for response",
    async (resp) => {
      mockEServiceTemplateService.getEServiceTemplateVersion = vi
        .fn()
        .mockResolvedValueOnce(resp);
      const token = generateToken(authRole.M2M_ADMIN_ROLE);
      const res = await makeRequest(
        token,
        mockApiTemplate.id,
        mockApiTemplateVersion1.id
      );

      expect(res.status).toBe(500);
    }
  );
});
