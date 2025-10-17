/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { purposeTemplateApi } from "pagopa-interop-api-clients";
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
import { purposeTemplateToApiPurposeTemplate } from "../../src/model/domain/apiConverter.js";
import { api, purposeTemplateService } from "../vitest.api.setup.js";
import {
  purposeTemplateNotFound,
  purposeTemplateNotInExpectedStates,
  purposeTemplateRiskAnalysisFormNotFound,
  purposeTemplateStateConflict,
  riskAnalysisTemplateValidationFailed,
  tenantNotAllowed,
} from "../../src/model/domain/errors.js";

describe("API POST /purposeTemplates/{id}/unsuspend", () => {
  const purposeTemplate = getMockPurposeTemplate();
  const serviceResponse = getMockWithMetadata(purposeTemplate);

  const apiResponse = purposeTemplateApi.PurposeTemplate.parse(
    purposeTemplateToApiPurposeTemplate(purposeTemplate)
  );

  beforeEach(() => {
    purposeTemplateService.unsuspendPurposeTemplate = vi
      .fn()
      .mockResolvedValue(serviceResponse);
  });

  const makeRequest = async (
    token: string,
    purposeTemplateId: PurposeTemplateId = purposeTemplate.id
  ) =>
    request(api)
      .post(`/purposeTemplates/${purposeTemplateId}/unsuspend`)
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId());

  const authorizedRoles: AuthRole[] = [
    authRole.ADMIN_ROLE,
    authRole.M2M_ADMIN_ROLE,
  ];

  it.each(authorizedRoles)(
    "Should return 200 for user with role %s",
    async (role) => {
      const token = generateToken(role);
      const res = await makeRequest(token);
      expect(res.status).toBe(200);
      expect(res.body).toEqual(apiResponse);
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
        purposeTemplate.state,
        [purposeTemplateState.suspended]
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
      purposeTemplateService.unsuspendPurposeTemplate = vi
        .fn()
        .mockRejectedValue(error);
      const token = generateToken(authRole.ADMIN_ROLE);
      const res = await makeRequest(token);
      expect(res.status).toBe(expectedStatus);
    }
  );

  it("Should return 400 if passed invalid data", async () => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token, "invalid" as PurposeTemplateId);
    expect(res.status).toBe(400);
  });
});
