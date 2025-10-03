/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
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
import { api, eserviceTemplateService } from "../vitest.api.setup.js";
import {
  eserviceTemplateDuplicate,
  eserviceTemplateNotFound,
  eserviceTemplateWithoutPublishedVersion,
} from "../../src/model/domain/errors.js";
import { eserviceTemplateToApiEServiceTemplate } from "../../src/model/domain/apiConverter.js";

describe("API POST /templates/:templateId/name/update", () => {
  const mockEserviceTemplate = getMockEServiceTemplate();
  const serviceResponse = getMockWithMetadata(mockEserviceTemplate);

  const name = {
    name: "name to be updated",
  };

  const makeRequest = async (
    token: string,
    seed: typeof name = name,
    templateId: EServiceTemplateId = mockEserviceTemplate.id
  ) =>
    request(api)
      .post(`/templates/${templateId}/name/update`)
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .send(seed);

  beforeEach(() => {
    eserviceTemplateService.updateEServiceTemplateName = vi
      .fn()
      .mockResolvedValue(serviceResponse);
  });

  const authorizedRoles: AuthRole[] = [
    authRole.M2M_ADMIN_ROLE,
    authRole.ADMIN_ROLE,
    authRole.API_ROLE,
  ];
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
        seed as { name: string },
        templateId
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
      error: eserviceTemplateWithoutPublishedVersion(mockEserviceTemplate.id),
      expectedStatus: 409,
    },
    {
      error: operationForbidden,
      expectedStatus: 403,
    },
    {
      error: eserviceTemplateDuplicate(mockEserviceTemplate.id),
      expectedStatus: 409,
    },
  ])(
    "Should return $expectedStatus for $error.code",
    async ({ error, expectedStatus }) => {
      eserviceTemplateService.updateEServiceTemplateName = vi
        .fn()
        .mockRejectedValue(error);

      const token = generateToken(authRole.ADMIN_ROLE);
      const res = await makeRequest(token);
      expect(res.status).toBe(expectedStatus);
    }
  );
});
