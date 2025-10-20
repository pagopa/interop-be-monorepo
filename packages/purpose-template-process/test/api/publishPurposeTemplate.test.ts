/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  generateToken,
  getMockPurposeTemplate,
  getMockWithMetadata,
} from "pagopa-interop-commons-test";
import request from "supertest";
import { AuthRole, authRole } from "pagopa-interop-commons";
import {
  generateId,
  PurposeTemplateId,
  purposeTemplateState,
} from "pagopa-interop-models";
import { api, purposeTemplateService } from "../vitest.api.setup.js";
import {
  purposeTemplateNotFound,
  purposeTemplateNotInExpectedStates,
  purposeTemplateRiskAnalysisFormNotFound,
  purposeTemplateStateConflict,
  riskAnalysisTemplateValidationFailed,
  tenantNotAllowed,
} from "../../src/model/domain/errors.js";

describe("API POST /purposeTemplates/{id}/publish", () => {
  const purposeTemplate = getMockPurposeTemplate();
  const serviceResponse = getMockWithMetadata(purposeTemplate);

  beforeEach(() => {
    purposeTemplateService.publishPurposeTemplate = vi
      .fn()
      .mockResolvedValue(serviceResponse);
  });

  const makeRequest = async (
    token: string,
    purposeTemplateId: PurposeTemplateId = purposeTemplate.id
  ) =>
    request(api)
      .post(`/purposeTemplates/${purposeTemplateId}/publish`)
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId());

  const authorizedRoles: AuthRole[] = [
    authRole.ADMIN_ROLE,
    authRole.M2M_ADMIN_ROLE,
  ];

  it.each(authorizedRoles)(
    "Should return 204 for user with role %s",
    async (role) => {
      const token = generateToken(role);
      const res = await makeRequest(token);
      expect(res.status).toBe(204);
      expect(res.body).toEqual({});
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
    {
      error: purposeTemplateRiskAnalysisFormNotFound(purposeTemplate.id),
      expectedStatus: 500,
    },
    { error: riskAnalysisTemplateValidationFailed([]), expectedStatus: 400 },
    {
      error: purposeTemplateNotInExpectedStates(
        generateId(),
        purposeTemplateState.suspended,
        [purposeTemplateState.draft]
      ),
      expectedStatus: 400,
    },
    { error: tenantNotAllowed(generateId()), expectedStatus: 403 },
    {
      error: purposeTemplateNotFound(generateId()),
      expectedStatus: 404,
    },
    {
      error: purposeTemplateStateConflict(
        generateId(),
        purposeTemplateState.active
      ),
      expectedStatus: 409,
    },
  ])(
    "Should return $expectedStatus for $error.code",
    async ({ error, expectedStatus }) => {
      purposeTemplateService.publishPurposeTemplate = vi
        .fn()
        .mockRejectedValue(error);
      const token = generateToken(authRole.ADMIN_ROLE);
      const res = await makeRequest(token);
      expect(res.status).toBe(expectedStatus);
    }
  );

  const OVER_251_CHAR = "Over".repeat(251);
  it.each([
    {},
    {
      ...purposeTemplate,
      targetDescription: "",
    },
    {
      ...purposeTemplate,
      targetDescription: OVER_251_CHAR,
    },
    {
      ...purposeTemplate,
      targetDescription: undefined,
    },
    {
      ...purposeTemplate,
      targetTenantKind: "invalidTenantKind",
    },
    {
      ...purposeTemplate,
      targetTenantKind: undefined,
    },
    {
      ...purposeTemplate,
      purposeTitle: "",
    },
    {
      ...purposeTemplate,
      purposeTitle: "1234",
    },
    {
      ...purposeTemplate,
      purposeTitle: OVER_251_CHAR,
    },
    {
      ...purposeTemplate,
      purposeTitle: undefined,
    },
    {
      ...purposeTemplate,
      purposeDescription: "123456789",
    },
    {
      ...purposeTemplate,
      purposeDescription: undefined,
    },
    {
      ...purposeTemplate,
      purposeDescription: OVER_251_CHAR,
    },
    {
      ...purposeTemplate,
      purposeIsFreeOfCharge: undefined,
    },
  ])("Should return 400 if passed invalid data: %s", async () => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token, "invalid" as PurposeTemplateId);
    expect(res.status).toBe(400);
  });
});
