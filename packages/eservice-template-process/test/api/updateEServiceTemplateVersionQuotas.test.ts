/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  EServiceTemplateId,
  EServiceTemplateVersionId,
  eserviceTemplateVersionState,
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
import {
  eserviceTemplateNotFound,
  eserviceTemplateVersionNotFound,
  inconsistentDailyCalls,
  notValidEServiceTemplateVersionState,
} from "../../src/model/domain/errors.js";
import { eserviceTemplateToApiEServiceTemplate } from "../../src/model/domain/apiConverter.js";

describe("API POST /templates/:templateId/versions/:templateVersionId/quotas/update", () => {
  const mockEserviceTemplate = getMockEServiceTemplate();
  const mockSeed: eserviceTemplateApi.UpdateEServiceTemplateVersionQuotasSeed =
    { voucherLifespan: 60 };

  const serviceResponse = getMockWithMetadata(mockEserviceTemplate);
  const apiEserviceTemplate = eserviceTemplateApi.EServiceTemplate.parse(
    eserviceTemplateToApiEServiceTemplate(mockEserviceTemplate)
  );

  const makeRequest = async (
    token: string,
    seed: eserviceTemplateApi.UpdateEServiceTemplateVersionQuotasSeed = mockSeed,
    templateId: EServiceTemplateId = mockEserviceTemplate.id,
    templateVersionId: EServiceTemplateVersionId = mockEserviceTemplate
      .versions[0].id
  ) =>
    request(api)
      .post(
        `/templates/${templateId}/versions/${templateVersionId}/quotas/update`
      )
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .send(seed);

  beforeEach(() => {
    eserviceTemplateService.updateEServiceTemplateVersionQuotas = vi
      .fn()
      .mockResolvedValue(serviceResponse);
  });

  const authorizedRoles: AuthRole[] = [
    authRole.ADMIN_ROLE,
    authRole.API_ROLE,
    authRole.M2M_ADMIN_ROLE,
  ];
  it.each(authorizedRoles)(
    "Should return 200 for user with role %s",
    async (role) => {
      const token = generateToken(role);
      const res = await makeRequest(token);
      expect(res.status).toBe(200);
      expect(res.body).toEqual(apiEserviceTemplate);
      expect(res.headers["x-metadata-version"]).toEqual(
        serviceResponse.metadata.version.toString()
      );
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
      error: eserviceTemplateNotFound(mockEserviceTemplate.id),
      expectedStatus: 404,
    },
    {
      error: eserviceTemplateVersionNotFound(
        mockEserviceTemplate.id,
        mockEserviceTemplate.versions[0].id
      ),
      expectedStatus: 404,
    },
    {
      error: notValidEServiceTemplateVersionState(
        mockEserviceTemplate.versions[0].id,
        eserviceTemplateVersionState.draft
      ),
      expectedStatus: 400,
    },
    {
      error: inconsistentDailyCalls(),
      expectedStatus: 400,
    },
    {
      error: operationForbidden,
      expectedStatus: 403,
    },
  ])(
    "Should return $expectedStatus for $error.code",
    async ({ error, expectedStatus }) => {
      eserviceTemplateService.updateEServiceTemplateVersionQuotas = vi
        .fn()
        .mockRejectedValue(error);

      const token = generateToken(authRole.ADMIN_ROLE);
      const res = await makeRequest(token);
      expect(res.status).toBe(expectedStatus);
    }
  );

  it.each([
    {
      templateId: mockEserviceTemplate.id,
      templateVersionId: mockEserviceTemplate.versions[0].id,
      seed: {},
    },
    {
      templateId: mockEserviceTemplate.id,
      templateVersionId: mockEserviceTemplate.versions[0].id,
      seed: { invalid: 1 },
    },
    {
      templateId: mockEserviceTemplate.id,
      templateVersionId: "invalid",
      seed: mockSeed,
    },
  ])(
    "Should return 400 if passed invalid params: %s",
    async ({ templateId, templateVersionId, seed }) => {
      const token = generateToken(authRole.ADMIN_ROLE);
      const res = await makeRequest(
        token,
        seed as eserviceTemplateApi.UpdateEServiceTemplateVersionQuotasSeed,
        templateId,
        templateVersionId as EServiceTemplateVersionId
      );

      expect(res.status).toBe(400);
    }
  );
});
