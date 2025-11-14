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
import {
  AuthRole,
  RiskAnalysisValidationIssue,
  authRole,
} from "pagopa-interop-commons";
import request from "supertest";
import { api, eserviceTemplateService } from "../vitest.api.setup.js";
import {
  eserviceTemplateNotFound,
  missingPersonalDataFlag,
  eserviceTemplateVersionNotFound,
  missingTemplateVersionInterface,
  notValidEServiceTemplateVersionState,
  riskAnalysisValidationFailed,
} from "../../src/model/domain/errors.js";

describe("API POST /templates/:templateId/versions/:templateVersionId/publish", () => {
  const mockEserviceTemplate = getMockEServiceTemplate();
  const mockEserviceTemplateWithMetadata =
    getMockWithMetadata(mockEserviceTemplate);

  const makeRequest = async (
    token: string,
    templateId: EServiceTemplateId = mockEserviceTemplate.id,
    templateVersionId: EServiceTemplateVersionId = mockEserviceTemplate
      .versions[0].id
  ) =>
    request(api)
      .post(`/templates/${templateId}/versions/${templateVersionId}/publish`)
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .send();

  beforeEach(() => {
    eserviceTemplateService.publishEServiceTemplateVersion = vi
      .fn()
      .mockResolvedValue(mockEserviceTemplateWithMetadata);
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
      expect(res.status).toBe(204);
      expect(res.headers["x-metadata-version"]).toBe(
        mockEserviceTemplateWithMetadata.metadata.version.toString()
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
      error: missingTemplateVersionInterface(
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
      error: notValidEServiceTemplateVersionState(
        mockEserviceTemplate.versions[0].id,
        eserviceTemplateVersionState.draft
      ),
      expectedStatus: 400,
    },
    {
      error: missingPersonalDataFlag(
        mockEserviceTemplate.id,
        mockEserviceTemplate.versions[0].id
      ),
      expectedStatus: 400,
    },
    {
      error: riskAnalysisValidationFailed([
        new RiskAnalysisValidationIssue({
          code: "rulesVersionNotFoundError",
          detail: "no rule",
        }),
      ]),
      expectedStatus: 400,
    },
    {
      error: operationForbidden,
      expectedStatus: 403,
    },
  ])(
    "Should return $expectedStatus for $error.code",
    async ({ error, expectedStatus }) => {
      eserviceTemplateService.publishEServiceTemplateVersion = vi
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
    },
    {
      templateId: mockEserviceTemplate.id,
      templateVersionId: "invalidId",
    },
  ])(
    "Should return 400 if passed invalid params: %s",
    async ({ templateId, templateVersionId }) => {
      const token = generateToken(authRole.ADMIN_ROLE);
      const res = await makeRequest(
        token,
        templateId as EServiceTemplateId,
        templateVersionId as EServiceTemplateVersionId
      );

      expect(res.status).toBe(400);
    }
  );
});
