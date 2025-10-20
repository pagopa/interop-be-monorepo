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
} from "pagopa-interop-commons-test";
import { AuthRole, authRole } from "pagopa-interop-commons";
import request from "supertest";
import { eserviceTemplateApi } from "pagopa-interop-api-clients";
import { api, eserviceTemplateService } from "../vitest.api.setup.js";
import {
  attributeDuplicatedInGroup,
  eserviceTemplateNotFound,
  eserviceTemplateVersionNotFound,
  inconsistentAttributesSeedGroupsCount,
  notValidEServiceTemplateVersionState,
  unchangedAttributes,
  versionAttributeGroupSupersetMissingInAttributesSeed,
} from "../../src/model/domain/errors.js";
import { eserviceTemplateToApiEServiceTemplate } from "../../src/model/domain/apiConverter.js";

describe("API POST /templates/:templateId/versions/:templateVersionId/attributes/update", () => {
  const mockEserviceTemplate = getMockEServiceTemplate();

  const seed: eserviceTemplateApi.AttributesSeed = {
    certified: [],
    declared: [],
    verified: [],
  };

  const makeRequest = async (
    token: string,
    seedParam = seed,
    templateId: EServiceTemplateId = mockEserviceTemplate.id,
    templateVersionId: EServiceTemplateVersionId = mockEserviceTemplate
      .versions[0].id
  ) =>
    request(api)
      .post(
        `/templates/${templateId}/versions/${templateVersionId}/attributes/update`
      )
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .send(seedParam);

  beforeEach(() => {
    eserviceTemplateService.updateEServiceTemplateVersionAttributes = vi
      .fn()
      .mockResolvedValue(mockEserviceTemplate);
  });

  const authorizedRoles: AuthRole[] = [authRole.ADMIN_ROLE, authRole.API_ROLE, authRole.M2M_ADMIN_ROLE];
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
        seed as eserviceTemplateApi.AttributesSeed,
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
      error: inconsistentAttributesSeedGroupsCount(
        mockEserviceTemplate.id,
        mockEserviceTemplate.versions[0].id
      ),
      expectedStatus: 400,
    },
    {
      error: versionAttributeGroupSupersetMissingInAttributesSeed(
        mockEserviceTemplate.id,
        mockEserviceTemplate.versions[0].id
      ),
      expectedStatus: 400,
    },
    {
      error: unchangedAttributes(
        mockEserviceTemplate.id,
        mockEserviceTemplate.versions[0].id
      ),
      expectedStatus: 400,
    },
    {
      error: operationForbidden,
      expectedStatus: 403,
    },
    {
      error: attributeDuplicatedInGroup(generateId()),
      expectedStatus: 400,
    },
  ])(
    "Should return $expectedStatus for $error.code",
    async ({ error, expectedStatus }) => {
      eserviceTemplateService.updateEServiceTemplateVersionAttributes = vi
        .fn()
        .mockRejectedValue(error);

      const token = generateToken(authRole.ADMIN_ROLE);
      const res = await makeRequest(token);
      expect(res.status).toBe(expectedStatus);
    }
  );
});
