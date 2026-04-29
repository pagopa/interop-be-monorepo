/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect, vi } from "vitest";
import {
  Attribute,
  EServiceTemplate,
  EServiceTemplateId,
  EServiceTemplateVersion,
  generateId,
  operationForbidden,
} from "pagopa-interop-models";
import {
  generateToken,
  getMockEServiceTemplate,
  getMockEServiceTemplateVersion,
  getMockWithMetadata,
} from "pagopa-interop-commons-test";
import { AuthRole, authRole } from "pagopa-interop-commons";
import request from "supertest";
import { eserviceTemplateApi } from "pagopa-interop-api-clients";
import { api, eserviceTemplateService } from "../vitest.api.setup.js";
import { eserviceTemplateToApiEServiceTemplate } from "../../src/model/domain/apiConverter.js";
import { buildCreateVersionSeed } from "../mockUtils.js";
import {
  attributeDuplicatedInGroup,
  attributeNotFound,
  draftEServiceTemplateVersionAlreadyExists,
  eserviceTemplateNotFound,
  eserviceTemplateWithoutPublishedVersion,
  inconsistentDailyCalls,
} from "../../src/model/domain/errors.js";

describe("API POST /templates/:templateId/versions", () => {
  const mockVersion = getMockEServiceTemplateVersion();
  const attribute: Attribute = {
    name: "Attribute name",
    id: generateId(),
    kind: "Declared",
    description: "Attribute Description",
    creationTime: new Date(),
  };

  const versionSeed: eserviceTemplateApi.EServiceTemplateVersionSeed = {
    ...buildCreateVersionSeed(mockVersion),
    attributes: {
      certified: [],
      declared: [[{ id: attribute.id }]],
      verified: [],
    },
  };

  const newVersion: EServiceTemplateVersion = {
    ...mockVersion,
    version: 1,
    createdAt: new Date(),
    id: mockVersion.id,
    attributes: {
      certified: [],
      declared: [[{ id: attribute.id }]],
      verified: [],
    },
  };

  const eserviceTemplate: EServiceTemplate = {
    ...getMockEServiceTemplate(),
    versions: [newVersion],
  };

  const serviceResponse = getMockWithMetadata({
    eserviceTemplate,
    createdEServiceTemplateVersionId: newVersion.id,
  });

  const apiCreatedVersion =
    eserviceTemplateApi.CreatedEServiceTemplateVersion.parse({
      eserviceTemplate: eserviceTemplateToApiEServiceTemplate(eserviceTemplate),
      createdEServiceTemplateVersionId: newVersion.id,
    });

  eserviceTemplateService.createEServiceTemplateVersion = vi
    .fn()
    .mockResolvedValue(serviceResponse);

  const makeRequest = async (
    token: string,
    eserviceTemplateId: EServiceTemplateId,
    body: eserviceTemplateApi.EServiceTemplateVersionSeed = versionSeed
  ) =>
    request(api)
      .post(`/templates/${eserviceTemplateId}/versions`)
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .send(body);

  const authorizedRoles: AuthRole[] = [
    authRole.ADMIN_ROLE,
    authRole.API_ROLE,
    authRole.M2M_ADMIN_ROLE,
  ];
  it.each(authorizedRoles)(
    "Should return 200 for user with role %s",
    async (role) => {
      const token = generateToken(role);
      const res = await makeRequest(token, eserviceTemplate.id);
      expect(res.body).toEqual(apiCreatedVersion);
      expect(res.status).toBe(200);
      expect(res.headers["x-metadata-version"]).toBe(
        serviceResponse.metadata.version.toString()
      );
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
      error: eserviceTemplateNotFound(eserviceTemplate.id),
      expectedStatus: 404,
    },
    // {
    //   // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    //   error: templateInstanceNotAllowed(eservice.id, eservice.templateId!),
    //   expectedStatus: 403,
    // },
    {
      error: eserviceTemplateWithoutPublishedVersion(eserviceTemplate.id),
      expectedStatus: 409,
    },
    {
      error: operationForbidden,
      expectedStatus: 403,
    },
    {
      error: draftEServiceTemplateVersionAlreadyExists(eserviceTemplate.id),
      expectedStatus: 400,
    },
    {
      error: attributeNotFound(generateId()),
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
      eserviceTemplateService.createEServiceTemplateVersion = vi
        .fn()
        .mockRejectedValue(error);

      const token = generateToken(authRole.ADMIN_ROLE);
      const res = await makeRequest(token, eserviceTemplate.id);
      expect(res.status).toBe(expectedStatus);
    }
  );
  it("Should return 400 if passed invalid query param", async () => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token, "111" as EServiceTemplateId);
    expect(res.status).toBe(400);
  });

  it.each([
    [{}, eserviceTemplate.id],
    [{ ...versionSeed, voucherLifespan: "invalid" }, eserviceTemplate.id],
    [{ ...versionSeed, agreementApprovalPolicy: null }, eserviceTemplate.id],
    [{ ...versionSeed, dailyCallsTotal: -1 }, eserviceTemplate.id],
    [{ ...versionSeed, attributes: undefined }, eserviceTemplate.id],
    [{ ...versionSeed, docs: [{}] }, eserviceTemplate.id],
    [{}, "invalidId"],
  ])(
    "Should return 400 if passed invalid version params: %s (eserviceTemplateId: %s)",
    async (body, eserviceTemplateId) => {
      const token = generateToken(authRole.ADMIN_ROLE);
      const res = await makeRequest(
        token,
        eserviceTemplateId as EServiceTemplateId,
        body as eserviceTemplateApi.EServiceTemplateVersionSeed
      );

      expect(res.status).toBe(400);
    }
  );
});
