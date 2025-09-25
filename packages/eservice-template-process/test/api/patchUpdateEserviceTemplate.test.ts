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
  getMockWithMetadata,
} from "pagopa-interop-commons-test";
import { AuthRole, authRole } from "pagopa-interop-commons";
import { eserviceTemplateApi } from "pagopa-interop-api-clients";
import { api, eserviceTemplateService } from "../vitest.api.setup.js";
import { eserviceTemplateToApiEServiceTemplate } from "../../src/model/domain/apiConverter.js";
import {
  eserviceTemplateDuplicate,
  eserviceTemplateNotInDraftState,
  eserviceTemplateNotFound,
} from "../../src/model/domain/errors.js";

describe("PATCH /templates/{templateId} router test", () => {
  const mockEServiceTemplate: EServiceTemplate = getMockEServiceTemplate();

  const serviceResponse = getMockWithMetadata(mockEServiceTemplate);
  const apiEserviceTemplate = eserviceTemplateApi.EServiceTemplate.parse(
    eserviceTemplateToApiEServiceTemplate(mockEServiceTemplate)
  );

  const eserviceTemplateSeed: eserviceTemplateApi.PatchUpdateEServiceTemplateSeed =
    {
      name: "new Name",
      description: mockEServiceTemplate.description,
      technology: "REST",
      mode: "DELIVER",
      isSignalHubEnabled: true,
      intendedTarget: "intendedTarget",
    };

  eserviceTemplateService.patchUpdateEServiceTemplate = vi
    .fn()
    .mockResolvedValue(serviceResponse);

  const makeRequest = async (
    token: string,
    templateId: string,
    body: eserviceTemplateApi.PatchUpdateEServiceTemplateSeed = eserviceTemplateSeed
  ) =>
    request(api)
      .patch(`/templates/${templateId}`)
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .send(body);

  const authorizedRoles: AuthRole[] = [authRole.M2M_ADMIN_ROLE];
  it.each(authorizedRoles)(
    "Should return 200 for user with role %s",
    async (role) => {
      const token = generateToken(role);
      const res = await makeRequest(token, mockEServiceTemplate.id);
      expect(res.status).toBe(200);
      expect(res.body).toEqual(apiEserviceTemplate);
      expect(res.headers["x-metadata-version"]).toBe(
        serviceResponse.metadata.version.toString()
      );
    }
  );

  it.each([
    {},
    { name: "updated name" },
    {
      name: "updated name",
      description: "updated description",
    },
    {
      name: "updated name",
      description: "updated description",
      technology: "SOAP",
    },
    {
      name: "updated name",
      description: "updated description",
      technology: "SOAP",
      mode: "RECEIVE",
    },
    {
      name: "updated name",
      description: "updated description",
      technology: "SOAP",
      mode: "DELIVER",
      isSignalHubEnabled: false,
    },
    {
      name: "updated name",
      description: "updated description",
      technology: "SOAP",
      mode: "RECEIVE",
      isSignalHubEnabled: false,
      intendedTarget: "updated intendedTarget",
    },
  ] as eserviceTemplateApi.PatchUpdateEServiceTemplateSeed[])(
    "Should return 200 with partial seed (seed #%#)",
    async (seed) => {
      const token = generateToken(authRole.M2M_ADMIN_ROLE);
      const res = await makeRequest(token, mockEServiceTemplate.id, seed);
      expect(res.status).toBe(200);
    }
  );

  it.each([
    [{ name: 123 }, mockEServiceTemplate.id],
    [{ description: null }, mockEServiceTemplate.id],
    [{ intendedTarget: null }, mockEServiceTemplate.id],
    [{ technology: "invalidTechnology" }, mockEServiceTemplate.id],
    [{ mode: "invalidMode" }, mockEServiceTemplate.id],
    [{ ...eserviceTemplateSeed }, "invalidId"],
  ])(
    "Should return 400 if passed invalid seed or e-service id (seed #%#)",
    async (body, templateId) => {
      const token = generateToken(authRole.M2M_ADMIN_ROLE);
      const res = await makeRequest(
        token,
        templateId as EServiceTemplateId,
        body as eserviceTemplateApi.UpdateEServiceTemplateSeed
      );

      expect(res.status).toBe(400);
    }
  );

  it.each(
    Object.values(authRole).filter((role) => !authorizedRoles.includes(role))
  )("Should return 403 for user with role %s", async (role) => {
    const token = generateToken(role);
    const res = await makeRequest(token, mockEServiceTemplate.id);

    expect(res.status).toBe(403);
  });

  it.each([
    {
      error: eserviceTemplateDuplicate(mockEServiceTemplate.name),
      expectedStatus: 409,
    },
    {
      error: eserviceTemplateNotFound(mockEServiceTemplate.id),
      expectedStatus: 404,
    },
    {
      error: operationForbidden,
      expectedStatus: 403,
    },
    {
      error: eserviceTemplateNotInDraftState(mockEServiceTemplate.id),
      expectedStatus: 400,
    },
  ])(
    "Should return $expectedStatus for $error.code",
    async ({ error, expectedStatus }) => {
      eserviceTemplateService.patchUpdateEServiceTemplate = vi
        .fn()
        .mockRejectedValueOnce(error);

      const token = generateToken(authRole.M2M_ADMIN_ROLE);
      const res = await makeRequest(token, mockEServiceTemplate.id);

      expect(res.status).toBe(expectedStatus);
    }
  );
});
