/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect, vi } from "vitest";
import request from "supertest";
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
import { eserviceTemplateApi } from "pagopa-interop-api-clients";
import { api, eserviceTemplateService } from "../vitest.api.setup.js";
import { eserviceTemplateToApiEServiceTemplate } from "../../src/model/domain/apiConverter.js";
import {
  eserviceTemplateNotFound,
  eserviceTemplateVersionNotFound,
  inconsistentDailyCalls,
  notValidEServiceTemplateVersionState,
} from "../../src/model/domain/errors.js";

describe("PATCH /templates/:templateId/versions/:templateVersionId router test", () => {
  const mockEserviceTemplate = getMockEServiceTemplate();
  const serviceResponse = getMockWithMetadata(mockEserviceTemplate);
  const apiEserviceTemplate = eserviceTemplateApi.EServiceTemplate.parse(
    eserviceTemplateToApiEServiceTemplate(mockEserviceTemplate)
  );

  const eserviceTemplateSeed: eserviceTemplateApi.PatchUpdateEServiceTemplateVersionSeed =
    {
      description: "updated description",
      voucherLifespan: 120,
      dailyCallsPerConsumer: 200,
      dailyCallsTotal: 1000,
      agreementApprovalPolicy: "MANUAL",
    };

  eserviceTemplateService.patchUpdateDraftTemplateVersion = vi
    .fn()
    .mockResolvedValue(serviceResponse);

  const makeRequest = async (
    token: string,
    templateId: EServiceTemplateId = mockEserviceTemplate.id,
    templateVersionId: EServiceTemplateVersionId = mockEserviceTemplate
      .versions[0].id,
    body: eserviceTemplateApi.PatchUpdateEServiceTemplateVersionSeed = eserviceTemplateSeed
  ) =>
    request(api)
      .patch(`/templates/${templateId}/versions/${templateVersionId}`)
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .send(body);

  const authorizedRoles: AuthRole[] = [authRole.M2M_ADMIN_ROLE];
  it.each(authorizedRoles)(
    "Should return 200 for user with role %s",
    async (role) => {
      const token = generateToken(role);
      const res = await makeRequest(token);
      expect(res.status).toBe(200);
      expect(res.body).toEqual(apiEserviceTemplate);
      expect(res.headers["x-metadata-version"]).toBe(
        serviceResponse.metadata.version.toString()
      );
    }
  );

  it.each([
    {},
    { description: "updated description" },
    {
      description: "updated description",
      voucherLifespan: 200,
    },
    {
      description: "updated description",
      voucherLifespan: 200,
      dailyCallsPerConsumer: 300,
    },
    {
      description: "updated description",
      voucherLifespan: 200,
      dailyCallsPerConsumer: 300,
      dailyCallsTotal: 1500,
    },
    {
      description: "updated description",
      voucherLifespan: 200,
      dailyCallsPerConsumer: 300,
      dailyCallsTotal: 1500,
      agreementApprovalPolicy: "AUTOMATIC" as const,
    },
  ] as eserviceTemplateApi.PatchUpdateEServiceTemplateVersionSeed[])(
    "Should return 200 with partial seed (seed #%#)",
    async (seed) => {
      const token = generateToken(authRole.M2M_ADMIN_ROLE);
      const res = await makeRequest(
        token,
        mockEserviceTemplate.id,
        mockEserviceTemplate.versions[0].id,
        seed
      );
      expect(res.status).toBe(200);
    }
  );

  it.each([
    [
      { description: 123 },
      mockEserviceTemplate.id,
      mockEserviceTemplate.versions[0].id,
    ],
    [
      { voucherLifespan: "invalid" },
      mockEserviceTemplate.id,
      mockEserviceTemplate.versions[0].id,
    ],
    [
      { dailyCallsPerConsumer: null },
      mockEserviceTemplate.id,
      mockEserviceTemplate.versions[0].id,
    ],
    [
      { dailyCallsTotal: -1 },
      mockEserviceTemplate.id,
      mockEserviceTemplate.versions[0].id,
    ],
    [
      { agreementApprovalPolicy: "INVALID" },
      mockEserviceTemplate.id,
      mockEserviceTemplate.versions[0].id,
    ],
    [eserviceTemplateSeed, "invalidId", mockEserviceTemplate.versions[0].id],
    [eserviceTemplateSeed, mockEserviceTemplate.id, "invalidId"],
  ])(
    "Should return 400 if passed invalid seed or IDs (seed #%#)",
    async (body, templateId, templateVersionId) => {
      const token = generateToken(authRole.M2M_ADMIN_ROLE);
      const res = await makeRequest(
        token,
        templateId as EServiceTemplateId,
        templateVersionId as EServiceTemplateVersionId,
        body as eserviceTemplateApi.PatchUpdateEServiceTemplateVersionSeed
      );

      expect(res.status).toBe(400);
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
  ])(
    "Should return $expectedStatus for $error.code",
    async ({ error, expectedStatus }) => {
      eserviceTemplateService.patchUpdateDraftTemplateVersion = vi
        .fn()
        .mockRejectedValueOnce(error);

      const token = generateToken(authRole.M2M_ADMIN_ROLE);
      const res = await makeRequest(token);
      expect(res.status).toBe(expectedStatus);
    }
  );
});
