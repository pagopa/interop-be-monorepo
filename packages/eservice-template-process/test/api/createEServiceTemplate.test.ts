/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { generateId } from "pagopa-interop-models";
import {
  generateToken,
  getMockEServiceTemplate,
} from "pagopa-interop-commons-test";
import { AuthRole, authRole } from "pagopa-interop-commons";
import request from "supertest";
import { eserviceTemplateApi } from "pagopa-interop-api-clients";
import { api, eserviceTemplateService } from "../vitest.api.setup.js";
import { eserviceTemplateToApiEServiceTemplate } from "../../src/model/domain/apiConverter.js";
import { eserviceTemplateToApiEServiceTemplateSeed } from "../mockUtils.js";
import {
  eServiceTemplateDuplicate,
  inconsistentDailyCalls,
  originNotCompliant,
} from "../../src/model/domain/errors.js";

describe("API POST /templates", () => {
  const mockEserviceTemplate = getMockEServiceTemplate();

  const mockEserviceTemplateSeed: eserviceTemplateApi.EServiceTemplateSeed =
    eserviceTemplateToApiEServiceTemplateSeed(mockEserviceTemplate);
  const notCompliantOrigin = "https://not-allowed-origin.com";
  const eserviceTemplateName = "duplicate";

  const makeRequest = async (
    token: string,
    body: eserviceTemplateApi.EServiceTemplateSeed = mockEserviceTemplateSeed
  ) =>
    request(api)
      .post("/templates")
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .send(body);

  beforeEach(() => {
    eserviceTemplateService.createEServiceTemplate = vi
      .fn()
      .mockResolvedValue(mockEserviceTemplate);
  });

  const authorizedRoles: AuthRole[] = [authRole.ADMIN_ROLE, authRole.API_ROLE];
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
    {},
    { ...mockEserviceTemplateSeed, name: 1 },
    { ...mockEserviceTemplateSeed, technology: "NOT_REST" },
    { ...mockEserviceTemplateSeed, mode: "INVALID_MODE" },
    { ...mockEserviceTemplateSeed, intendedTarget: 123 },
    { ...mockEserviceTemplateSeed, description: 123 },
    { ...mockEserviceTemplateSeed, isSignalHubEnabled: "not-a-boolean" },
    { ...mockEserviceTemplateSeed, version: {} },
    {
      ...mockEserviceTemplateSeed,
      version: { ...mockEserviceTemplateSeed.version, voucherLifespan: -1 },
    },
    {
      ...mockEserviceTemplateSeed,
      version: {
        ...mockEserviceTemplateSeed.version,
        dailyCallsPerConsumer: -1,
      },
    },
    {
      ...mockEserviceTemplateSeed,
      version: { ...mockEserviceTemplateSeed.version, dailyCallsTotal: -1 },
    },
    {
      ...mockEserviceTemplateSeed,
      version: {
        ...mockEserviceTemplateSeed.version,
        agreementApprovalPolicy: "INVALID_POLICY",
      },
    },
    {
      ...mockEserviceTemplateSeed,
      version: {
        ...mockEserviceTemplateSeed.version,
        voucherLifespan: undefined,
        dailyCallsPerConsumer: undefined,
        dailyCallsTotal: undefined,
        agreementApprovalPolicy: undefined,
      },
    },
  ])("Should return 400 if passed invalid params: %s", async (body) => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(
      token,
      body as eserviceTemplateApi.EServiceTemplateSeed
    );

    expect(res.status).toBe(400);
  });

  it.each([
    {
      error: originNotCompliant(notCompliantOrigin),
      expectedStatus: 403,
    },
    {
      error: eServiceTemplateDuplicate(eserviceTemplateName),
      expectedStatus: 409,
    },
    {
      error: inconsistentDailyCalls(),
      expectedStatus: 400,
    },
  ])(
    "Should return $expectedStatus for $error.code",
    async ({ error, expectedStatus }) => {
      eserviceTemplateService.createEServiceTemplate = vi
        .fn()
        .mockRejectedValue(error);

      const token = generateToken(authRole.ADMIN_ROLE);
      const res = await makeRequest(token);
      expect(res.status).toBe(expectedStatus);
    }
  );
});
