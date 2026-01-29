import { describe, it, expect, vi } from "vitest";
import {
  generateToken,
  getMockedApiEServiceTemplate,
} from "pagopa-interop-commons-test";
import { AuthRole, authRole } from "pagopa-interop-commons";
import request from "supertest";
import {
  eserviceTemplateApi,
  m2mGatewayApiV3,
} from "pagopa-interop-api-clients";
import { pollingMaxRetriesExceeded } from "pagopa-interop-models";
import { api, mockEServiceTemplateService } from "../../vitest.api.setup.js";
import { appBasePath } from "../../../src/config/appBasePath.js";
import { missingMetadata } from "../../../src/model/errors.js";
import { config } from "../../../src/config/config.js";
import { toM2MGatewayEServiceTemplate } from "../../../src/api/eserviceTemplateApiConverter.js";

describe("PATCH /eserviceTemplates/:templateId router test", () => {
  const mockEServiceTemplate: eserviceTemplateApi.EServiceTemplate =
    getMockedApiEServiceTemplate();

  const mockUpdateSeed: m2mGatewayApiV3.EServiceTemplateDraftUpdateSeed = {
    name: "updated name",
    description: "updated description",
    technology: "REST",
    isSignalHubEnabled: true,
    mode: "RECEIVE",
    intendedTarget: "updated intendedTarget",
  };

  const mockM2MEServiceTemplate: m2mGatewayApiV3.EServiceTemplate =
    toM2MGatewayEServiceTemplate(mockEServiceTemplate);

  const makeRequest = async (
    token: string,
    templateId: string = mockEServiceTemplate.id,
    body: m2mGatewayApiV3.EServiceTemplateDraftUpdateSeed = mockUpdateSeed
  ) =>
    request(api)
      .patch(`${appBasePath}/eserviceTemplates/${templateId}`)
      .set("Authorization", `Bearer ${token}`)
      .set("Content-Type", "application/merge-patch+json")
      .send(body);

  const authorizedRoles: AuthRole[] = [authRole.M2M_ADMIN_ROLE];
  it.each(authorizedRoles)(
    "Should return 200 and perform service calls for user with role %s",
    async (role) => {
      mockEServiceTemplateService.updateDraftEServiceTemplate = vi
        .fn()
        .mockResolvedValue(mockM2MEServiceTemplate);

      const token = generateToken(role);
      const res = await makeRequest(token);

      expect(res.status).toBe(200);
      expect(res.body).toEqual(mockM2MEServiceTemplate);
      expect(
        mockEServiceTemplateService.updateDraftEServiceTemplate
      ).toHaveBeenCalledWith(
        mockEServiceTemplate.id,
        mockUpdateSeed,
        expect.any(Object) // context
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
    { name: "updated name" },
    { name: "updated name", description: "updated description" },
    {
      name: "updated name",
      description: "updated description",
      technology: "REST",
    },
    {
      name: "updated name",
      description: "updated description",
      technology: "REST",
      isSignalHubEnabled: true,
    },
    {
      name: "updated name",
      description: "updated description",
      technology: "REST",
      isSignalHubEnabled: true,
      intendedTarget: "updated intendedTarget",
    },
    {
      name: "updated name",
      description: "updated description",
      technology: "REST",
      isSignalHubEnabled: true,
      intendedTarget: "updated intendedTarget",
      mode: "RECEIVE",
    },
  ] satisfies m2mGatewayApiV3.EServiceTemplateDraftUpdateSeed[])(
    "Should return 200 with partial seed and nullable fields (seed #%#)",
    async (seed) => {
      const token = generateToken(authRole.M2M_ADMIN_ROLE);
      const res = await makeRequest(token, mockEServiceTemplate.id, seed);
      expect(res.status).toBe(200);
    }
  );

  it("Should return 400 if passed an invalid eserviceTemplate id", async () => {
    const token = generateToken(authRole.M2M_ADMIN_ROLE);
    const res = await makeRequest(token, "invalidEServiceTemplateId");
    expect(res.status).toBe(400);
  });

  it.each([
    { invalidParam: "invalidValue" },
    { ...mockUpdateSeed, extraParam: -1 },
    { ...mockUpdateSeed, description: "short" },
  ])("Should return 400 if passed invalid seed", async (seed) => {
    const token = generateToken(authRole.M2M_ADMIN_ROLE);
    const res = await makeRequest(
      token,
      mockEServiceTemplate.id,
      seed as m2mGatewayApiV3.EServiceTemplateDraftUpdateSeed
    );

    expect(res.status).toBe(400);
  });

  it.each([
    missingMetadata(),
    pollingMaxRetriesExceeded(
      config.defaultPollingMaxRetries,
      config.defaultPollingRetryDelay
    ),
  ])("Should return 500 in case of $code error", async (error) => {
    mockEServiceTemplateService.updateDraftEServiceTemplate = vi
      .fn()
      .mockRejectedValue(error);
    const token = generateToken(authRole.M2M_ADMIN_ROLE);
    const res = await makeRequest(token);

    expect(res.status).toBe(500);
  });

  it.each([
    { ...mockM2MEServiceTemplate, createdAt: undefined },
    { ...mockM2MEServiceTemplate, id: "invalidId" },
    { ...mockM2MEServiceTemplate, extraParam: "extraValue" },
    {},
  ])(
    "Should return 500 when API model parsing fails for response",
    async (resp) => {
      mockEServiceTemplateService.updateDraftEServiceTemplate = vi
        .fn()
        .mockResolvedValue(resp);
      const token = generateToken(authRole.M2M_ADMIN_ROLE);
      const res = await makeRequest(token);

      expect(res.status).toBe(500);
    }
  );
});
