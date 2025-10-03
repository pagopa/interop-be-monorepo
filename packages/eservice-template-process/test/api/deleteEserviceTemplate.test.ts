/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect, vi } from "vitest";
import request from "supertest";
import {
  EServiceTemplate,
  EServiceTemplateId,
  generateId,
  operationForbidden,
} from "pagopa-interop-models";
import {
  generateToken,
  getMockEServiceTemplate,
} from "pagopa-interop-commons-test";
import { AuthRole, authRole } from "pagopa-interop-commons";
import { api, eserviceTemplateService } from "../vitest.api.setup.js";
import {
  eserviceTemplateNotFound,
  eserviceTemplateNotInDraftState,
} from "../../src/model/domain/errors.js";

describe("API /templates/{templateId} authorization test", () => {
  const eserviceTemplate: EServiceTemplate = getMockEServiceTemplate();

  eserviceTemplateService.deleteEServiceTemplate = vi
    .fn()
    .mockResolvedValue({});

  const makeRequest = async (token: string, templateId: EServiceTemplateId) =>
    request(api)
      .delete(`/templates/${templateId}`)
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .send();

  const authorizedRoles: AuthRole[] = [
    authRole.ADMIN_ROLE,
    authRole.API_ROLE,
    authRole.M2M_ADMIN_ROLE,
  ];
  it.each(authorizedRoles)(
    "Should return 204 for user with role %s",
    async (role) => {
      const token = generateToken(role);
      const res = await makeRequest(token, eserviceTemplate.id);
      expect(res.status).toBe(204);
    }
  );

  it.each(
    Object.values(authRole).filter((role) => !authorizedRoles.includes(role))
  )("Should return 403 for user with role %s", async (role) => {
    const token = generateToken(role);
    const res = await makeRequest(token, eserviceTemplate.id);

    expect(res.status).toBe(403);
  });

  it.each([
    {
      error: eserviceTemplateNotInDraftState(eserviceTemplate.id),
      expectedStatus: 409,
    },
    {
      error: eserviceTemplateNotFound(eserviceTemplate.id),
      expectedStatus: 404,
    },
    {
      error: operationForbidden,
      expectedStatus: 403,
    },
  ])(
    "Should return $expectedStatus for $error.code",
    async ({ error, expectedStatus }) => {
      eserviceTemplateService.deleteEServiceTemplate = vi
        .fn()
        .mockRejectedValue(error);

      const token = generateToken(authRole.ADMIN_ROLE);
      const res = await makeRequest(token, eserviceTemplate.id);

      expect(res.status).toBe(expectedStatus);
    }
  );

  it.each([{}, { templateId: "invalidId" }])(
    "Should return 400 if passed invalid params: %s",
    async ({ templateId }) => {
      const token = generateToken(authRole.ADMIN_ROLE);
      const res = await makeRequest(token, templateId as EServiceTemplateId);

      expect(res.status).toBe(400);
    }
  );
});
