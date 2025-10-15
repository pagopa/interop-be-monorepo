import { m2mGatewayApi } from "pagopa-interop-api-clients";
import {
  generateToken,
  getMockedApiEServiceTemplate,
} from "pagopa-interop-commons-test";
import request from "supertest";
import { authRole, AuthRole } from "pagopa-interop-commons";
import { describe, expect, it, vi } from "vitest";
import { pollingMaxRetriesExceeded } from "pagopa-interop-models";
import { appBasePath } from "../../../src/config/appBasePath.js";
import { api, mockEServiceTemplateService } from "../../vitest.api.setup.js";
import { missingMetadata } from "../../../src/model/errors.js";
import { config } from "../../../src/config/config.js";
import { toM2MGatewayEServiceTemplate } from "../../../src/api/eserviceTemplateApiConverter.js";

describe("POST /eserviceTemplates router test", () => {
  const mockApiEserviceTemplate = getMockedApiEServiceTemplate();

  const mockApiEserviceTemplateWithVersion: m2mGatewayApi.VersionSeedForEServiceTemplateCreation =
    {
      voucherLifespan: 1000,
      description: "Version description",
      dailyCallsPerConsumer: 100,
      dailyCallsTotal: 1000,
      agreementApprovalPolicy: "AUTOMATIC",
    };

  const mockEserviceTemplateSeed: m2mGatewayApi.EServiceTemplateSeed = {
    name: mockApiEserviceTemplate.name,
    description: mockApiEserviceTemplate.description,
    version: {
      voucherLifespan: mockApiEserviceTemplateWithVersion.voucherLifespan,
      description: mockApiEserviceTemplateWithVersion.description,
      dailyCallsPerConsumer:
        mockApiEserviceTemplateWithVersion.dailyCallsPerConsumer,
      dailyCallsTotal: mockApiEserviceTemplateWithVersion.dailyCallsTotal,
      agreementApprovalPolicy:
        mockApiEserviceTemplateWithVersion.agreementApprovalPolicy,
    },
    technology: "REST",
    mode: "DELIVER",
    intendedTarget: "intendedTarget",
  };

  const mockM2MEserviceTemplateResponse: m2mGatewayApi.EServiceTemplate =
    toM2MGatewayEServiceTemplate(mockApiEserviceTemplate);

  const makeRequest = async (
    token: string,
    body: m2mGatewayApi.EServiceTemplateSeed
  ) =>
    request(api)
      .post(`${appBasePath}/eserviceTemplates`)
      .set("Authorization", `Bearer ${token}`)
      .send(body);

  const authorizedRoles: AuthRole[] = [authRole.M2M_ADMIN_ROLE];
  it.each(authorizedRoles)(
    "Should return 201 and perform service calls for user with role %s",
    async (role) => {
      mockEServiceTemplateService.createEServiceTemplate = vi
        .fn()
        .mockResolvedValue(mockM2MEserviceTemplateResponse);

      const token = generateToken(role);
      const res = await makeRequest(token, mockEserviceTemplateSeed);

      expect(res.status).toBe(201);
      expect(res.body).toEqual(mockM2MEserviceTemplateResponse);
    }
  );

  it.each(
    Object.values(authRole).filter((role) => !authorizedRoles.includes(role))
  )("Should return 403 for user with role %s", async (role) => {
    const token = generateToken(role);
    const res = await makeRequest(token, mockEserviceTemplateSeed);
    expect(res.status).toBe(403);
  });

  it.each([
    { ...mockEserviceTemplateSeed, invalidParam: "invalidValue" },
    { ...mockEserviceTemplateSeed, name: undefined },
    { ...mockEserviceTemplateSeed, description: undefined },
    { ...mockEserviceTemplateSeed, technology: "invalid technology" },
    { ...mockEserviceTemplateSeed, mode: "invalid mode" },
    { ...mockEserviceTemplateSeed, intendedTarget: 123 },
    {
      ...mockEserviceTemplateSeed,
      version: { ...mockApiEserviceTemplateWithVersion, voucherLifespan: -1 },
    },
    {
      ...mockEserviceTemplateSeed,
      version: {
        ...mockApiEserviceTemplateWithVersion,
        description: 123,
      },
    },
    {
      ...mockEserviceTemplateSeed,
      version: {
        ...mockApiEserviceTemplateWithVersion,
        dailyCallsPerConsumer: -1,
      },
    },
    {
      ...mockEserviceTemplateSeed,
      version: {
        ...mockApiEserviceTemplateWithVersion,
        dailyCallsTotal: -1,
      },
    },
    {
      ...mockEserviceTemplateSeed,
      version: {
        ...mockApiEserviceTemplateWithVersion,
        agreementApprovalPolicy: "invalid agreementApprovalPolicy",
      },
    },
  ])(
    "Should return 400 if passed an invalid Eservice Template seed (seed #%#)",
    async (body) => {
      const token = generateToken(authRole.M2M_ADMIN_ROLE);
      const res = await makeRequest(
        token,
        body as m2mGatewayApi.EServiceTemplateSeed
      );

      expect(res.status).toBe(400);
    }
  );

  it.each([
    missingMetadata(),
    pollingMaxRetriesExceeded(
      config.defaultPollingMaxRetries,
      config.defaultPollingRetryDelay
    ),
  ])("Should return 500 in case of $code error", async (error) => {
    mockEServiceTemplateService.createEServiceTemplate = vi
      .fn()
      .mockRejectedValue(error);
    const token = generateToken(authRole.M2M_ADMIN_ROLE);
    const res = await makeRequest(token, mockEserviceTemplateSeed);

    expect(res.status).toBe(500);
  });
});
