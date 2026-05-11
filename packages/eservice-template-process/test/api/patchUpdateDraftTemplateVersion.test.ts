/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect, vi } from "vitest";
import request from "supertest";
import {
  EServiceTemplate,
  EServiceTemplateId,
  EServiceTemplateVersion,
  EServiceTemplateVersionId,
  generateId,
  operationForbidden,
} from "pagopa-interop-models";
import {
  generateToken,
  getMockAttribute,
  getMockEServiceTemplate,
  getMockEServiceTemplateVersion,
  getMockWithMetadata,
} from "pagopa-interop-commons-test";
import { AuthRole, authRole } from "pagopa-interop-commons";
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
import { eserviceTemplateToApiEServiceTemplate } from "../../src/model/domain/apiConverter.js";

describe("PATCH /templates/:templateId/versions/:templateVersionId router test", () => {
  const templateVersion: EServiceTemplateVersion =
    getMockEServiceTemplateVersion();

  const mockEServiceTemplate: EServiceTemplate = {
    ...getMockEServiceTemplate(),
    versions: [templateVersion],
  };

  const serviceResponse = getMockWithMetadata(mockEServiceTemplate);

  const apiEserviceTemplate = eserviceTemplateApi.EServiceTemplate.parse(
    eserviceTemplateToApiEServiceTemplate(mockEServiceTemplate)
  );

  const versionSeed: eserviceTemplateApi.PatchUpdateEServiceTemplateVersionSeed =
    {
      voucherLifespan: 1000,
      dailyCallsPerConsumer: 100,
      dailyCallsTotal: 200,
      agreementApprovalPolicy: "AUTOMATIC",
      description: "new description",
      attributes: {
        certified: [[{ id: getMockAttribute().id }]],
        declared: [[{ id: getMockAttribute().id }]],
        verified: [[{ id: getMockAttribute().id }]],
      },
    };

  eserviceTemplateService.patchUpdateDraftTemplateVersion = vi
    .fn()
    .mockResolvedValue(serviceResponse);

  const makeRequest = async (
    token: string,
    templateId: EServiceTemplateId,
    versionId: EServiceTemplateVersionId,
    body: eserviceTemplateApi.PatchUpdateEServiceTemplateVersionSeed = versionSeed
  ) =>
    request(api)
      .patch(`/templates/${templateId}/versions/${versionId}`)
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .send(body);

  const authorizedRoles: AuthRole[] = [authRole.M2M_ADMIN_ROLE];
  it.each(authorizedRoles)(
    "Should return 200 for user with role %s",
    async (role) => {
      const token = generateToken(role);
      const res = await makeRequest(
        token,
        mockEServiceTemplate.id,
        templateVersion.id
      );
      expect(res.status).toBe(200);
      expect(res.body).toEqual(apiEserviceTemplate);
      expect(res.headers["x-metadata-version"]).toBe(
        serviceResponse.metadata.version.toString()
      );
    }
  );

  it.each([
    {},
    {
      description: "new description",
    },
    {
      description: "new description",
      voucherLifespan: 1000,
    },
    {
      description: "new description",
      voucherLifespan: 1000,
      dailyCallsPerConsumer: 100,
    },
    {
      description: "new description",
      voucherLifespan: 1000,
      dailyCallsPerConsumer: 100,
      dailyCallsTotal: 200,
    },
    {
      description: "new description",
      voucherLifespan: 1000,
      dailyCallsPerConsumer: 100,
      dailyCallsTotal: 200,
      agreementApprovalPolicy: "AUTOMATIC",
    },
    {
      dailyCallsPerConsumer: null,
    },
    {
      dailyCallsTotal: null,
    },
    {
      agreementApprovalPolicy: null,
    },
    {
      attributes: {
        certified: [],
        declared: [[{ id: getMockAttribute().id }]],
      },
    },
    {
      attributes: {
        verified: [
          [{ id: getMockAttribute().id }, { id: getMockAttribute().id }],
        ],
      },
    },
  ] as eserviceTemplateApi.PatchUpdateEServiceTemplateVersionSeed[])(
    "Should return 200 with partial seed and nullable fields (seed #%#)",
    async (seed) => {
      const token = generateToken(authRole.M2M_ADMIN_ROLE);
      const res = await makeRequest(
        token,
        mockEServiceTemplate.id,
        templateVersion.id,
        seed
      );
      expect(res.status).toBe(200);
    }
  );

  it.each(
    Object.values(authRole).filter((role) => !authorizedRoles.includes(role))
  )("Should return 403 for user with role %s", async (role) => {
    const token = generateToken(role);
    const res = await makeRequest(
      token,
      mockEServiceTemplate.id,
      templateVersion.id
    );

    expect(res.status).toBe(403);
  });

  it.each([
    {
      error: eserviceTemplateNotFound(mockEServiceTemplate.id),
      expectedStatus: 404,
    },
    {
      error: eserviceTemplateVersionNotFound(
        mockEServiceTemplate.id,
        templateVersion.id
      ),
      expectedStatus: 404,
    },
    {
      error: operationForbidden,
      expectedStatus: 403,
    },
    {
      error: notValidEServiceTemplateVersionState(
        templateVersion.id,
        templateVersion.state
      ),
      expectedStatus: 400,
    },
    {
      error: inconsistentDailyCalls(),
      expectedStatus: 400,
    },
    {
      error: attributeNotFound(generateId()),
      expectedStatus: 404,
    },
    {
      error: attributeDuplicatedInGroup(generateId()),
      expectedStatus: 400,
    },
  ])(
    "Should return $expectedStatus for $error.code",
    async ({ error, expectedStatus }) => {
      eserviceTemplateService.patchUpdateDraftTemplateVersion = vi
        .fn()
        .mockRejectedValueOnce(error);

      const token = generateToken(authRole.M2M_ADMIN_ROLE);
      const res = await makeRequest(
        token,
        mockEServiceTemplate.id,
        templateVersion.id
      );

      expect(res.status).toBe(expectedStatus);
    }
  );

  it.each([
    [
      { dailyCallsTotal: "invalid" },
      mockEServiceTemplate.id,
      templateVersion.id,
    ],
    [
      { attributes: { invalid: [] } },
      mockEServiceTemplate.id,
      templateVersion.id,
    ],
    [
      { ...versionSeed, dailyCallsTotal: -1 },
      mockEServiceTemplate.id,
      templateVersion.id,
    ],
    [{ ...versionSeed }, "invalidId", templateVersion.id],
    [{ ...versionSeed }, mockEServiceTemplate.id, "invalidId"],
  ])(
    "Should return 400 if passed invalid seed or ids in params (seed #%#)",
    async (body, eServiceTemplateId, versionId) => {
      const token = generateToken(authRole.M2M_ADMIN_ROLE);
      const res = await makeRequest(
        token,
        eServiceTemplateId as EServiceTemplateId,
        versionId as EServiceTemplateVersionId,
        body as eserviceTemplateApi.PatchUpdateEServiceTemplateVersionSeed
      );

      expect(res.status).toBe(400);
    }
  );
});
