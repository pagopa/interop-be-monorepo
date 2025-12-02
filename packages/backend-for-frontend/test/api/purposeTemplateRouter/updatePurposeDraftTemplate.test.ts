/* eslint-disable @typescript-eslint/explicit-function-return-type */

import { bffApi, purposeTemplateApi } from "pagopa-interop-api-clients";
import { authRole } from "pagopa-interop-commons";
import {
  generateToken,
  getMockPurposeTemplate,
} from "pagopa-interop-commons-test";
import { generateId } from "pagopa-interop-models";
import request from "supertest";
import { vi, beforeEach, describe, it, expect } from "vitest";
import { api, clients } from "../../vitest.api.setup.js";
import { appBasePath } from "../../../src/config/appBasePath.js";

describe("API PUT /purposeTemplates/{purposeTemplateId}", () => {
  const OVER_251_CHAR = "Over".repeat(251);
  const purposeTemplateId = generateId();
  const mockPurposeTemplate200Response: purposeTemplateApi.PurposeTemplate = {
    ...getMockPurposeTemplate(),
    id: purposeTemplateId,
    state: "DRAFT",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    purposeRiskAnalysisForm: undefined,
  };

  const validPurposeTemplateSeed: bffApi.PurposeTemplateSeed = {
    targetDescription: "Target description",
    targetTenantKind: bffApi.TargetTenantKind.Enum.PA,
    purposeTitle: "Purpose Template title",
    purposeDescription: "Purpose Template description",
    purposeIsFreeOfCharge: false,
    handlesPersonalData: false,
  };

  beforeEach(() => {
    clients.purposeTemplateProcessClient.updatePurposeTemplate = vi
      .fn()
      .mockResolvedValue(mockPurposeTemplate200Response);
  });

  const makeRequest = async (
    token: string,
    purposeTemplateSeed: bffApi.PurposeTemplateSeed
  ) =>
    request(api)
      .put(`${appBasePath}/purposeTemplates/${purposeTemplateId}`)
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .send(purposeTemplateSeed);

  it("Should return 200 for user with ADMIN_ROLE", async () => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token, validPurposeTemplateSeed);
    expect(res.status).toBe(200);
  });

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
  ])("Should return 400 if seed is invalid", async (body) => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token, body as bffApi.PurposeTemplateSeed);
    expect(res.status).toBe(400);
  });
});
