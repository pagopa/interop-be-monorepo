/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  EServiceTemplate,
  EServiceTemplateId,
  generateId,
  operationForbidden,
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
import { eserviceTemplateToApiUpdateEServiceTemplateSeed } from "../mockUtils.js";
import {
  eserviceTemplateDuplicate,
  eserviceTemplateNotFound,
  eserviceTemplateNotInDraftState,
} from "../../src/model/domain/errors.js";

describe("API POST /templates/:templateId", () => {
  const mockEserviceTemplate: EServiceTemplate = getMockEServiceTemplate();

  const serviceResponse = getMockWithMetadata(mockEserviceTemplate);

  const apiEserviceTemplate = eserviceTemplateApi.EServiceTemplate.parse(
    eserviceTemplateToApiEServiceTemplate(mockEserviceTemplate)
  );

  const mockEserviceTemplateSeed: eserviceTemplateApi.UpdateEServiceTemplateSeed =
    eserviceTemplateToApiUpdateEServiceTemplateSeed(mockEserviceTemplate);

  const eserviceTemplateName = "duplicate";

  const makeRequest = async (
    token: string,
    id: EServiceTemplateId = mockEserviceTemplate.id,
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
      .mockResolvedValue(serviceResponse);
  });

  const authorizedRoles: AuthRole[] = [authRole.ADMIN_ROLE, authRole.API_ROLE];
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

  it.each([
    {
      templateId: mockEserviceTemplate.id,
      seed: {},
    },
    {
      templateId: mockEserviceTemplate.id,
      seed: { invalid: 1 },
    },
  ])(
    "Should return 400 if passed invalid params: %s",
    async ({ templateId, seed }) => {
      const token = generateToken(authRole.ADMIN_ROLE);
      const res = await makeRequest(
        token,
        templateId,
        seed as eserviceTemplateApi.UpdateEServiceTemplateSeed
      );

      expect(res.status).toBe(400);
    }
  );

  it.each([
    {
      error: eserviceTemplateNotFound(mockEserviceTemplate.id),
      expectedStatus: 404,
    },
    {
      error: eserviceTemplateDuplicate(eserviceTemplateName),
      expectedStatus: 409,
    },
    {
      error: eserviceTemplateNotInDraftState(mockEserviceTemplate.id),
      expectedStatus: 400,
    },
    {
      error: operationForbidden,
      expectedStatus: 403,
    },
  ])(
    "Should return $expectedStatus for $error.code",
    async ({ error, expectedStatus }) => {
      eserviceTemplateService.updateEServiceTemplate = vi
        .fn()
        .mockRejectedValue(error);

      const token = generateToken(authRole.ADMIN_ROLE);
      const res = await makeRequest(token);
      expect(res.status).toBe(expectedStatus);
    }
  );
});
