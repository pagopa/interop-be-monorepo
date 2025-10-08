/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  EServiceTemplate,
  EServiceTemplateId,
  generateId,
} from "pagopa-interop-models";
import {
  generateToken,
  getMockEServiceTemplate,
  getMockWithMetadata,
} from "pagopa-interop-commons-test";
import { AuthRole, authRole } from "pagopa-interop-commons";
import request from "supertest";
import { eserviceTemplateApi } from "pagopa-interop-api-clients";
import { api, eserviceTemplateService } from "../vitest.api.setup.js";
import { eserviceTemplateToApiEServiceTemplate } from "../../src/model/domain/apiConverter.js";
import { eserviceTemplateNotFound } from "../../src/model/domain/errors.js";

describe("API GET /templates/:templateId", () => {
  const mockEserviceTemplate: EServiceTemplate = getMockEServiceTemplate();

  const apiEserviceTemplate: eserviceTemplateApi.EServiceTemplate =
    eserviceTemplateApi.EServiceTemplate.parse(
      eserviceTemplateToApiEServiceTemplate(mockEserviceTemplate)
    );

  const serviceResponse = getMockWithMetadata(mockEserviceTemplate);

  const makeRequest = async (
    token: string,
    id: EServiceTemplateId = mockEserviceTemplate.id
  ) =>
    request(api)
      .get(`/templates/${id}`)
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .send();

  beforeEach(() => {
    eserviceTemplateService.getEServiceTemplateById = vi
      .fn()
      .mockResolvedValue(serviceResponse);
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
      expect(res.body).toEqual(apiEserviceTemplate);
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

  it("Should return 400 if passed a non uuid path param", async () => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token, "11" as EServiceTemplateId);
    expect(res.status).toBe(400);
  });

  it("Should return 404 if eServiceTemplateNotFound", async () => {
    const notFoundEserviceTemplateId = generateId<EServiceTemplateId>();
    eserviceTemplateService.getEServiceTemplateById = vi
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
