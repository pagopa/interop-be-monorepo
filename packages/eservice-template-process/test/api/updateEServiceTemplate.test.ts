/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { generateId, operationForbidden } from "pagopa-interop-models";
import {
  generateToken,
  getMockEServiceTemplate,
} from "pagopa-interop-commons-test";
import { AuthRole, authRole } from "pagopa-interop-commons";
import request from "supertest";
import { eserviceTemplateApi } from "pagopa-interop-api-clients";
import { api, eserviceTemplateService } from "../vitest.api.setup.js";
import { eserviceTemplateToApiEServiceTemplate } from "../../src/model/domain/apiConverter.js";
import { eserviceTemplateToApiUpdateEServiceTemplateSeed } from "../mockUtils.js";
import {
  eServiceTemplateDuplicate,
  eServiceTemplateNotFound,
  eserviceTemplateNotInDraftState,
} from "../../src/model/domain/errors.js";

describe("API POST /templates/:templateId", () => {
  const mockEserviceTemplate = getMockEServiceTemplate();

  const mockEserviceTemplateSeed =
    eserviceTemplateToApiUpdateEServiceTemplateSeed(mockEserviceTemplate);

  const makeRequest = async (
    token: string,
    id = mockEserviceTemplate.id,
    body: eserviceTemplateApi.UpdateEServiceTemplateSeed = mockEserviceTemplateSeed
  ) =>
    request(api)
      .post(`/templates/${id}`)
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .send(body);

  beforeEach(() => {
    eserviceTemplateService.updateEServiceTemplate = vi
      .fn()
      .mockResolvedValue(mockEserviceTemplate);
  });

  const authorizedRoles: AuthRole[] = [authRole.ADMIN_ROLE, authRole.API_ROLE];
  it.each(authorizedRoles)(
    "Should return 200 for user with role %s",
    async (role) => {
      const token = generateToken(role);
      const res = await makeRequest(token);
      expect(res.body).toEqual(
        eserviceTemplateToApiEServiceTemplate(mockEserviceTemplate)
      );
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

  it("Should return 400 if passed a not compliant body", async () => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(
      token,
      mockEserviceTemplate.id,
      {} as eserviceTemplateApi.UpdateEServiceTemplateSeed
    );
    expect(res.status).toBe(400);
  });

  it("Should return 404 for eserviceTemplateNotFound", async () => {
    eserviceTemplateService.updateEServiceTemplate = vi
      .fn()
      .mockRejectedValue(eServiceTemplateNotFound(mockEserviceTemplate.id));
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token);
    expect(res.body.detail).toBe(
      `EService Template ${mockEserviceTemplate.id} not found`
    );
    expect(res.status).toBe(404);
  });

  it("Should return 403 for operationForbidden", async () => {
    eserviceTemplateService.updateEServiceTemplate = vi
      .fn()
      .mockRejectedValue(operationForbidden);
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token);
    expect(res.body.detail).toBe("Insufficient privileges");
    expect(res.status).toBe(403);
  });

  it("Should return 409 for eServiceTemplateDuplicate", async () => {
    const eserviceTemplateName = "duplicate";
    eserviceTemplateService.updateEServiceTemplate = vi
      .fn()
      .mockRejectedValue(eServiceTemplateDuplicate(eserviceTemplateName));
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token);
    expect(res.body.detail).toBe(
      `An EService Template with name ${eserviceTemplateName} already exists`
    );
    expect(res.status).toBe(409);
  });

  it("Should return 400 for eserviceTemplateNotInDraftState", async () => {
    eserviceTemplateService.updateEServiceTemplate = vi
      .fn()
      .mockRejectedValue(
        eserviceTemplateNotInDraftState(mockEserviceTemplate.id)
      );
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token);
    expect(res.body.detail).toBe(
      `EService Template ${mockEserviceTemplate.id} is not in draft state`
    );
    expect(res.status).toBe(400);
  });
});
