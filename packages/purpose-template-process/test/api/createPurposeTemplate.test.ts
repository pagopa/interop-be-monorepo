/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { AuthRole, authRole } from "pagopa-interop-commons";
import {
  generateToken,
  getMockPurposeTemplate,
  getMockWithMetadata,
} from "pagopa-interop-commons-test";
import {
  PurposeTemplate,
  TenantKind,
  generateId,
  tenantKind,
} from "pagopa-interop-models";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { purposeTemplateApi } from "pagopa-interop-api-clients";
import { api, purposeTemplateService } from "../vitest.api.setup.js";
import { purposeTemplateToApiPurposeTemplate } from "../../src/model/domain/apiConverter.js";

describe("API POST /purposeTemplates", () => {
  const authorizedRoles: AuthRole[] = [
    authRole.ADMIN_ROLE,
    authRole.M2M_ADMIN_ROLE,
  ];

  const mockPurposeTemplate: PurposeTemplate = getMockPurposeTemplate();
  const validPurposeTemplateSeed: purposeTemplateApi.PurposeTemplateSeed = {
    targetDescription: "Target description",
    targetTenantKind: tenantKind.PA,
    purposeTitle: "Purpose Template title",
    purposeDescription: "Purpose Template description",
    purposeIsFreeOfCharge: false,
  };

  const purposeTemplateResponse = getMockWithMetadata(mockPurposeTemplate, 0);

  beforeEach(() => {
    purposeTemplateService.createPurposeTemplate = vi
      .fn()
      .mockResolvedValue(purposeTemplateResponse);
  });

  const makeRequest = async (
    token: string,
    purposeTemplateSeed: purposeTemplateApi.PurposeTemplateSeed
  ) =>
    request(api)
      .post(`/purposeTemplates`)
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .send(purposeTemplateSeed);

  it.each(authorizedRoles)(
    "Should return 201 for user with role %s",
    async (role) => {
      const token = generateToken(role);
      const res = await makeRequest(token, validPurposeTemplateSeed);
      expect(res.status).toBe(201);
      expect(res.body).toEqual(
        purposeTemplateToApiPurposeTemplate(mockPurposeTemplate)
      );
      expect(res.headers["x-metadata-version"]).toBe(
        purposeTemplateResponse.metadata.version.toString()
      );
    }
  );

  it.each(
    Object.values(authRole).filter((role) => !authorizedRoles.includes(role))
  )("Should return 403 for user with role %s", async (role) => {
    const token = generateToken(role);
    const res = await makeRequest(token, validPurposeTemplateSeed);
    expect(res.status).toBe(403);
  });
  const OVER_251_CHAR = "Over".repeat(251);

  it.each([
    {},
    {
      ...validPurposeTemplateSeed,
      targetDescription: "",
    },
    {
      ...validPurposeTemplateSeed,
      targetDescription: OVER_251_CHAR,
    },
    {
      ...validPurposeTemplateSeed,
      targetDescription: undefined,
    },
    {
      ...validPurposeTemplateSeed,
      targetTenantKind: "invalidTenantKind",
    },
    {
      ...validPurposeTemplateSeed,
      targetTenantKind: undefined,
    },
    {
      ...validPurposeTemplateSeed,
      purposeTitle: "",
    },
    {
      ...validPurposeTemplateSeed,
      purposeTitle: "1234",
    },
    {
      ...validPurposeTemplateSeed,
      purposeTitle: OVER_251_CHAR,
    },
    {
      ...validPurposeTemplateSeed,
      purposeTitle: undefined,
    },
    {
      ...validPurposeTemplateSeed,
      purposeDescription: "123456789",
    },
    {
      ...validPurposeTemplateSeed,
      purposeDescription: undefined,
    },
    {
      ...validPurposeTemplateSeed,
      purposeDescription: OVER_251_CHAR,
    },
    {
      ...validPurposeTemplateSeed,
      purposeIsFreeOfCharge: undefined,
    },
    {
      ...validPurposeTemplateSeed,
      riskAnalysisForm: undefined,
      targetTenantKind: "INVALID" as TenantKind,
    },
  ])("Should return 400 if passed invalid data: %s", async (body) => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(
      token,
      body as purposeTemplateApi.PurposeTemplateSeed
    );
    expect(res.status).toBe(400);
  });
});
