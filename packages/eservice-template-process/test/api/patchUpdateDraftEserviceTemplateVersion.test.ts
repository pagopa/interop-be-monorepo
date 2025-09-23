/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect, vi } from "vitest";
import request from "supertest";
import {
  EServiceTemplateId,
  EServiceTemplateVersion,
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
  const mockEServiceTemplate = getMockEServiceTemplate();
  const mockVersion: EServiceTemplateVersion = mockEServiceTemplate.versions[0];

  const serviceResponse = getMockWithMetadata(mockEServiceTemplate);

  const apiEservice = eserviceTemplateApi.EServiceTemplate.parse(
    eserviceTemplateToApiEServiceTemplate(mockEServiceTemplate)
  );

  const eServiceTemplateVersionSeed: eserviceTemplateApi.PatchUpdateEServiceTemplateVersionSeed =
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
    body: eserviceTemplateApi.PatchUpdateEServiceTemplateVersionSeed = eServiceTemplateVersionSeed,
    eServiceTemplateId: EServiceTemplateId = mockEServiceTemplate.id,
    eServiceTemplateVersionId: EServiceTemplateVersionId = mockVersion.id
  ) =>
    request(api)
      .patch(
        `/templates/${eServiceTemplateId}/versions/${eServiceTemplateVersionId}`
      )
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
      expect(res.body).toEqual(apiEservice);
      expect(res.headers["x-metadata-version"]).toBe(
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
      agreementApprovalPolicy: "AUTOMATIC",
    },
  ] as eserviceTemplateApi.PatchUpdateEServiceTemplateVersionSeed[])(
    "Should return 200 with partial seed (seed #%#)",
    async (seed) => {
      const token = generateToken(authRole.M2M_ADMIN_ROLE);
      const res = await makeRequest(token, seed);
      expect(res.status).toBe(200);
    }
  );

  it.each([
    [{ description: 123 }, mockEServiceTemplate.id, mockVersion.id],
    [{ voucherLifespan: "invalid" }, mockEServiceTemplate.id, mockVersion.id],
    [{ description: null }, mockEServiceTemplate.id, mockVersion.id],
    [{ description: null }, mockEServiceTemplate.id, mockVersion.id],
    [{ dailyCallsTotal: -1 }, mockEServiceTemplate.id, mockVersion.id],
    [{ dailyCallsPerConsumer: -1 }, mockEServiceTemplate.id, mockVersion.id],
    [
      { dailyCallsPerConsumer: 300, dailyCallsTotal: 200 },
      mockEServiceTemplate.id,
      mockVersion.id,
    ],
    [
      { agreementApprovalPolicy: "INVALID" },
      mockEServiceTemplate.id,
      mockVersion.id,
    ],
    [eServiceTemplateVersionSeed, "invalidId", mockVersion.id],
    [eServiceTemplateVersionSeed, mockEServiceTemplate.id, "invalidId"],
  ])(
    "Should return 400 if passed invalid seed or IDs (seed #%#)",
    async (body, templateId, templateVersionId) => {
      const token = generateToken(authRole.M2M_ADMIN_ROLE);
      const res = await makeRequest(
        token,
        body as eserviceTemplateApi.PatchUpdateEServiceTemplateSeed,
        templateId as EServiceTemplateId,
        templateVersionId as EServiceTemplateVersionId
      );

      expect(res.status).toBe(400);
    }
  );
  it.each([
    {
      error: eserviceTemplateNotFound(mockEServiceTemplate.id),
      expectedStatus: 404,
    },
    {
      error: eserviceTemplateVersionNotFound(
        mockEServiceTemplate.id,
        mockVersion.id
      ),
      expectedStatus: 404,
    },
    {
      error: operationForbidden,
      expectedStatus: 403,
    },
    {
      error: notValidEServiceTemplateVersionState(
        mockEServiceTemplate.versions[0].id,
        eserviceTemplateVersionState.published
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
