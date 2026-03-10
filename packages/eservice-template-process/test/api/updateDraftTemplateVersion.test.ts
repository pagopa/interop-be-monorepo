/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  AttributeId,
  EServiceTemplateId,
  EServiceTemplateVersionId,
  eserviceTemplateVersionState,
  generateId,
  operationForbidden,
} from "pagopa-interop-models";
import {
  generateToken,
  getMockEServiceTemplate,
} from "pagopa-interop-commons-test";
import { AuthRole, authRole } from "pagopa-interop-commons";
import request from "supertest";
import { eserviceTemplateApi } from "pagopa-interop-api-clients";
import { api, eserviceTemplateService } from "../vitest.api.setup.js";
import {
  attributeDuplicatedInGroup,
  attributeNotFound,
  eserviceTemplateNotFound,
  eserviceTemplateVersionNotFound,
  inconsistentDailyCalls,
  notValidEServiceTemplateVersionState,
} from "../../src/model/domain/errors.js";
import { buildUpdateVersionSeed } from "../mockUtils.js";

describe("API POST /templates/:templateId/versions/:templateVersionId", () => {
  const mockEserviceTemplate = getMockEServiceTemplate();
  const mockSeed: eserviceTemplateApi.UpdateEServiceTemplateVersionSeed =
    buildUpdateVersionSeed(mockEserviceTemplate.versions[0]);
  const attributeId = generateId<AttributeId>();

  const makeRequest = async (
    token: string,
    seed: eserviceTemplateApi.UpdateEServiceTemplateVersionSeed = mockSeed,
    templateId: EServiceTemplateId = mockEserviceTemplate.id,
    templateVersionId: EServiceTemplateVersionId = mockEserviceTemplate
      .versions[0].id
  ) =>
    request(api)
      .post(`/templates/${templateId}/versions/${templateVersionId}`)
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .send(seed);

  beforeEach(() => {
    eserviceTemplateService.updateDraftTemplateVersion = vi
      .fn()
      .mockResolvedValue(mockEserviceTemplate);
  });

  const authorizedRoles: AuthRole[] = [authRole.ADMIN_ROLE, authRole.API_ROLE];
  it.each(authorizedRoles)(
    "Should return 200 for user with role %s",
    async (role) => {
      const token = generateToken(role);
      const res = await makeRequest(token);
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
      error: eserviceTemplateVersionNotFound(
        mockEserviceTemplate.id,
        mockEserviceTemplate.versions[0].id
      ),
      expectedStatus: 404,
    },
    {
      error: attributeNotFound(attributeId),
      expectedStatus: 404,
    },
    {
      error: operationForbidden,
      expectedStatus: 403,
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
      error: attributeDuplicatedInGroup(generateId()),
      expectedStatus: 400,
    },
  ])(
    "Should return $expectedStatus for $error.code",
    async ({ error, expectedStatus }) => {
      eserviceTemplateService.updateDraftTemplateVersion = vi
        .fn()
        .mockRejectedValue(error);

      const token = generateToken(authRole.ADMIN_ROLE);
      const res = await makeRequest(token);
      expect(res.status).toBe(expectedStatus);
    }
  );

  it.each([
    {
      templateId: "invalidId",
      templateVersionId: mockEserviceTemplate.versions[0].id,
      seed: mockSeed,
    },
    {
      templateId: mockEserviceTemplate.id,
      templateVersionId: "invalidId",
      seed: mockSeed,
    },
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
  ])(
    "Should return 400 if passed invalid params: %s",
    async ({ templateId, templateVersionId, seed }) => {
      const token = generateToken(authRole.ADMIN_ROLE);
      const res = await makeRequest(
        token,
        seed as eserviceTemplateApi.UpdateEServiceTemplateVersionSeed,
        templateId as EServiceTemplateId,
        templateVersionId as EServiceTemplateVersionId
      );

      expect(res.status).toBe(400);
    }
  );
});
