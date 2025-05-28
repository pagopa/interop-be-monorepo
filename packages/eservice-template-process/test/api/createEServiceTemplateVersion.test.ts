/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  EServiceTemplateId,
  generateId,
  operationForbidden,
} from "pagopa-interop-models";
import {
  generateToken,
  getMockEServiceTemplateVersion,
} from "pagopa-interop-commons-test";
import { AuthRole, authRole } from "pagopa-interop-commons";
import request from "supertest";
import { api, eserviceTemplateService } from "../vitest.api.setup.js";
import { eserviceTemplateVersionToApiEServiceTemplateVersion } from "../../src/model/domain/apiConverter.js";
import {
  draftEServiceTemplateVersionAlreadyExists,
  eserviceTemplateNotFound,
  eserviceTemplateWithoutPublishedVersion,
  inconsistentDailyCalls,
} from "../../src/model/domain/errors.js";

describe("API POST /templates/:templateId/versions", () => {
  const eserviceTemplateId = generateId<EServiceTemplateId>();
  const mockEserviceTemplateVersion = getMockEServiceTemplateVersion();
  const notFoundEserviceTemplateId = generateId<EServiceTemplateId>();

  const makeRequest = async (
    token: string,
    id: EServiceTemplateId = eserviceTemplateId
  ) =>
    request(api)
      .post(`/templates/${id}/versions`)
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .send();

  beforeEach(() => {
    eserviceTemplateService.createEServiceTemplateVersion = vi
      .fn()
      .mockResolvedValue(mockEserviceTemplateVersion);
  });

  const authorizedRoles: AuthRole[] = [authRole.ADMIN_ROLE, authRole.API_ROLE];
  it.each(authorizedRoles)(
    "Should return 200 for user with role %s",
    async (role) => {
      const token = generateToken(role);
      const res = await makeRequest(token);
      expect(res.body).toEqual(
        eserviceTemplateVersionToApiEServiceTemplateVersion(
          mockEserviceTemplateVersion
        )
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
      error: eserviceTemplateNotFound(notFoundEserviceTemplateId),
      expectedStatus: 404,
    },
    {
      error: draftEServiceTemplateVersionAlreadyExists(eserviceTemplateId),
      expectedStatus: 400,
    },
    {
      error: inconsistentDailyCalls(),
      expectedStatus: 400,
    },
    {
      error: eserviceTemplateWithoutPublishedVersion(eserviceTemplateId),
      expectedStatus: 409,
    },
    {
      error: operationForbidden,
      expectedStatus: 403,
    },
  ])(
    "Should return $expectedStatus for $error.code",
    async ({ error, expectedStatus }) => {
      eserviceTemplateService.createEServiceTemplateVersion = vi
        .fn()
        .mockRejectedValue(error);

      const token = generateToken(authRole.ADMIN_ROLE);
      const res = await makeRequest(token);
      expect(res.status).toBe(expectedStatus);
    }
  );

  it("Should return 400 if passed a not compliat query param", async () => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token, "111" as EServiceTemplateId);
    expect(res.status).toBe(400);
  });
});
