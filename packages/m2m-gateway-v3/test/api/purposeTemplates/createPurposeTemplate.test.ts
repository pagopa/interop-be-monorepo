import { describe, it, expect, vi } from "vitest";
import {
  generateToken,
  getMockedApiPurposeTemplate,
} from "pagopa-interop-commons-test";
import { AuthRole, authRole } from "pagopa-interop-commons";
import request from "supertest";
import {
  m2mGatewayApiV3,
  purposeTemplateApi,
} from "pagopa-interop-api-clients";
import { pollingMaxRetriesExceeded } from "pagopa-interop-models";
import { api, mockPurposeTemplateService } from "../../vitest.api.setup.js";
import { appBasePath } from "../../../src/config/appBasePath.js";
import { missingMetadata } from "../../../src/model/errors.js";
import { config } from "../../../src/config/config.js";
import { toM2MGatewayApiPurposeTemplate } from "../../../src/api/purposeTemplateApiConverter.js";

describe("POST /purposeTemplates router test", () => {
  const mockPurposeTemplate: purposeTemplateApi.PurposeTemplate =
    getMockedApiPurposeTemplate();

  const mockPurposeTemplateSeed: m2mGatewayApiV3.PurposeTemplateSeed = {
    targetDescription: mockPurposeTemplate.targetDescription,
    targetTenantKind: mockPurposeTemplate.targetTenantKind,
    purposeTitle: mockPurposeTemplate.purposeTitle,
    purposeDescription: mockPurposeTemplate.purposeDescription,
    purposeIsFreeOfCharge: mockPurposeTemplate.purposeIsFreeOfCharge,
    purposeFreeOfChargeReason: mockPurposeTemplate.purposeFreeOfChargeReason,
    purposeDailyCalls: mockPurposeTemplate.purposeDailyCalls,
    handlesPersonalData: mockPurposeTemplate.handlesPersonalData,
  };

  const mockM2MPurposeTemplate: m2mGatewayApiV3.PurposeTemplate =
    toM2MGatewayApiPurposeTemplate(mockPurposeTemplate);

  const makeRequest = async (
    token: string,
    body: m2mGatewayApiV3.PurposeTemplateSeed
  ) =>
    request(api)
      .post(`${appBasePath}/purposeTemplates`)
      .set("Authorization", `Bearer ${token}`)
      .send(body);

  const authorizedRoles: AuthRole[] = [authRole.M2M_ADMIN_ROLE];
  it.each(authorizedRoles)(
    "Should return 201 and perform service calls for user with role %s",
    async (role) => {
      mockPurposeTemplateService.createPurposeTemplate = vi
        .fn()
        .mockResolvedValue(mockM2MPurposeTemplate);

      const token = generateToken(role);
      const res = await makeRequest(token, mockPurposeTemplateSeed);

      expect(res.status).toBe(201);
      expect(res.body).toEqual(mockM2MPurposeTemplate);
    }
  );

  it.each(
    Object.values(authRole).filter((role) => !authorizedRoles.includes(role))
  )("Should return 403 for user with role %s", async (role) => {
    const token = generateToken(role);
    const res = await makeRequest(token, mockPurposeTemplateSeed);
    expect(res.status).toBe(403);
  });

  it.each([
    { invalidParam: "invalidValue" },
    { ...mockPurposeTemplateSeed, extraParam: -1 },
    { ...mockPurposeTemplateSeed, purposeDescription: "short" },
  ])(
    "Should return 400 if passed invalid purpose template seed",
    async (body) => {
      const token = generateToken(authRole.M2M_ADMIN_ROLE);
      const res = await makeRequest(
        token,
        body as m2mGatewayApiV3.PurposeTemplateSeed
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
    mockPurposeTemplateService.createPurposeTemplate = vi
      .fn()
      .mockRejectedValue(error);
    const token = generateToken(authRole.M2M_ADMIN_ROLE);
    const res = await makeRequest(token, mockPurposeTemplateSeed);

    expect(res.status).toBe(500);
  });

  it.each([
    { ...mockM2MPurposeTemplate, createdAt: undefined },
    { ...mockM2MPurposeTemplate, creatorId: "invalidId" },
    { ...mockM2MPurposeTemplate, handlesPersonalData: "invalidBoolean" },
    { ...mockM2MPurposeTemplate, extraParam: "extraValue" },
    {},
  ])(
    "Should return 500 when API model parsing fails for response",
    async (resp) => {
      mockPurposeTemplateService.createPurposeTemplate = vi
        .fn()
        .mockResolvedValue(resp);
      const token = generateToken(authRole.M2M_ADMIN_ROLE);
      const res = await makeRequest(token, mockPurposeTemplateSeed);

      expect(res.status).toBe(500);
    }
  );
});
